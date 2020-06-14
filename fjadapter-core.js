/* eslint-disable no-prototype-builtins */
/**
 *      iobroker MyAdapter II class 
 *      (c) 2020- <frankjoke@hotmail.com>
 *      MIT License
 * 
 *  V 0.2.0 Mai 2020
 */
"use strict";

//@ts-disable TS80006
//@js-disable TS80006
class Mcore {
	construnctor(options) {
		console.log("Mcore:", options);
	}

}
let acore = {
	Adapter: Mcore
};

if (process.env.fjadapter != 'TESTING')
	acore = require("@iobroker/adapter-core");


class CacheP {
	constructor(fun, delay) { // neue EintrÃ¤ge werden mit dieser Funktion kreiert
		if (typeof fun != "function")
			throw "CacheP needs an async function returning a Promise as first argument!";
		this._cache = {};
		this._fun = fun;
		this._delay = delay || 0;
		return this;
	}

	async cacheItem(item, prefereCache = true, fun) {
		fun = fun || this._fun;
		if (this._delay)
			await new Promise(res => setTimeout(() => res(), this._delay));
		if (prefereCache && this._cache[item] !== undefined)
			return this._cache[item];
		if (!fun)
			fun = this._fun;
		// assert(A.T(fun) === 'function', `checkItem needs a function to fill cache!`);
		const res = await fun(item);
		this._cache[item] = res;
		return res;
	}

	isCached(x) {
		return this._cache[x] !== undefined;
	}
	clearCache() {
		this._cache = {};
	}
	get cache() {
		return this._cache;
	}
	cacheSync(item, prefereCache = true, fun) {
		const cached = this.isCached(item);
		if (cached && prefereCache)
			return this._cache[item];
		fun = fun || this._fun;
		if (typeof fun == "function") try {
			const res = fun(item);
			if (res) {
				this._cache[item] = res;
				return res;
			}
		} finally {
			// empty
		}

		return null;
	}
}

class HrTime {
	constructor(time) {
		this._stime = time ? time : process.hrtime();
	}

	get diff() {
		return process.hrtime(this._stime);
	}

	get text() {
		const t = this.diff;
		const ns = t[1].toString(10);
		return t[0].toString(10) + '.' + ('0'.repeat(9 - ns.length) + ns).slice(0, 6);

	}

	get time() {
		return Number(this.text);
	}

	set time(t) {
		this._stime = t || process.hrtime();
	}
}

class Sequence {
	constructor(p, delay) {
		this._p = p ? p : Promise.resolve();
		this._delay = delay || 0;
		return this;
	}
	get p() {
		return this._p;
	}
	set p(val) {
		this.add(val);
		return val;
	}

	add(val, ...args) {
		const fun = typeof val === 'function' ? val : () => val;
		if (this._delay) {
			const n = () => new Promise(res => setTimeout(() => res(), this._delay));
			this._p = this._p.then(() => n(), () => n());
		}
		this._p = this._p.then(() => fun(...args), () => fun(...args));
		return this;
	}

	async then(res, rej) {
		return this._p = this._p.then(res, rej);
	} catch (rej) {
		return this._p = this._p.then(x => x, rej);
	}

}


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const util = require("util"),
	exec = require("child_process").exec,
	os = require("os"),
	assert = require("assert"),
	axios = require("axios");

const objects = {},
	stq = new Sequence(),
	states = {},
	createdStates = {},
	sstate = {},
	mstate = {};


let adapter, aoptions, aname, amain, timer,
	stopping = false,
	inDebug = false,
	curDebug = 1,
	// allStates = null,
	// stateChange = null,
	systemconf = null;
let messages = (mes) => Promise.resolve(MyAdapter.W(`Message ${this.O(mes)} received and no handler defined!`));

function slog(log, text) {
	if (inDebug === undefined)
		return text;
	return adapter && adapter.log && typeof adapter.log[log] === "function" ?
		// eslint-disable-next-line no-console
		adapter.log[log](text) : console.log(log + ": " + text);
}

function addSState(n, id) {
	if (!mstate[n]) {
		if (sstate[n] && sstate[n] !== id) {
			sstate[id] = id;
			mstate[n] = [id];
			delete sstate[n];
		} else
			sstate[n] = id;
	} else {
		mstate[n].push(id);
		sstate[id] = id;
	}
}


class IobAdapter extends acore.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super(options);
		this.on("ready", this.onReady.bind(this));
		this.on("objectChange", this.onObjectChange.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this._stateChange = options.stateChange;
		this._objChange = options.objChange;
		this._onStop = options.onStop;
		this._onUnload = options.onUnload;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		MyAdapter.extendObject = adapter.extendObjectAsync.bind(adapter);

		await MyAdapter.initAdapter();
		await Promise.resolve(amain(this));
	}
	/* Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	async onUnload(callback) {
		try {
			await Promise.resolve(this._onUnload ? this._onUnload(null) : null).catch(e => this.Wf(e));
			MyAdapter.stop(null, callback);
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		//		MyAdapter.Df("Object %s was changed top %O", id, obj);
		if (typeof this._objChange == "function")
			setTimeout(() => this._objChange(id, obj), 0);
		if (obj) {
			// The object was changed
			objects[id] = obj;
			//			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else if (id) {
			// The object was deleted
			if (states[id])
				delete states[id];
			if (sstate[id])
				delete sstate[id];
			if (objects[id])
				delete objects[id];
			//			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		//		MyAdapter.Df("State %s was changed top %O", id, state);
		if (this._stateChange && (!state || state.from !== 'system.adapter.' + this.ains))
			setImmediate(() => this._stateChange(id, state).catch(err => this.W(`Error in StateChange for ${id} = ${this.O(err)}`)));
		// if (allStates) 
		// 	allStates(id, state).catch(e => this.W(`Error in AllStates for ${id} = ${this.O(e)}`)));
		if (state) {
			states[id] = state;
			// The state was changed
			//			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else if (id) {
			// The state was deleted
			delete states[id];
			delete sstate[id];
			//			this.log.info(`state ${id} deleted`);
		}
	}

	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	onMessage(obj) {
		if (typeof obj === "object" && obj.message) {
			if (obj.command === "send") {
				// e.g. send email or pushover or whatever
				this.log.info("send command");

				// Send response in callback if required
				if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
			}
		}
	}

}

class MyAdapter {

	static get config() {
		return adapter.config;
	}

	static processMessage(obj) {
		return (obj.command === "debug" ? this.resolve(`debug set to '${inDebug = isNaN(parseInt(obj.message)) ?  this.parseLogic(obj.message) : parseInt(obj.message)}'`) : messages(obj))
			.then(res => this.D(`Message from '${obj.from}', command '${obj.command}', message '${this.S(obj.message)}' executed with result:"${this.S(res)}"`, res),
				err => this.W(`invalid Message ${this.O(obj)} caused error ${this.O(err)}`, err))
			.then(res => obj.callback ? adapter.sendTo(obj.from, obj.command, res, obj.callback) : undefined)
			.then(() => this.c2p(adapter.getMessage)().then(obj => obj ? this.processMessage(obj) : true));
	}

	static async getObjects(name) {
		name = !name ? "" : name;
		const opt = {
			include_docs: true
		};
		if (name) {
			name = name === "*" ? "" : name;
			opt.startkey = (name.startsWith("system.") ? "" : this.ain) + name;
			opt.endkey = (name.startsWith("system.") ? "" : this.ain) + name + "\u9999";
		}
		return adapter.getObjectListAsync(opt).then(res => res && res.rows ? res.rows : [], () => []);

	}

	static async initAdapter() {
		try {
			this.Df("Adapter %s starting.", this.ains);
			this.getObjectList = adapter.getObjectListAsync ?
				adapter.getObjectListAsync.bind(adapter) :
				this.c2p(adapter.objects.getObjectList).bind(adapter.objects);
			this.getForeignState = adapter.getForeignStateAsync.bind(adapter);
			this.setForeignState = adapter.setForeignStateAsync.bind(adapter);
			this.getState = adapter.getStateAsync.bind(adapter);
			this.setState = adapter.setStateAsync.bind(adapter);
			this.getStates = adapter.getStatesAsync.bind(adapter);
			this.removeState = async (id, opt) => {
				await adapter.delStateAsync(id, opt).catch(this.nop);
				await adapter.delObjectAsync((delete states[id], id), opt).catch(this.nop);
			};
			const ms = await adapter.getStatesAsync("*").catch(err => this.W(err));
			for (const s of Object.keys(ms))
				states[s] = ms[s];
			//			console.log(states);
			let res = await this.getObjects("*");
			const len = res.length;
			for (const i of res) {
				const o = i.doc;
				objects[o._id] = o;
				if (o.type === "state" && o.common && o.common.name) {
					if (adapter.config.forceinit && o._id.startsWith(this.ain))
						await this.removeState(o.common.name);
					//                    if (!o._id.startsWith('system.adapter.'))
					addSState(o.common.name, o._id);
				}
			}
			res = await adapter.getForeignObjectAsync("system.config").catch(() => null);
			if (res) {
				systemconf = res.common;
				//                    this.If('systemconf: %O', systemconf);
				if (systemconf && systemconf.language)
					adapter.config.lang = systemconf.language;
				if (systemconf && systemconf.latitude) {
					adapter.config.latitude = parseFloat(systemconf.latitude);
					adapter.config.longitude = parseFloat(systemconf.longitude);
				}
				//                if (adapter.config.forceinit)
				//                    this.seriesOf(res, (i) => this.removeState(i.doc.common.name), 2)
				//                this.If('loaded adapter config: %O', adapter.config);
			}
			res = await adapter.getForeignObjectAsync("system.adapter." + this.ains).catch(() => null);
			if (res) {
				adapter.config.adapterConf = res.common;
				//                    this.If('adapterconf = %s: %O', 'system.adapter.' + this.ains, adapterconf);
				//                    this.If('adapter: %O', adapter);
				if (adapter.config.adapterConf && adapter.config.adapterConf.loglevel)
					adapter.config.loglevel = adapter.config.adapterConf.loglevel;
				if (adapter.config.loglevel === "debug" || adapter.config.loglevel === "silly")
					this.debug = true;
				//                    this.If('loglevel: %s, debug: %s', adapter.config.loglevel, MyAdapter.debug);
				//                if (adapter.config.forceinit)
				//                    this.seriesOf(res, (i) => this.removeState(i.doc.common.name), 2)
				//                this.If('loaded adapter config: %O', adapter.config);
			}
			MyAdapter.D(`${adapter.name} received ${len} objects and ${this.ownKeys(states).length} states, with config ${this.ownKeys(adapter.config)}`);
			adapter.subscribeStates("*");
			if (adapter._objChange) adapter.subscribeObjects("*");
			//                .then(() => objChange ? MyAdapter.c2p(adapter.subscribeObjects)('*').then(a => MyAdapter.I('eso '+a),a => MyAdapter.I('eso '+a)) : MyAdapter.resolve())
			this.I(aname + " initialization started...");
			//			process.on('rejectionHandled', (reason, promise) => this.Wr(true, 'Promise problem rejectionHandled of Promise %s with reason %s', promise, reason));
			//			process.on('unhandledRejection', (reason, promise) => this.Wr(true, 'Promise problem unhandledRejection of Promise %O with reason %O', promise, reason));
		} catch (e) {
			this.stop(this.E(aname + " Initialization Error:" + this.F(e)));
		}
	}

	static init(amodule, options, ori_main) {
		//        assert(!adapter, `myAdapter:(${ori_adapter.name}) defined already!`);
		if (typeof ori_main !== "function")
			throw "No main function defined!";
		amain = ori_main;
		if (typeof options === "string")
			options = {
				name: options
			};
		aoptions = Object.assign({}, options);
		aname = aoptions.name;
		if (amodule && amodule.parent) {
			amodule.exports = (options) => (adapter = new IobAdapter(options));
		} else {
			adapter = new IobAdapter(aoptions);
		}
	}

	static get AI() {
		return adapter;
	}
	/* 
    static init2() {
        //            if (adapter) this.If('adpter: %O',adapter);
        assert(adapter && adapter.name, 'myAdapter:(adapter) no adapter here!');
        aname = adapter.name;

        inDebug = timer = stopping = false;
        curDebug = 1;
        systemconf = null;
        objects = {};
        states = {};
        stq = new Sequence();
        sstate = {};
        mstate = {};

        this.writeFile = this.c2p(fs.writeFile);
        this.readFile = this.c2p(fs.readFile);
        this.getForeignObject = adapter.getForeignObjectAsync.bind(adapter);
        this.setForeignObject = adapter.setForeignObjectAsync.bind(adapter);
        this.getForeignObjects = adapter.getForeignObjectsAsync.bind(adapter);
        this.getObject = adapter.getObjectAsync.bind(adapter);
        this.deleteState = (id) => adapter.deleteStateAsync(id).catch(res => res === 'Not exists' ? this.resolve() : this.reject(res));
        this.delObject = (id, opt) => adapter.delObjectAsync(id, opt).catch(res => res === 'Not exists' ? this.resolve() : this.reject(res));
        this.delState = (id, opt) => adapter.delStateAsync(id, opt).catch(res => res === 'Not exists' ? this.resolve() : this.reject(res));
        this.removeState = (id, opt) => adapter.delStateAsync(id, opt).then(() => this.delObject((delete states[id], id), opt));
        this.setObject = adapter.setObjectAsync.bind(adapter);
        this.createState = adapter.createStateAsync.bind(adapter);
        this.extendObject = adapter.extendObjectAsync.bind(adapter);
        this.extendForeignObject = adapter.extendForeignObjectAsync.bind(adapter);

        //        adapter.removeAllListeners();
        process.on('rejectionHandled', (reason, promise) => this.Wr(true, 'Promise problem rejectionHandled of Promise %s with reason %s', promise, reason));
        process.on('unhandledRejection', (reason, promise) => this.Wr(true, 'Promise problem unhandledRejection of Promise %O with reason %O', promise, reason));


        adapter.on('message', obj => obj && this.processMessage(this.D(`received Message ${this.O(obj)}`, obj)))
            .on('unload', callback => this.stop(false, callback))
            .on('ready', () => this.resolve().then(() => this.initAdapter()).then(() => setImmediate(amain), e => this.Ef('Adapter Error, stop: %O', e)))
            .on('objectChange', (id, obj) => obj && obj._id && objChange && setTimeout((id, obj) => objChange(id, obj), 0, id, obj))
            .on('stateChange', (id, state) => setTimeout((id, state) => {
                (state && stateChange && state.from !== 'system.adapter.' + this.ains ?
                    stateChange(id, state).catch(err => this.W(`Error in StateChange for ${id} = ${this.O(err)}`)) :
                    Promise.resolve())
                .then(() => allStates && allStates(id, state).catch(e => this.W(`Error in AllStates for ${id} = ${this.O(e)}`)))
                    .then(() => states[id] = state);
            }, 0, id, state));

        return adapter;
    }
 */
	static idName(id) {
		if (objects[id] && objects[id].common)
			return objects[id].common.name; // + '(' + id + ')';
		if (sstate[id] && sstate[id] !== id)
			return id; // + '(' + sstate[id] + ')';
		return id; // +'(?)';           
	}

	static J( /** string */ str, /** function */ reviewer, ) {
		let res;
		if (!str)
			return str;
		if (typeof str !== "string")
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

	static pE(x, y) {
		y = y ? y : MyAdapter.pE;

		function get() {
			const oldLimit = Error.stackTraceLimit;
			Error.stackTraceLimit = Infinity;
			const orig = Error.prepareStackTrace;
			Error.prepareStackTrace = function (_, stack) {
				return stack;
			};
			const err = new Error("Test");
			Error.captureStackTrace(err, y);
			const stack = err.stack;
			Error.prepareStackTrace = orig;
			Error.stackTraceLimit = oldLimit;
			return stack.map(site => site.getFileName() ? (site.getFunctionName() || "anonymous") + " in " + site.getFileName() + " @" + site.getLineNumber() + ":" + site.getColumnNumber() : "");
		}

		MyAdapter.Wf("Promise failed @ %O error: %o", get().join("; "), x);
		return x;
	}

	static nop(obj) {
		return obj;
	}
	static split(x, s) {
		return this.trim((typeof x === "string" ? x : `${x}`).split(s));
	}
	static trim(x) {
		return Array.isArray(x) ? x.map(this.trim) : typeof x === "string" ? x.trim() : `${x}`.trim();
	}

	/* 	static A(arg) {
			if (!arg)
				this.E(this.f.apply(null, Array.prototype.slice.call(arguments, 1)));
			assert.apply(null, arguments);
		}
	 */
	static D(str, val) {
		if (!inDebug || curDebug > Number(inDebug))
			return val !== undefined ? val : str;
		return (inDebug ?
			slog("info", `debug: ${str}`) :
			slog("debug", str), val !== undefined ? val : str);
	}

	static Dr(str) {
		if (!inDebug && curDebug > Number(inDebug))
			return str;
		else {
			const s = this.f.apply(null, Array.prototype.slice.call(arguments, 1));
			if (inDebug)
				slog("info", `debug: ` + s);
			else
				slog("debug", s);

		}
		return str;
	}
	static Df(...str) {
		if (!(!inDebug && curDebug > Number(inDebug))) {
			str = this.f(...str);
			return inDebug ? slog("info", "debug: " + str) : slog("debug", str);
		}
	}
	static F() {
		return util.format.apply(null, arguments);
	}
	static f() {
		return util.format.apply(null, arguments).replace(/\n\s+/g, " ");
	}
	static I(l, v) {
		return (slog("info", l), v === undefined ? l : v);
	}

	static Ir(ret) {
		slog("info", this.f.apply(null, Array.prototype.slice.call(arguments, 1)));
		return ret;
	}
	static If() {
		return slog("info", this.f.apply(null, arguments));
	}

	static Wf() {
		return slog("warn", this.f.apply(null, arguments));
	}
	static Wr(ret) {
		slog("warn", this.f.apply(null, Array.prototype.slice.call(arguments, 1)));
		return ret;
	}
	static Er(ret) {
		slog("error", this.f.apply(null, Array.prototype.slice.call(arguments, 1)));
		return ret;
	}

	static W(l, v) {
		return (slog("warn", l), v === undefined ? l : v);
	}
	static E(l, v) {
		return (slog("error", l), v === undefined ? l : v);
	}

	static Ef() {
		return slog("error", this.f.apply(null, arguments));
	}

	static toNumber(v) {
		return isNaN(Number(v)) ? 0 : Number(v);
	}

	static toInteger(v) {
		return parseInt(this.toNumber(v));
	}


	static set addq(promise) {
		stq.p = promise;
		return stq;
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
		assert(typeof y === "function", "Error: messages handler not a function!");
		messages = y;
	}
	// static get stateChange() {
	// 	return stateChange;
	// }
	// static set stateChange(y) {
	// 	stateChange = (assert(typeof y === "function", "Error: StateChange handler not a function!"), y);
	// }
	// static get allStates() {
	// 	return allStates;
	// }
	// static set allStates(y) {
	// 	allStates = (assert(typeof y === "function", "Error: StateChange handler not a function!"), y);
	// }
	static get name() {
		return aname;
	}
	static get states() {
		return states;
	}
	static get adapter() {
		return adapter;
	}
	static get aObjects() {
		return adapter.objects;
	}
	static get objects() {
		return objects;
	}
	static get debugLevel() {
		return curDebug;
	}
	static set debugLevel(y) {
		curDebug = y;
	}
	static get ains() {
		return adapter.namespace;
	}
	static get ain() {
		return this.ains + ".";
	}
	static get C() {
		return adapter.config;
	}

	static fullName(id) {
		return this.ain + id;
	}

	static parseLogic(obj) {
		return this.includes(["0", "off", "aus", "false", "inactive"], obj.toString().trim().toLowerCase()) ?
			false : this.includes(["1", "-1", "on", "ein", "true", "active"], obj.toString().trim().toLowerCase());
	}
	static clone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}
	/*     static wait(time, arg) {
        if (isNaN(Number(time)) || Number(time) < 0)
            time = 0;
        if (typeof arg === 'function') {
            let args = Array.prototype.slice.call(arguments, 2);
            return new Promise(res => setTimeout(r => res(arg.apply(null, args)), time));
        }
        return new Promise(res => setTimeout(res, time, arg));
    }
 */
	static async P(pv, res, rej) {
		if (pv instanceof Promise)
			return pv;
		if (pv && typeof pv.then === "function")
			return new Promise((rs, rj) => pv.then(rs, rj));
		if (pv)
			return this.resolve(res || pv);
		return this.reject(rej || pv);
	}

	static async nextTick(x) {
		return new Promise((res) => process.nextTick(() => res(x)));
	}

	static async resolve(x) {
		return this.nextTick(x);
	}

	static async reject(x) {
		await this.nextTick();
		return Promise.reject(x);
	}

	static async wait(time, arg) {
		time = parseInt(this.toNumber(time));

		if (time < 0) return this.nextTick(arg);
		return new Promise((resolve) =>
			setTimeout(() => resolve(arg), time)
		);
	}

	static async pSequence(arr, promise, wait) {
		wait = wait || 0;
		if (!Array.isArray(arr) && typeof arr === "object")
			arr = Object.entries(arr).filter(o => arr.hasOwnProperty(o[0]));
		const res = [];
		for (const i of arr) {
			if (res.length) await this.wait(wait);
			try {
				const r = await promise(i);
				res.push(r);
			} catch (e) {
				res.push(e);
			}
		}
		return res;
	}

	static async pTimeout(pr, time, callback) {
		const t = parseInt(time);
		assert(typeof t === "number" && t > 0, `pTimeout requires a positive number as second argument for the ms`);
		let st = null;
		assert(!callback || callback && typeof callback === "function", `pTimeout requires optionally a function for callback as third argument`);
		return new Promise((resolve, reject) => {
			const rs = res => {
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

	static async Ptime(promise, arg) {
		const start = Date.now();
		if (typeof promise === "function")
			promise = promise(arg);
		await Promise.resolve(promise).catch(() => null);

		const end = Date.now();
		return end - start;
	}
	static O(obj, level) {
		return util.inspect(obj, {
			depth: level || 2,
			colors: false
		}).replace(/\n\s*/g, "");
	}

	static removeEmpty(obj) {
		if (this.T(obj) !== "object")
			return obj;
		const a = this.clone(obj);
		for (const n of Object.getOwnPropertyNames(a))
			if (!a[n] && typeof a[n] !== "boolean") delete a[n];
		return a;
	}
	static S(obj, level) {
		return typeof obj === "string" ? obj : this.O(obj, level);
	}
	static N(fun, ...args) {
		return setImmediate.apply(null, [fun, ...args]);
	} // move fun to next schedule keeping arguments
	static T(i, j) {
		let t = typeof i;
		if (t === "object") {
			if (Array.isArray(i)) t = "array";
			else if (i instanceof RegExp) t = "regexp";
			else if (i === null) t = "null";
		} else if (t === "number" && isNaN(i)) t = "NaN";
		return j === undefined ? t : this.T(j) === t;
	}
	static locDate(date) {
		return date instanceof Date ?
			new Date(date.getTime() - date.getTimezoneOffset() * 60000) :
			typeof date === "string" ?
			new Date(Date.parse(date) - (new Date().getTimezoneOffset()) * 60000) :
			!isNaN(+date) ?
			new Date(+date - (new Date().getTimezoneOffset()) * 60000) :
			new Date(Date.now() - (new Date().getTimezoneOffset()) * 60000);
	}
	static dateTime(date) {
		return this.locDate(date).toISOString().slice(0, -5).replace("T", "@");
	}
	static obToArray(obj) {
		return (Object.keys(obj).filter(x => obj.hasOwnProperty(x)).map(i => obj[i]));
	}
	static includes(obj, value) {
		return this.T(obj) === "object" ? obj[value] !== undefined :
			Array.isArray(obj) ? obj.find(x => x === value) !== undefined : obj === value;
	}

	static ownKeys(obj) {
		return this.T(obj) === "object" ? Object.getOwnPropertyNames(obj) : [];
		//        return this.T(obj) === 'object' ? Object.keys(obj).filter(k => obj.hasOwnProperty(k)) : [];
	}

	static ownKeysSorted(obj) {
		return this.ownKeys(obj).sort(function (a, b) {
			a = a.toLowerCase();
			b = b.toLowerCase();
			if (a > b) return 1;
			if (a < b) return -1;
			return 0;
		});
	}

	static async stop(dostop, callback) { // dostop 
		if (stopping) return;
		try {
			if (adapter._onStop)
				adapter._onStop(dostop);
		} finally {
			stopping = true;
			if (timer) {
				if (Array.isArray(timer))
					timer.forEach(t => clearInterval(t));
				else
					clearInterval(timer);
				timer = null;
			}
		}
		this.I(`Adapter disconnected and stopped with dostop(${dostop}) and callback(${!!callback})`);
		if (!callback) {
			const x = dostop < 0 ? 0 : dostop || 0;
			MyAdapter.Df("Adapter will exit now with code %s and method %s!", x, adapter && adapter.terminate ? "adapter.terminate" : "process.exit");
			adapter && adapter.terminate ? adapter.terminate(x) : process.exit(x);
		} else
			try {
				callback && callback();
			} finally {
				callback && callback();
			}
	}

	static seriesOf(obj, promfn, delay) { // fun gets(item) and returns a promise
		assert(typeof promfn === "function", "series(obj,promfn,delay) error: promfn is not a function!");
		delay = parseInt(delay) || 0;
		let p = Promise.resolve();
		const nv = [],
			f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => this.wait(delay, nv.push(res)))) :
			(k) => p = p.then(() => promfn(k));
		for (const item of obj)
			f(item);
		return p.then(() => nv);
	}

	static seriesInOI(obj, promfn, delay) { // fun gets(item) and returns a promise
		assert(typeof promfn === "function", "series(obj,promfn,delay) error: promfn is not a function!");
		delay = parseInt(delay) || 0;
		let p = Promise.resolve();
		const nv = [],
			f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => this.wait(delay, nv.push(res)))) :
			(k) => p = p.then(() => promfn(k));
		for (const item in obj)
			f(obj[item]);
		return p.then(() => nv);
	}

	static seriesIn(obj, promfn, delay) { // fun gets(item,object) and returns a promise
		assert(typeof promfn === "function", "series(obj,promfn,delay) error: promfn is not a function!");
		delay = parseInt(delay) || 0;
		let p = Promise.resolve();
		const nv = [],
			f = delay > 0 ? (k) => p = p.then(() => promfn(k).then(res => this.wait(delay, nv.push(res)))) :
			(k) => p = p.then(() => promfn(k));
		for (const item in obj)
			f(item, obj);
		return p.then(() => nv);
	}

	static c2p(f, b) {
		const p = util.promisify(f);
		return b ? p.bind(b) : p;
	}
	/*
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

	static retry(nretry, fn, arg, wait) {
		assert(typeof fn === "function", "retry (,fn,) error: fn is not a function!");
		nretry = parseInt(nretry);
		nretry = isNaN(nretry) ? 2 : nretry;
		return Promise.resolve(fn(arg)).catch(err => nretry <= 0 ? this.reject(err) : this.wait(wait > 0 ? wait : 0).then(() => this.retry(nretry - 1, fn, arg, wait)));
	}

	static
	while ( fw,  fn,  time) {
		assert(typeof fw === "function" && typeof fn === "function", "retry (fw,fn,) error: fw or fn is not a function!");
		time = parseInt(time) || 0;
		return !fw() ? this.resolve(true) :
			fn().then(() => true, () => true)
				.then(() => this.wait(time))
				.then(() => this.while(fw, fn, time));
	}

	static repeat(  nretry,  fn, arg, len) {
		assert(typeof fn === "function", "repeat (,fn,) error: fn is not a function!");
		nretry = parseInt(nretry) || 0;
		return fn(arg)
			.then(res => this.reject(res))
			.catch(res => nretry <= 0 ? this.resolve(res) : this.wait(len > 0 ? len : 0).then(() => this.repeat(nretry - 1, fn, arg)));
	}
*/
	static async exec(command) {
		//		assert(typeof command === "string", "exec (fn) error: fn is not a string!");
		const istest = command.startsWith("!");
		return new Promise((resolve, reject) => {
			try {
				exec(istest ? command.slice(1) : command, (error, stdout, stderr) => {
					if (istest && error) {
						error[stderr] = stderr;
						return reject(error);
					}
					resolve(stdout);
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	/*
	static request(opt, value, transform) {
		if (typeof opt === "string")
			opt = this.url(opt.trim());
		if (!(opt instanceof url.Url)) {
			if (this.T(opt) !== "object" || !opt.hasOwnProperty("url"))
				return Promise.reject(this.W(`Invalid opt or Url for request: ${this.O(opt)}`));
			opt = this.url(opt.url, opt);
		}
		if (opt.json)
			if (opt.headers) opt.headers.Accept = "application/json";
			else opt.headers = {
				Accept: "application/json"
			};
		if (!opt.protocol)
			opt.protocol = "http:";
		const fun = opt.protocol.startsWith("https") ? https.request : http.request;
		//                this.D(`opt: ${this.O(opt)}`);
		return new Promise((resolve, reject) => {
			let data = new Buffer(""),
				res;
			const req = fun(opt, function (result) {
				res = result;
				//                MyAdapter.D(`status: ${MyAdapter.O(res.statusCode)}/${http.STATUS_CODES[res.statusCode]}`);
				res.setEncoding(opt.encoding ? opt.encoding : "utf8");
				if (MyAdapter.T(opt.status) === "array" && opt.status.indexOf(res.statusCode) < 0)
					return reject(MyAdapter.D(`request for ${url.format(opt)} had status ${res.statusCode}/${http.STATUS_CODES[res.statusCode]} other than supported ${opt.status}`));
				res.on("data", chunk => data += chunk)
					.on("end", () => {
						//                        res.removeAllListeners();
						//                        req.removeAllListeners();
						if (MyAdapter.T(transform) === "function")
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
					.on("error", e => err(e))
					.on("close", () => err(`Connection closed before data was received!`));
			}).on("error", e => err(e));

			function err(e, msg) {
				if (!msg)
					msg = e;
				//                if (res) res.removeAllListeners();
				//                req && req.removeAllListeners();
				//                if (req && !req.aborted) req.abort();
				//                res && res.destroy();
				//                MyAdapter.Df('err in response: %s = %O', msg);
				return reject(msg);
			}

			if (opt.timeout)
				req.setTimeout(opt.timeout, () => err("request timeout Error: " + opt.timeout + "ms"));
			req.on("error", (e) => err("request Error: " + MyAdapter.O(e)))
				.on("aborted", (e) => err("request aborted: " + MyAdapter.O(e)));
			// write data to request body
			return req.end(value, opt.encoding ? opt.encoding : "utf8");
		});
	}
*/
	static async get(url, retry) { // get a web page either with http or https and return a promise for the data, could be done also with request but request is now an external package and http/https are part of nodejs.
		const options = {};
		if (typeof retry === "object") {
			Object.assign(options, retry);
			retry = options.retry || 1;
		}
		retry = this.toInteger(retry);
		let res;
		while (retry >= 0) try {
			res = await axios(url, options);
			return res && res.data;
		} catch (e) {
			if (retry <= 0)
				return Promise.reject(e);
		} finally {
			--retry;
		}
		return null;
	}

	static equal(a, b) {
		if (a == b)
			return true;
		const ta = this.T(a),
			tb = this.T(b);
		if (ta === tb) {
			if (ta === "array" || ta === "function" || ta === "object")
				return JSON.stringify(a) === JSON.stringify(b);
		} else if (ta === "string" && (tb === "array" || tb === "function" || tb === "object") && a === this.O(b))
			return true;
		return false;
	}

	static get getMyStates() {
		return states;
	}


	static async changeState(id, value, options) {
		//        this.If('ChangeState got called on %s with ack:%s = %O', id,ack,value)
		const {
			always,
			ts,
			ack
		} = options;
		if (value === undefined) {
			this.Wf("You tried to set state '%s' to 'undefined' with %j!", id, options);
			return null;
		}
		const stn = {
			val: value,
			ack: !!ack
		};
		if (ts) stn.ts = ts;
		let st = states[id] ? states[id] : (states[id] = await adapter.getStateAsync(id).catch(() => undefined));
		if (st && !always && this.equal(st.val, value) && st.ack === ack)
			return st;
		await adapter.setStateAsync(id, stn)
			.catch(e => (this.Wf("Error %j is setState for %s with %j", e, id, stn), stn));
		if (states[id]) {
			st = states[id];
			st.val = value;
			st.ack = ack;
			if (ts)
				st.ts = ts;
		} else states[id] = (st = await adapter.getStateAsync(id));
		this.Df("ChangeState ack:%s of %s = %s", !!ack, id, value);
		return st;
	}

	static getClass(obj) {
		if (typeof obj === "undefined")
			return "undefined";
		if (obj === null)
			return "null";
		const ret = Object.prototype.toString.call(obj)
			.match(/^\[object\s(.*)\]$/)[1];
		//            this.I(this.F('get class of ',obj, ' = ', ret));
		return ret;
	}

	static async myGetState(id) {
		if (states[id])
			return states[id];
		if (!id.startsWith(this.ain) && states[this.ain + id])
			return states[this.ain + id]
		let nid = sstate[id];
		if (nid && states[nid])
			return states[nid];
		if (!nid)
			nid = id;
		const s = await adapter.getForeignStateAsync(nid);
		if (s)
			states[nid] = s;
		return s;
	}

	static async makeState(ido, value, ack, always, define) {
		//        ack = ack === undefined || !!ack;
		//                this.Df(`Make State %s and set value to:%O ack:%s`,typeof ido === 'string' ? ido : ido.id,value,ack); ///TC
		const options = typeof ack == "object" ? ack : {
			ack
		};
		if (always) options.always = always;
		if (define) options.define = define;

		let id = ido;
		if (typeof id === "string")
			ido = id.endsWith("Percent") ? {
				unit: "%"
			} : {};
		else if (typeof id.id === "string") {
			id = id.id;
		} else throw new Error(this.W(`Invalid makeState id: ${this.O(id)}`));

		const idl = id.startsWith(this.ain) ? id : this.ain + id;

		if ((!options.define || typeof ido !== "object") && createdStates[idl])
			return this.changeState(id, value, options);
		//        this.Df(`Make State ack:%s %s = %s`, ack, id, value); ///TC
		const st = {
			common: {
				name: id, // You can add here some description
				read: true,
				write: false,
				state: "state",
				role: "value",
				type: this.T(value)
			},
			type: "state",
			_id: idl
		};
		if (options.common) Object.assign(st.common, options.common);
		if (st.common.type === "object") st.common.type = "mixed";
		for (const i in ido) {
			if (i === "native") {
				st.native = st.native || {};
				for (const j in ido[i])
					st.native[j] = ido[i][j];
			} else if (i !== "id" && i !== "val") st.common[i] = ido[i];
		}
		if (st.common.write)
			st.common.role = st.common.role.replace(/^value/, "level");
		//    this.I(`will create state:${id} with ${this.O(st)}`);
		addSState(id, idl);
		createdStates[idl] = id;
		await adapter.extendObjectAsync(idl, st, null).catch(e => (this.Wf("error %j extend object %s", e, idl), null));
		this.Df("created State %s", idl); // REM
		if (st.common.state === "state" && !objects[this.ain + id]) {
			objects[idl] = st;
		}
		return this.changeState(idl, value, options);
	}

	static async cleanup(name) {
		//        .then(() => A.I(A.F(A.sstate)))
		//        .then(() => A.I(A.F(A.ownKeysSorted(A.states))))
		const res = await this.getObjects(name);
		for (const item of res) { // clean all states which are not part of the list
			//            this.I(`Check ${this.O(item)}`);
			const id = item.id;
			if (!id || !id.startsWith(this.ain) || createdStates[id])
				continue;
			//            this.I(`check state ${item.id} and ${id}: ${states[item.id]} , ${states[id]}`);
			if (states[id]) {
				this.Df("Cleanup delete state %s", id);
				await adapter.deleteStateAsync(id).catch(MyAdapter.nop);
			}
			//				.catch(err => this.D(`Del State err: ${this.O(err)}`));
			let found = false;
			for (const cs of Object.keys(createdStates))
				if (cs.startsWith(id + '.')) {
					found = true;
					break;
				}
			if (!found) {
				this.Df("Cleanup delete object %s", id);
				await adapter.delObjectAsync(id).catch(MyAdapter.nop);
			}
			//				.catch(err => this.D(`Del Object err: ${this.O(err)}`)); ///TC
			await this.wait(10);
		}
	}

	static async isLinuxApp(name) {
		if (os.platform() !== "linux")
			return false;
		return this.exec("!which " + name).then(x => x.length >= name.length).catch(() => false);
	}
}


MyAdapter.Sequence = Sequence;
//MyAdapter.Setter = Setter;
MyAdapter.CacheP = CacheP;
MyAdapter.HrTime = HrTime;
MyAdapter.IobAdapter = IobAdapter;
module.exports = MyAdapter;