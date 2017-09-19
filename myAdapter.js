/**
 *      iobroker MyAdapter class
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
// jshint es6: true, node: true, esversion: 6, strict: global, undef: true, unused: true
"use strict";
const util = require('util'),
    http = require('http'),
    https = require('https'),
    exec = require('child_process').exec,
    assert = require('assert');

var adapter, that, main, messages, timer, stateChange, objChange, unload, name, stopping = false,
    inDebug = false,
    objects = {},
    states = {};

const slog = (adapter, log, text) => adapter && adapter.log && typeof adapter.log[log] === 'function' ?
    adapter.log[log](text) :
    console.log(log + ': ' + text);

function processMessage(obj) {
    return (obj.command === 'debug' ? Promise.resolve(`debug set to '${inDebug = MyAdapter.parseLogic(obj.message)}'`) : messages(obj))
        .then(res => MyAdapter.I(`Message from '${obj.from}', command '${obj.command}', message '${obj.message}' executed with result:'${res}'`, res),
            err => MyAdapter.W(`invalid Message ${MyAdapter.O(obj)} caused error ${MyAdapter.O(err)}`, err))
        .then(res => obj.callback ? adapter.sendTo(obj.from, obj.command, res, obj.callback) : undefined)
        .then(() => MyAdapter.c2p(adapter.getMessage)().then(obj => obj ? processMessage(obj) : true));
}

function initAdapter() {
    states = {};
    MyAdapter.D(`Adapter ${MyAdapter.ains} starting.`);
    MyAdapter.getObjectList = MyAdapter.c2p(adapter.objects.getObjectList);
    MyAdapter.getForeignState = MyAdapter.c2p(adapter.getForeignState);
    MyAdapter.getState = MyAdapter.c2p(adapter.getState);
    MyAdapter.setState = MyAdapter.c2p(adapter.setState);

    return (!adapter.config.forceinit ?
            Promise.resolve({
                rows: []
            }) :
            MyAdapter.getObjectList({
                startkey: MyAdapter.ain,
                endkey: MyAdapter.ain + '\u9999'
            }))
        .then(res => MyAdapter.seriesOf(res.rows, (i) => MyAdapter.removeState(MyAdapter.D('deleteState: ' + i.doc.common.name, i.doc.common.name)), 2))
        .then(res => res, err => MyAdapter.E('err from MyAdapter.series: ' + err))
        .then(() => MyAdapter.getObjectList({
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
        }, err => MyAdapter.E('err from getObjectList: ' + err, 'no'))
        .then(len => MyAdapter.D(`${adapter.name} received ${len} objects with config ${Object.keys(adapter.config)}`))
        .catch(err => MyAdapter.W(`Error in adapter.ready: ${err}`))
        .then(() => {
            if (stateChange) adapter.subscribeStates('*');
            if (objChange) adapter.subscribeObjects('*');
        });
}

function MyAdapter(adapter, main) {
    if (adapter && main)
        MyAdapter.init(adapter, main)
    return MyAdapter;
}

MyAdapter.init = function MyAdapterInit(ori_adapter, ori_main) {
    assert(!adapter, `myAdapter:(${ori_adapter.name}) defined already!`);
    adapter = ori_adapter;
    assert(adapter && adapter.name, 'myAdapter:(adapter) no adapter here!');
    name = adapter.name;
    main = typeof ori_main === 'function' ? ori_main : () => MyAdapter.W(`No 'main() defined for ${adapter.name}!`);
    messages = (mes) => Promise.resolve(MyAdapter.W(`Message ${MyAdapter.O(mes)} received and no handler defined!`));

    MyAdapter.getForeignObject = MyAdapter.c2p(adapter.getForeignObject);
    MyAdapter.setForeignObject = MyAdapter.c2p(adapter.setForeignObject);
    MyAdapter.getForeignObjects = MyAdapter.c2p(adapter.getForeignObjects);
    MyAdapter.getObject = MyAdapter.c2p(adapter.getObject);
    MyAdapter.deleteState = (id) => MyAdapter.c1pe(adapter.deleteState)(id).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
    MyAdapter.delObject = (id, opt) => MyAdapter.c1pe(adapter.delObject)(id, opt).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
    MyAdapter.delState = (id, opt) => MyAdapter.c1pe(adapter.delState)(id, opt).catch(res => res == 'Not exists' ? Promise.resolve() : Promise.reject(res));
    MyAdapter.removeState = (id, opt) => MyAdapter.delState(id, opt).then(() => MyAdapter.delObject((delete MyAdapter.states[id], id), opt));
    MyAdapter.setObject = MyAdapter.c2p(adapter.setObject);
    MyAdapter.createState = MyAdapter.c2p(adapter.createState);
    MyAdapter.extendObject = MyAdapter.c2p(adapter.extendObject);

    adapter.on('message', (obj) => !!obj ? processMessage(
            MyAdapter.D(`received Message ${MyAdapter.O(obj)}`, obj)) : true)
        .on('unload', (callback) => MyAdapter.stop(false, callback))
        .on('ready', () => initAdapter().then(() => main()))
        .on('objectChange', (id, obj) => obj && obj._id && objChange ? objChange(id, obj) : null)
        .on('stateChange', (id, state) => state && state.from != 'system.adapter.' + MyAdapter.ains && stateChange ?
            stateChange(MyAdapter.D(`stateChange called for ${id} = ${MyAdapter.O(state)}`, id), state) : null);

    return that;
};

MyAdapter.J = function ( /** string */ str, /** function */ reviewer) {
    let res;
    try {
        res = JSON.parse(str, reviewer);
    } catch (e) {
        res = {
            error: e,
            error_description: `${e} on string ${str}`
        };
    }
    return res;
};

MyAdapter.nop = obj => obj;
MyAdapter.D = (str, val) => (inDebug ?
    slog(adapter, 'info', `<span style="color:darkblue;">debug: ${str}</span>`) :
    slog(adapter, 'debug', str), val !== undefined ? val : str);
MyAdapter.I = (l, v) => (slog(adapter, 'info', l), v === undefined ? l : v);
MyAdapter.W = (l, v) => (slog(adapter, 'warn', l), v === undefined ? l : v);
MyAdapter.E = (l, v) => (slog(adapter, 'error', l), v === undefined ? l : v);

Object.defineProperty(MyAdapter, "debug", {
    get: () => inDebug,
    set: (y) => inDebug = y,
});
Object.defineProperty(MyAdapter, "messages", {
    get: () => messages,
    set: (y) => messages = (assert(typeof y === 'function', 'Error: messages handler not a function!'), y)
});

Object.defineProperty(MyAdapter, "stateChange", {
    get: () => stateChange,
    set: (y) => stateChange = (assert(typeof y === 'function', 'Error: StateChange handler not a function!'), y)
});

Object.defineProperty(MyAdapter, "objChange", {
    get: () => objChange,
    set: (y) => objChange = (assert(typeof y === 'function', 'Error: ObjectChange handler not a function!'), y)
});

Object.defineProperty(MyAdapter, "unload", {
    get: () => unload,
    set: (y) => unload = (assert(typeof y === 'function', 'Error: unload handler not a function!'), y)
});

Object.defineProperty(MyAdapter, "name", {
    get: () => name
});

Object.defineProperty(MyAdapter, "states", {
    get: () => states
});

Object.defineProperty(MyAdapter, "aObjects", {
    get: () => adapter.objects
});

Object.defineProperty(MyAdapter, "objects", {
    get: () => objects,
    set: (y) => objects = y
});

Object.defineProperty(MyAdapter, "ains", {
    get: () => name + '.' + adapter.instance
});

Object.defineProperty(MyAdapter, "ain", {
    get: () => MyAdapter.ains + '.'
});

Object.defineProperty(MyAdapter, "C", {
    get: () => adapter.config
});

MyAdapter.parseLogic = (obj) => MyAdapter.includes(['0', 'off', 'aus', 'false', 'inactive'], obj.toString().trim().toLowerCase()) ? 
    false : MyAdapter.includes(['1', '-1', 'on', 'ein', 'true', 'active'], obj.toString().trim().toLowerCase());
MyAdapter.clone = (obj) => JSON.parse(JSON.stringify(obj));
MyAdapter.wait = (time, arg) => new Promise(res => setTimeout(res, time, arg));
MyAdapter.F = (obj) => obj;
MyAdapter.O = (obj, level) => util.inspect(obj, false, level || 2, false).replace(/\n/g, ' ');
MyAdapter.N = (fun) => setTimeout.apply(null, [fun, 0].concat(Array.prototype.slice.call(arguments, 1))); // move fun to next schedule keeping arguments
MyAdapter.T = (i) => {
    let t = typeof i;
    if (t === 'object') {
        if (Array.isArray(i)) t = 'array';
        else if (i instanceof RegExp) t = 'regexp';
        else if (i === null) t = 'null';
    } else if (t === 'number' && isNaN(i)) t = 'NaN';
    return t;
};
MyAdapter.locDate = (date) => date instanceof Date ?
    new Date(date.getTime() - date.getTimezoneOffset() * 60000) :
    typeof date === 'string' ?
    new Date(Date.parse(date) - (new Date().getTimezoneOffset()) * 60000) :
    !isNaN(+date) ?
    new Date(+date - (new Date().getTimezoneOffset()) * 60000) :
    new Date(Date.now() - (new Date().getTimezoneOffset()) * 60000);
MyAdapter.dateTime = (date) => MyAdapter.locDate(date).toISOString().slice(0, -5).replace('T', '@');
MyAdapter.obToArray = (obj) => (Object.keys(obj).map(i => obj[i]));
MyAdapter.includes = function (obj, value) {
    switch (MyAdapter.T(obj)) {
        case 'object':
            return obj[value] !== undefined;
        case 'array':
            for (var i of obj)
                if (i === value)
                    return true;
        default:
            return obj === value;
    }
}

MyAdapter.stop = (dostop, callback) => {
    if (stopping) return;
    stopping = true;
    if (timer)
        clearInterval(timer);
    timer = null;
    MyAdapter.D(`Adapter disconnected and stopped with dostop(${dostop}) and callback(${!!callback})`);
    Promise.resolve(unload ? unload(dostop) : null)
        .then(() => callback && callback())
        .catch(MyAdapter.W)
        .then(() => dostop ? MyAdapter.E("Adapter will exit in lates 2 sec!", setTimeout(process.exit, 2000, 55)) : null);
};

MyAdapter.seriesOf = (obj, promfn, delay) => { // fun gets(item) and returns a promise
    assert(typeof promfn === 'function', 'series(obj,promfn,delay) error: promfn is not a function!');
    delay = parseInt(delay);
    let p = Promise.resolve();
    const nv = [],
        f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => MyAdapter.wait(delay, nv.push(res)))) :
        (k) => p = p.then(() => promfn(k));
    for (let item of obj)
        f(item);
    return p.then(() => nv);
};

MyAdapter.seriesIn = (obj, promfn, delay) => { // fun gets(item,object) and returns a promise
    assert(typeof promfn === 'function', 'series(obj,promfn,delay) error: promfn is not a function!');
    delay = parseInt(delay);
    let p = Promise.resolve();
    const nv = [],
        f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => MyAdapter.wait(delay, nv.push(res)))) :
        (k) => p = p.then(() => promfn(k));
    for (let item in obj)
        f(item, obj);
    return p.then(() => nv);
};

MyAdapter.c2p = (f) => {
    assert(typeof f === 'function', 'c2p (f) error: f is not a function!');
    return function () {
        const args = Array.prototype.slice.call(arguments);
        return new Promise((res, rej) => (args.push((err, result) => (err && rej(err)) || res(result)), f.apply(this, args)));
    };
};

MyAdapter.c1p = (f) => {
    assert(typeof f === 'function', 'c1p (f) error: f is not a function!');
    return function () {
        const args = Array.prototype.slice.call(arguments);
        return new Promise(res => (args.push((result) => res(result)), f.apply(this, args)));
    };
};

MyAdapter.c1pe = (f) => { // one parameter != null = error
    assert(typeof f === 'function', 'c1pe (f) error: f is not a function!');
    return function () {
        const args = Array.prototype.slice.call(arguments);
        return new Promise((res, rej) => (args.push((result) => !result ? res(result) : rej(result)), f.apply(this, args)));
    };
};

MyAdapter.retry = (nretry, fn, arg) => {
    assert(typeof fn === 'function', 'retry (,fn,) error: fn is not a function!');
    nretry = parseInt(nretry);
    return fn(arg).catch(err => {
        if (nretry <= 0)
            throw err;
        return MyAdapter.retry(nretry - 1, fn, arg);
    });
};

MyAdapter.while = ( /** function */ fw, /** function */ fn, /** number */ time) => {
    assert(typeof fw === 'function' && typeof fn === 'function', 'retry (fw,fn,) error: fw or fn is not a function!');
    time = parseInt(time) || 1;
    return !fw() ? Promise.resolve(true) :
        fn().then(() => true, () => true)
        .then(() => MyAdapter.wait(time))
        .then(() => MyAdapter.while(fw, fn, time));
};

MyAdapter.repeat = ( /** number */ nretry, /** function */ fn, arg) => {
    assert(typeof fn === 'function', 'repeat (,fn,) error: fn is not a function!');
    nretry = parseInt(nretry);
    return fn(arg).
    then(res => Promise.reject(res))
        .catch(res => nretry <= 0 ? Promise.resolve(res) : MyAdapter.repeat(nretry - 1, fn, arg));
};

MyAdapter.exec = (command) => {
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

MyAdapter.get = (url, retry) => { // get a web page either with http or https and return a promise for the data, could be done also with request but request is now an external package and http/https are part of nodejs.
    const fun = typeof url === 'string' && url.trim().toLowerCase().startsWith('https') ||
        url.protocol == 'https' ? https.get : http.get;
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
    })).catch(err => !retry ? Promise.reject(err) : MyAdapter.wait(100, retry - 1).then(a => MyAdapter.get(url, a)));
};

MyAdapter.changeState = function (id, value, ack, always) {
    assert(typeof id === 'string', 'changeState (id,,,) error: id is not a string!');
    always = always === undefined ? false : !!always;
    ack = ack === undefined ? true : !!ack;
    return MyAdapter.getState(id)
        .then(st => st && !always && st.val == value && st.ack == ack ? Promise.resolve() : MyAdapter.setState(id, value, ack))
        .catch(err => MyAdapter.W(`Error in MyAdapter.setState(${id},${value},${ack}): ${err}`, MyAdapter.setState(id, value, ack)));
};

MyAdapter.makeState = function (ido, value, ack) {
    //        MyAdapter.D(`Make State ${MyAdapter.O(ido)} and set value to:${MyAdapter.O(value)} ack:${ack}`); ///TC
    ack = ack === undefined || !!ack;
    let id = ido;
    if (typeof id === 'string')
        ido = id.endsWith('Percent') ? {
            unit: "%"
        } : {};
    else if (typeof id.id === 'string') {
        id = id.id;
    } else return Promise.reject(MyAdapter.W(`Invalid makeState id: ${MyAdapter.O(id)}`));
    if (MyAdapter.states[id])
        return MyAdapter.changeState(id, value, ack);
    //    MyAdapter.D(`Make State ${id} and set value to:${MyAdapter.O(value)} ack:${ack}`); ///TC
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
    //    MyAdapter.I(`will create state:${id} with ${MyAdapter.O(st)}`);
    return MyAdapter.extendObject(id, st, null)
        .then(x => MyAdapter.states[id] = x)
        .then(() => st.common.state == 'state' ? MyAdapter.changeState(id, value, ack) : true)
        .catch(err => MyAdapter.D(`MS ${MyAdapter.O(err)}`, id));
};

module.exports = MyAdapter;