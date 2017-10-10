/**
 *      iobroker MyAdapter class V1.1.0 from broadlink2
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
/*jshint -W089, -W030 */
// jshint  node: true, esversion: 6, strict: true, undef: true, unused: true
"use strict";
const util = require('util'),
    http = require('http'),
    https = require('https'),
    url = require('url'),
    exec = require('child_process').exec,
    assert = require('assert');

var adapter, that, main, messages, timer, stateChange, objChange, unload, name, stopping = false,
    inDebug = false,
    objects = {},
    states = {};

const slog = (adapter, log, text) => adapter && adapter.log && typeof adapter.log[log] === 'function' ?
    adapter.log[log](text) :
    console.log(log + ': ' + text);

class MyAdapter {
    constructor(adapter, main) {
        if (adapter && main)
            MyAdapter.init(adapter, main);
        return MyAdapter;
    }

    static processMessage(obj) {
        return (obj.command === 'debug' ? Promise.resolve(`debug set to '${inDebug = this.parseLogic(obj.message)}'`) : messages(obj))
            .then(res => this.D(`Message from '${obj.from}', command '${obj.command}', message '${this.S(obj.message)}' executed with result:"${this.S(res)}"`, res),
                err => this.W(`invalid Message ${this.O(obj)} caused error ${this.O(err)}`, err))
            .then(res => obj.callback ? adapter.sendTo(obj.from, obj.command, res, obj.callback) : undefined)
            .then(() => this.c2p(adapter.getMessage)().then(obj => obj ? this.processMessage(obj) : true));
    }


    static initAdapter() {
        states = {};
        this.D(`Adapter ${this.ains} starting.`);
        this.getObjectList = this.c2p(adapter.objects.getObjectList);
        this.getForeignState = this.c2p(adapter.getForeignState);
        this.setForeignState = this.c2p(adapter.setForeignState);
        this.getState = this.c2p(adapter.getState);
        this.setState = this.c2p(adapter.setState);

        return (!adapter.config.forceinit ?
                Promise.resolve({
                    rows: []
                }) :
                this.getObjectList({
                    startkey: this.ain,
                    endkey: this.ain + '\u9999'
                }))
            .then(res => res.rows.length > 0 ? this.D(`will remove ${res.rows.length} old states!`, res) : res)
            .then(res => this.seriesOf(res.rows, (i) => this.removeState(i.doc.common.name), 2))
            .then(res => res, err => this.E('err from MyAdapter.series: ' + err))
            .then(() => this.getObjectList({
                include_docs: true
            }))
            .then(res => {
                res = res && res.rows ? res.rows : [];
                objects = {};
                for (let i of res)
                    objects[i.doc._id] = i.doc;
                if (objects['system.config'] && objects['system.config'].common.language)
                    adapter.config.lang = objects['system.config'].common.language;
                if (objects['system.config'] && objects['system.config'].common.latitude) {
                    adapter.config.latitude = parseFloat(objects['system.config'].common.latitude);
                    adapter.config.longitude = parseFloat(objects['system.config'].common.longitude);
                }
                return res.length;
            }, err => this.E('err from getObjectList: ' + err, 'no'))
            .then(len => this.D(`${adapter.name} received ${len} objects with config ${Object.keys(adapter.config)}`))
            .catch(err => this.W(`Error in adapter.ready: ${err}`))
            .then(() => {
                if (stateChange) adapter.subscribeStates('*');
                if (objChange) adapter.subscribeObjects('*');
            });
    }

    static init(ori_adapter, ori_main) {
        assert(!adapter, `myAdapter:(${ori_adapter.name}) defined already!`);
        adapter = ori_adapter;
        assert(adapter && adapter.name, 'myAdapter:(adapter) no adapter here!');
        name = adapter.name;
        main = typeof ori_main === 'function' ? ori_main : () => this.W(`No 'main() defined for ${adapter.name}!`);
        messages = (mes) => Promise.resolve(this.W(`Message ${this.O(mes)} received and no handler defined!`));

        this.getForeignObject = this.c2p(adapter.getForeignObject);
        this.setForeignObject = this.c2p(adapter.setForeignObject);
        this.getForeignObjects = this.c2p(adapter.getForeignObjects);
        this.getObject = this.c2p(adapter.getObject);
        this.deleteState = (id) => this.c1pe(adapter.deleteState)(id).catch(res => res === 'Not exists' ? Promise.resolve() : Promise.reject(res));
        this.delObject = (id, opt) => this.c1pe(adapter.delObject)(id, opt).catch(res => res === 'Not exists' ? Promise.resolve() : Promise.reject(res));
        this.delState = (id, opt) => this.c1pe(adapter.delState)(id, opt).catch(res => res === 'Not exists' ? Promise.resolve() : Promise.reject(res));
        this.removeState = (id, opt) => this.delState(id, opt).then(() => this.delObject((delete this.states[id], id), opt));
        this.setObject = this.c2p(adapter.setObject);
        this.createState = this.c2p(adapter.createState);
        this.extendObject = this.c2p(adapter.extendObject);

        adapter.on('message', (obj) => !!obj ? this.processMessage(
                this.D(`received Message ${this.O(obj)}`, obj)) : true)
            .on('unload', (callback) => this.stop(false, callback))
            .on('ready', () => this.initAdapter().then(main))
            .on('objectChange', (id, obj) => obj && obj._id && objChange ? objChange(id, obj) : null)
            .on('stateChange', (id, state) => state && state.from !== 'system.adapter.' + this.ains && stateChange ?
                stateChange(this.D(`stateChange called for ${id} = ${this.O(state)}`, id), state).then(() => true,
                    err => this.W(`Error in StateChange for ${id} = ${this.O(err)}`)
                ) : null);

        return that;
    }

    static J( /** string */ str, /** function */ reviewer) {
        let res;
        if (!str)
            return null;
        if (this.T(str) !== 'string')
            str = str.toString();
        try {
            res = JSON.parse(str, reviewer);
        } catch (e) {
            res = {
                error: e,
                error_description: `${e} on string ${str}`
            };
        }
        return res;
    }
    static nop(obj) {
        return obj;
    }
    static split(x, s) {
        return this.trim((typeof x === 'string' ? x : `${x}`).split(s));
    }
    static trim(x) {
        return Array.isArray(x) ? x.map(this.trim) : typeof x === 'string' ? x.trim() : `${x}`.trim();
    }
    static D(str, val) {
        return (inDebug ?
            slog(adapter, 'info', `<span style="color:darkblue;">debug: ${str}</span>`) :
            slog(adapter, 'debug', str), val !== undefined ? val : str);
    }
    static I(l, v) {
        return (slog(adapter, 'info', l), v === undefined ? l : v);
    }
    static W(l, v) {
        return (slog(adapter, 'warn', l), v === undefined ? l : v);
    }
    static E(l, v) {
        return (slog(adapter, 'error', l), v === undefined ? l : v);
    }

    static get debug() {
        return inDebug;
    }
    static set debug(y) {
        inDebug = y;
    }
    static get timer() {
        return timer;
    }
    static set timer(y) {
        timer = y;
    }
    static get messages() {
        return messages;
    }
    static set messages(y) {
        messages = (assert(typeof y === 'function', 'Error: messages handler not a function!'), y);
    }
    static get stateChange() {
        return stateChange;
    }
    static set stateChange(y) {
        stateChange = (assert(typeof y === 'function', 'Error: StateChange handler not a function!'), y);
    }
    static get objChange() {
        return objChange;
    }
    static set objChange(y) {
        objChange = (assert(typeof y === 'function', 'Error: ObjectChange handler not a function!'), y);
    }
    static get unload() {
        return unload;
    }
    static set unload(y) {
        unload = (assert(typeof y === 'function', 'Error: unload handler not a function!'), y);
    }
    static get name() {
        return name;
    }
    static get states() {
        return states;
    }
    static get aObjects() {
        return adapter.objects;
    }
    static get objects() {
        return objects;
    }
    static set objects(y) {
        objects = y;
    }
    static get ains() {
        return name + '.' + adapter.instance;
    }
    static get ain() {
        return this.ains + '.';
    }
    static get C() {
        return adapter.config;
    }

    static parseLogic(obj) {
        return this.includes(['0', 'off', 'aus', 'false', 'inactive'], obj.toString().trim().toLowerCase()) ?
            false : this.includes(['1', '-1', 'on', 'ein', 'true', 'active'], obj.toString().trim().toLowerCase());
    }
    static clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    static wait(time, arg) {
        return new Promise(res => setTimeout(res, time, arg));
    }

    static P(pv, res, rej) {
        if (pv instanceof Promise)
            return pv;
        if (pv && typeof pv.then === 'function')
            return new Promise((rs, rj) => pv.then(rs, rj));
        if (pv)
            return Promise.resolve(res || pv);
        return Promise.reject(rej || pv);
    }

    static pTimeout(pr, time, callback) {
        let t = parseInt(time);
        assert(typeof t === 'number' && t > 0, `pTimeout requires a positive number as second argument for the ms`);
        let st = null;
        assert(callback && typeof callback === 'function', `pTimeout requires optionally a function for callback as third argument`);
        return new Promise((resolve, reject) => {
            let rs = res => {
                    if (st) clearTimeout(st);
                    st = null;
                    return resolve(res);
                },
                rj = err => {
                    if (st) clearTimeout(st);
                    st = null;
                    return reject(err);
                };
            st = setTimeout(() => {
                st = null;
                reject(`timer ${t} run out`);
            }, t);
            if (callback) callback(rs, rj);
            this.P(pr).then(rs, rj);
        });
    }

    static O(obj, level) {
        return util.inspect(obj, false, level || 2, false).replace(/\n/g, ' ');
    }
    static S(obj, level) {
        return typeof obj === 'string' ? obj : this.O(obj, level);
    }
    static N(fun) {
        return setTimeout.apply(null, [fun, 0].concat(Array.prototype.slice.call(arguments, 1)));
    } // move fun to next schedule keeping arguments
    static T(i, j) {
        let t = typeof i;
        if (t === 'object') {
            if (Array.isArray(i)) t = 'array';
            else if (i instanceof RegExp) t = 'regexp';
            else if (i === null) t = 'null';
        } else if (t === 'number' && isNaN(i)) t = 'NaN';
        return j === undefined ? t : this.T(j) === t;
    }
    static locDate(date) {
        return date instanceof Date ?
            new Date(date.getTime() - date.getTimezoneOffset() * 60000) :
            typeof date === 'string' ?
            new Date(Date.parse(date) - (new Date().getTimezoneOffset()) * 60000) :
            !isNaN(+date) ?
            new Date(+date - (new Date().getTimezoneOffset()) * 60000) :
            new Date(Date.now() - (new Date().getTimezoneOffset()) * 60000);
    }
    static dateTime(date) {
        return this.locDate(date).toISOString().slice(0, -5).replace('T', '@');
    }
    static obToArray(obj) {
        return (Object.keys(obj).map(i => obj[i]));
    }
    static includes(obj, value) {
        return this.T(obj, {}) ? obj[value] !== undefined :
            this.T(obj, []) ? obj.find(x => x === value) !== undefined : obj === value;
    }

    static stop(dostop, callback) {
        if (stopping) return;
        stopping = true;
        if (timer)
            clearInterval(timer);
        timer = null;
        this.D(`Adapter disconnected and stopped with dostop(${dostop}) and callback(${!!callback})`);
        Promise.resolve(unload ? unload(dostop) : null)
            .then(() => callback && callback())
            .catch(this.W)
            .then(() => dostop ? this.E("Adapter will exit in lates 2 sec!", setTimeout(process.exit, 2000, 55)) : null);
    }

    static seriesOf(obj, promfn, delay) { // fun gets(item) and returns a promise
        assert(typeof promfn === 'function', 'series(obj,promfn,delay) error: promfn is not a function!');
        delay = parseInt(delay);
        let p = Promise.resolve();
        const nv = [],
            f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => this.wait(delay, nv.push(res)))) :
            (k) => p = p.then(() => promfn(k));
        for (let item of obj)
            f(item);
        return p.then(() => nv);
    }

    static seriesIn(obj, promfn, delay) { // fun gets(item,object) and returns a promise
        assert(typeof promfn === 'function', 'series(obj,promfn,delay) error: promfn is not a function!');
        delay = parseInt(delay);
        let p = Promise.resolve();
        const nv = [],
            f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => this.wait(delay, nv.push(res)))) :
            (k) => p = p.then(() => promfn(k));
        for (let item in obj)
            f(item, obj);
        return p.then(() => nv);
    }

    static c2p(f) {
        assert(typeof f === 'function', 'c2p (f) error: f is not a function!');
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise((res, rej) => (args.push((err, result) => (err && rej(err)) || res(result)), f.apply(this, args)));
        };
    }

    static c1p(f) {
        assert(typeof f === 'function', 'c1p (f) error: f is not a function!');
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise(res => (args.push((result) => res(result)), f.apply(this, args)));
        };
    }

    static c1pe(f) { // one parameter != null = error
        assert(typeof f === 'function', 'c1pe (f) error: f is not a function!');
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise((res, rej) => (args.push((result) => !result ? res(result) : rej(result)), f.apply(this, args)));
        };
    }

    static retry(nretry, fn, arg) {
        assert(typeof fn === 'function', 'retry (,fn,) error: fn is not a function!');
        nretry = parseInt(nretry);
        return fn(arg).catch(err => nretry <= 0 ? Promise.reject(err) : this.retry(nretry - 1, fn, arg));
    }

    static
    while ( /** function */ fw, /** function */ fn, /** number */ time) {
        assert(typeof fw === 'function' && typeof fn === 'function', 'retry (fw,fn,) error: fw or fn is not a function!');
        time = parseInt(time) || 1;
        return !fw() ? Promise.resolve(true) :
            fn().then(() => true, () => true)
            .then(() => this.wait(time))
            .then(() => this.while(fw, fn, time));
    }

    static repeat( /** number */ nretry, /** function */ fn, arg) {
        assert(typeof fn === 'function', 'repeat (,fn,) error: fn is not a function!');
        nretry = parseInt(nretry);
        return fn(arg).
        then(res => Promise.reject(res))
            .catch(res => nretry <= 0 ? Promise.resolve(res) : this.repeat(nretry - 1, fn, arg));
    }

    static exec(command) {
        assert(typeof fn === 'string', 'exec (fn) error: fn is not a string!');
        const istest = command.startsWith('!');
        return new Promise((resolve, reject) => {
            exec(istest ? command.slice(1) : command, (error, stdout, stderr) => {
                if (istest && error) {
                    error[stderr] = stderr;
                    return reject(error);
                }
                resolve(stdout);
            });
        });
    }

    static url(turl, opt) {
        //        this.D(`mup start: ${this.O(turl)}: ${this.O(opt)}`);
        if (this.T(turl) === 'string')
            turl = url.parse(turl.trim(), true);
        if (this.T(opt) === 'object')
            for (var i of Object.keys(opt))
                if (i !== 'url') turl[i] = opt[i];
        //        this.D(`mup ret: ${this.O(turl)}`);
        return turl;
    }

    static request(opt, value, transform) {
        if (this.T(opt) === 'string')
            opt = this.url(opt.trim());
        if (this.T(opt) !== 'object' && !(opt instanceof url.Url))
            return Promise.reject(this.W(`Invalid opt or Url for request: ${this.O(opt)}`));
        if (opt.url > '')
            opt = this.url(opt.url, opt);
        if (opt.json)
            if (opt.headers) opt.headers.Accept = 'application/json';
            else opt.headers = {
                Accept: 'application/json'
            };
        if (!opt.protocol)
            opt.protocol = 'http:';
        let fun = opt.protocol.startsWith('https') ? https.request : http.request;
        //                this.D(`opt: ${this.O(opt)}`);
        return new Promise((resolve, reject) => {
            let data = new Buffer(''),
                res;
            const req = fun(opt, function (result) {
                res = result;
                //                MyAdapter.D(`status: ${MyAdapter.O(res.statusCode)}/${http.STATUS_CODES[res.statusCode]}`);
                res.setEncoding(opt.encoding ? opt.encoding : 'utf8');
                if (MyAdapter.T(opt.status) === 'array' && opt.status.indexOf(res.statusCode) < 0)
                    return reject(MyAdapter.D(`request for ${url.format(opt)} had status ${res.statusCode}/${http.STATUS_CODES[res.statusCode]} other than supported ${opt.status}`));
                res.on('data', chunk => data += chunk)
                    .on('end', () => {
                        res.removeAllListeners();
                        req.removeAllListeners();
                        if (MyAdapter.T(transform) === 'function')
                            data = transform(data);
                        if (opt.json) {
                            try {
                                return resolve(JSON.parse(data));
                            } catch (e) {
                                return err(`request JSON error ${MyAdapter.O(e)}`);
                            }
                        }
                        return resolve(data);
                    })
                    .on('close', () => err(`Connection closed before data was received!`));
            });

            function err(e, msg) {
                if (!msg)
                    msg = e;
                res && res.removeAllListeners();
                //                req && req.removeAllListeners();
                req && !req.aborted && req.abort();
                //                res && res.destroy();
                MyAdapter.D('err in response:' + msg);
                return reject(msg);
            }

            if (opt.timeout)
                req.setTimeout(opt.timeout, () => err('request timeout Error: ' + opt.timeout + 'ms'));
            req.on('error', (e) => err('request Error: ' + MyAdapter.O(e)))
                .on('aborted', (e) => err('request aborted: ' + MyAdapter.O(e)));
            // write data to request body
            return req.end(value, opt.encoding ? opt.encoding : 'utf8');
        });
    }

    static get(url, retry) { // get a web page either with http or https and return a promise for the data, could be done also with request but request is now an external package and http/https are part of nodejs.
        const fun = typeof url === 'string' && url.trim().toLowerCase().startsWith('https') ||
            url.protocol === 'https' ? https.get : http.get;
        return (new Promise((resolve, reject) => {
            fun(url, (res) => {
                if (res.statusCode !== 200) {
                    const error = new Error(`Request Failed. Status Code: ${res.statusCode}`);
                    res.resume(); // consume response data to free up memory
                    return reject(error);
                }
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => rawData += chunk);
                res.on('end', () => resolve(rawData));
            }).on('error', (e) => reject(e));
        })).catch(err => !retry ? Promise.reject(err) : this.wait(100, retry - 1).then(a => this.get(url, a)));
    }

    static equal(a, b) {
        if (a === b)
            return true;
        let ta = this.T(a),
            tb = this.T(b);
        if (ta === tb) {
            if (ta === 'array' || ta === 'function' || ta === 'object')
                return JSON.stringify(a) === JSON.stringify(b);
        } else if (ta === 'string' && (tb === 'array' || tb === 'function' || tb === 'object') && a === this.O(b))
            return true;
        return false;
    }

    static changeState(id, value, ack, always) {
        assert(typeof id === 'string', 'changeState (id,,,) error: id is not a string!');
        always = always === undefined ? false : !!always;
        ack = ack === undefined ? true : !!ack;
        return this.getState(id)
            .then(st => st && !always && this.equal(st.val, value) && st.ack === ack ? Promise.resolve() :
                this.setState(this.D(`Change ${id} to ${this.O(value)} with ack: ${ack}`, id), value, ack))
            .catch(err => this.W(`Error in MyAdapter.setState(${id},${value},${ack}): ${err}`, this.setState(id, value, ack)));
    }

    static makeState(ido, value, ack, always) {
        //        this.D(`Make State ${this.O(ido)} and set value to:${this.O(value)} ack:${ack}`); ///TC
        ack = ack === undefined || !!ack;
        let id = ido;
        if (typeof id === 'string')
            ido = id.endsWith('Percent') ? {
                unit: "%"
            } : {};
        else if (typeof id.id === 'string') {
            id = id.id;
        } else return Promise.reject(this.W(`Invalid makeState id: ${this.O(id)}`));
        if (this.states[id])
            return this.changeState(id, value, ack, always);
        //    this.D(`Make State ${id} and set value to:${this.O(value)} ack:${ack}`); ///TC
        const st = {
            common: {
                name: id, // You can add here some description
                read: true,
                write: false,
                state: 'state',
                role: 'value',
                type: typeof value
            },
            type: 'state',
            _id: id
        };
        for (let i in ido) {
            if (i === 'native') {
                st.native = st.native || {};
                for (let j in ido[i])
                    st.native[j] = ido[i][j];
            } else if (i !== 'id' && i !== 'val') st.common[i] = ido[i];
        }
        if (st.common.write)
            st.common.role = st.common.role.replace(/^value/, 'level');
        //    this.I(`will create state:${id} with ${this.O(st)}`);
        return this.extendObject(id, st, null)
            .then(x => this.states[id] = x)
            .then(() => st.common.state === 'state' ? this.changeState(id, value, ack, always) : true)
            .catch(err => this.D(`MS ${this.O(err)}`, id));
    }
}

module.exports = MyAdapter;