/**
 *      iobroker MyAdapter class
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
// jshint node:true, esversion:6, strict:global, undef:true, unused:true
"use strict";
const util = require('util');
const http = require('http');
const https = require('https');
const exec = require('child_process').exec;
const assert = require('assert');

function MyAdapter(ori_adapter, main) {
    if (!(this instanceof MyAdapter)) return new MyAdapter(ori_adapter, main);
    let adapter = ori_adapter,
        that = this;

    assert(adapter && adapter.name, 'myAdapter:(adapter) no adapter here!');

    function slog(log, text) {
        if (typeof log === 'function')
            log(text);
        else
            console.log(text);
    }

    that.D = (str, val) => (that._debug ?
        slog(adapter.log.info, `<span style="color:darkblue;">debug: ${str}</span>`) :
        slog(adapter.log.debug, str), val !== undefined ? val : str);
    that.I = (l, v) => (slog(adapter.log.info, l), v === undefined ? l : v);
    that.W = (l, v) => (slog(adapter.log.warn, l), v === undefined ? l : v);
    that.E = (l, v) => (slog(adapter.log.error, l), v === undefined ? l : v);

    that._main = typeof main === 'function' ? main : () => that.W(`No 'main() defined!`);
    that._messages = (mes) => that.W(`Message ${that.O(mes)} received and no handler defined!`);
    that._stopping = false;
    that._timer = null;
    that._debug = false;

    that.wait = (time, arg) => new Promise(res => setTimeout(res, time, arg));

    that.O = (obj, level) => util.inspect(obj, false, level || 2, false).replace(/\n/g, ' ');
    that.N = (fun) => setTimeout.apply(null, [fun, 0].concat(Array.prototype.slice.call(arguments, 1))); // move fun to next schedule keeping arguments
    that.T = (i) => {
        let t = typeof i;
        if (t === 'object') {
            if (Array.isArray(i)) t = 'array';
            else if (i instanceof RegExp) t = 'regexp';
            else if (i === null) t = 'null';
        } else if (t === 'number' && isNaN(i)) t = 'NaN';
        return t;
    };

    that.obToArray = (obj) => (Object.keys(obj).map(i => obj[i]));
    that.series = (obj, promfn, delay) => { // fun gets(item) and returns a promise
        assert(typeof promfn === 'function', 'series(obj,promfn,delay) error: promfn is not a function!');
        delay = parseInt(delay);
        let p = Promise.resolve();
        const nv = [],
            f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => that.wait(delay, nv.push(res)))) :
            (k) => p = p.then(() => promfn(k));
        for (let item of obj)
            f(item);
        return p.then(() => nv);
    };

    that.c2p = (f) => {
        assert(typeof f === 'function', 'c2p (f) error: f is not a function!');
        if (!f)
            throw new Error(`f = null in c2pP definition!`);
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise((res, rej) => {
                args.push((err, result) => (err && rej(err)) || res(result));
                f.apply(this, args);
            });
        };
    };

    that.c1p = (f) => {
        assert(typeof f === 'function', 'c1p (f) error: f is not a function!');
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise((res) => {
                args.push((result) => res(result));
                f.apply(this, args);
            });
        };
    };

    that.c1pe = (f) => { // one parameter != null = error
        assert(typeof f === 'function', 'c1pe (f) error: f is not a function!');
        return function () {
            const args = Array.prototype.slice.call(arguments);
            return new Promise((res, rej) => {
                args.push((result) => !result ? res(result) : rej(result));
                f.apply(this, args);
            });
        };
    };

    that.retry = (nretry, fn, arg) => {
        assert(typeof fn === 'function', 'retry (,fn,) error: fn is not a function!');
        return fn(arg).catch(err => {
            if (nretry <= 0)
                throw err;
            return that.retry(nretry - 1, fn, arg);
        });
    };

    that.repeat = (nretry, fn, arg) => {
        assert(typeof fn === 'function', 'repeat (,fn,) error: fn is not a function!');
        return fn(arg).then(() => Promise.reject()).catch(() => {
            if (nretry <= 0)
                return Promise.resolve();
            return that.repeat(nretry - 1, fn, arg);
        });
    };

    that.exec = (command) => {
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
    };

    that.get = (url, retry) => { // get a web page either with http or https and return a promise for the data, could be done also with request but request is now an external package and http/https are part of nodejs.
        const fun = typeof url === 'string' && url.trim().toLowerCase().startsWith('https') ||
            url.protocol == 'https' ? https.get : http.get;
        return (new Promise((resolve, reject) => {
            fun(url, (res) => {
                const statusCode = res.statusCode;
                //                const contentType = res.headers['content-type'];
                if (statusCode !== 200) {
                    const error = new Error(`Request Failed. Status Code: ${statusCode}`);
                    res.resume(); // consume response data to free up memory
                    return reject(error);
                }
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => rawData += chunk);
                res.on('end', () => resolve(rawData));
            }).on('error', (e) => reject(e));
        })).catch(err => !retry ? Promise.reject(err) : that.wait(100, retry - 1).then(a => that.get(url, a)));
    };

    that.initAdapter = function () {
        that.states = {};
        that.ains = adapter.name + '.' + adapter.instance;
        that.ain = that.ains + '.';
        that.D(`Adapter ${that.ains} starting.`);
        that.getObjectList = that.c2p(adapter.objects.getObjectList);
        that.getForeignObject = that.c2p(adapter.getForeignObject);
        that.setForeignObject = that.c2p(adapter.setForeignObject);
        that.getForeignObjects = that.c2p(adapter.getForeignObjects);
        that.getForeignState = that.c2p(adapter.getForeignState);
        that.getState = that.c2p(adapter.getState);
        that.setState = that.c2p(adapter.setState);
        that.getObject = that.c2p(adapter.getObject);
        that.deleteState = (id) => that.c1pe(adapter.deleteState)(id).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
        that.delState = (id, opt) => that.c1pe(adapter.delState)(id, opt).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
        that.delObject = (id, opt) => that.c1pe(adapter.delObject)(id, opt).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
        that.removeState = (id, opt) => that.delState(id, opt).then(() => that.delObject((delete that.states[id], id), opt));
        that.setObject = that.c2p(adapter.setObject);
        that.createState = that.c2p(adapter.createState);
        that.extendObject = that.c2p(adapter.extendObject);
        return (!adapter.config.forceinit ?
                Promise.resolve({
                    rows: []
                }) :
                that.getObjectList({
                    startkey: that.ain,
                    endkey: that.ain + '\u9999'
                }))
            .then(res => that.series(res.rows, (i) => that.removeState(that.D('deleteState: ' + i.doc.common.name, i.doc.common.name)), 2))
            .then(res => res, err => that.E('err from that.series: ' + err))
            .then(() => that.getObjectList({
                include_docs: true
            }))
            .then(res => {
                res = res && res.rows ? res.rows : [];
                that.objects = {};
                for (let i of res)
                    that.objects[i.doc._id] = i.doc;
                if (that.objects['system.config'] && that.objects['system.config'].common.language)
                    adapter.config.lang = that.objects['system.config'].common.language;
                if (that.objects['system.config'] && that.objects['system.config'].common.latitude) {
                    adapter.config.latitude = parseFloat(that.objects['system.config'].common.latitude);
                    adapter.config.longitude = parseFloat(that.objects['system.config'].common.longitude);
                }
                return res.length;
            }, err => that.E('err from getObjectList: ' + err, 'no'))
            .then(len => that.D(`${adapter.name} received ${len} objects with config ${Object.keys(adapter.config)}`))
            .catch(err => that.W(`Error in adapter.ready: ${err}`))
            .then(() => {
                if (that._stateChange) adapter.subscribeStates('*');
                if (that._objChange) adapter.subscribeObjects('*');
            });
    };

    that.changeState = function (id, value, ack, always) {
        assert(typeof id === 'string', 'changeState (id,,,) error: id is not a string!');
        always = always === undefined ? false : !!always;
        ack = ack === undefined ? true : !!ack;
        return that.getState(id)
            .then(st => st && !always && st.val == value && st.ack == ack ? Promise.resolve() : that.setState(id, value, ack))
            .catch(err => that.W(`Error in that.setState(${id},${value},${ack}): ${err}`, that.setState(id, value, ack)));
    };

    that.makeState = function (ido, value, ack) {
//        that.D(`Make State ${that.O(ido)} and set value to:${that.O(value)} ack:${ack}`); ///TC
        ack = ack === undefined || !!ack;
        let id = ido;
        if (typeof id === 'string')
            ido = id.endsWith('Percent') ? {
                unit: "%"
            } : {};
        else if (typeof id.id === 'string') {
            id = id.id;
        } else return Promise.reject(that.W(`Invalid makeState id: ${that.O(id)}`));
        if (that.states[id])
            return that.changeState(id, value, ack);
        that.D(`Make State ${id} and set value to:${that.O(value)} ack:${ack}`); ///TC
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

        for (let i in ido)
            if (i == 'native') {
                st.native = st.native || {};
                for (let j in ido[i])
                    st.native[j] = ido[i][j];
            } else if (i != 'id' && i != 'val')
            st.common[i] = ido[i];
        //        that.I(`will create state:${id} with ${that.O(st)}`);
        return that.extendObject(id, st, null)
            .then(x => that.states[id] = x)
            .then(() => st.common.state == 'state' ? that.changeState(id, value, ack) : Promise.resolve())
            .catch(err => that.D(`MS ${that.O(err)}`, id));
    };

    that.processMessage = (obj) => {
        (obj && obj.command ?
            that._messages(obj) :
            Promise.resolve(that._messages(that.W(`invalid Message ${obj}`, obj))))
        .then(res => that.c2p(adapter.getMessage)().then(obj => obj ? that.processMessage(obj) : res));
    };

    that.stop = (dostop, callback) => {
        that._stopping = true;
        if (that._timer)
            clearInterval(that._timer);
        that._timer = null;
        that.D(`Adapter disconnected and stopped with dostop(${dostop}) and callback(${!!callback})`);
        Promise.resolve(that._unload ? that._unload(dostop) : null)
            .then(() => callback && callback())
            .catch(() => that.W('catch stop.'))
            .then(() => dostop ? that.E("Adapter will exit in lates 2 sec!", setTimeout(process.exit, 2000, 55)) : null);
    };

    adapter.on('message', (obj) => that.processMessage(that.I(`received Message ${that.O(obj)}`, obj)))
        .on('unload', (callback) => that.stop(false, callback))
        .on('ready', () => that.initAdapter().then(() => that._main()))
        .on('objectChange', (id, obj) => obj && obj._id && that._objChange ? that._objChange(id, obj) : null)
        .on('stateChange', (id, state) => state && state.from != 'system.adapter.' + that.ains && that._stateChange ?
            that._stateChange(that.D(`stateChange called for${id} = ${that.O(state)}`, id), state) : null);

    Object.defineProperty(MyAdapter.prototype, "messages", {
        get: () => this._messages,
        set: (y) => this._messages = (assert(typeof y === 'function', 'Error: messages handler not a function!'), y)
    });

    Object.defineProperty(MyAdapter.prototype, "stateChange", {
        get: () => this._stateChange,
        set: (y) => this._stateChange = (assert(typeof y === 'function', 'Error: StateChange handler not a function!'), y)
    });

    Object.defineProperty(MyAdapter.prototype, "objChange", {
        get: () => this._objChange,
        set: (y) => this._objChange = (assert(typeof y === 'function', 'Error: ObjectChange handler not a function!'), y)
    });

    Object.defineProperty(MyAdapter.prototype, "unload", {
        get: () => this._unload,
        set: (y) => this._unload = (assert(typeof y === 'function', 'Error: unload handler not a function!'), y)
    });

    Object.defineProperty(MyAdapter.prototype, "debug", {
        get: () => this._debug,
        set: (y) => this._debug = y,
    });

    return this;
}

module.exports = MyAdapter;