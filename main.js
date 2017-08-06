"use strict";
const utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink2'),
	broadlink = require(__dirname + '/lib/broadlink'),
	//zlib = require('zlib'),
	namespaceChannelLearned = 'learnedSignals';
var currentDevice,
	inObjectChange;

const util = require('util');
const dns = require('dns');
const debug = false;

function _O(obj, level) { return util.inspect(obj, false, level || 2, false).replace(/\n/g, ' '); }
// function _J(str) { try { return JSON.parse(str); } catch (e) { return {'error':'JSON Parse Error of:'+str}}} 
//function _N(fun) { return setTimeout.apply(null, [fun, 0].concat(Array.prototype.slice.call(arguments, 1))); } // move fun to next schedule keeping arguments
function _D(l, v) { (debug ? adapter.log.info : adapter.log.debug)(`<span style="color:darkblue;">debug: ${l}</span>`); return v === undefined ? l : v; }
function _I(l, v) { adapter.log.info(l); return v === undefined ? l : v; }
function _W(l, v) { adapter.log.warn(l); return v === undefined ? l : v; }
function _PR(v) { return Promise.resolve(v); } function _PE(v) { return Promise.reject(v); }

function wait(time, arg) { return new Promise(res => parseInt(time) >= 0 ? setTimeout(res, parseInt(time), arg) : res(arg)) }  // wait time (in ms) and then resolve promise with arg, returns a promise thich means the '.then()' will be executed after the delay
function pRepeat(nrepeat, fn, arg, r) { r = r || []; return fn(arg).then(x => (nrepeat <= 0 ? Promise.resolve(r) : pRepeat(nrepeat - 1, fn, arg, r, r.push(x)))); }
function pGetState(id) { return c2pP(adapter.getState)(id); }
function pSetState(id, val, ack) { return c2pP(adapter.setState)(id, val, ack ? true : false); } 	//    _D(`pSetState: ${id} = ${val} with ${ack}`);

function pSeries(obj, promfn, delay) {  // makes an call for each item 'of' obj to promfun(item) which need to return a promise. All Promises are executed therefore in sequence one after the other
	var p = Promise.resolve();
	const nv = [], f = (k) => p = p.then(() => promfn(k).then(res => wait(delay || 0, nv.push(res))));
	for (var item of obj) f(item);
	return p.then(() => nv);
}
function c2pP(f) {// turns a callback(err,data) function into a promise 
	return function () {
		const args = Array.prototype.slice.call(arguments);
		return new Promise((res, rej) => {
			args.push((err, result) => (err && rej(err)) || res(result));
			f.apply(this, args);
		});
	};
}
//const pExec = c2pP(require('child_process').exec);

const scanList = new Map(),
	objects = new Map(),
	tempName = '.Temperature',
	learnName = '.Learn',
	learnedName = '.LearnedStates.',
	codeName = "CODE_",
	reCODE = /^CODE_|^/,
	reIsCODE = /^CODE_[a-f0-9]{16}/,
	defaultName = '>>> Rename learned @ ';
var ain = '',
	codes = {};

function makeState(id, value, add) {
	if (objects.has(id) && value !== undefined)
		return pSetState(id, value, true).then(() => _D(`${id} updated with ${value} on: ${_O(objects.get(id))}`, objects.get(id)));
	_D(`Make State ${id}${value !== undefined ? ', set value to ' + _O(value) : ''}${add !== undefined ? ' with attribute ' + _O(add) : ''}`) ///TC
	const st = {
		common: {
			name: id, // You can add here some description
			read: true,
			write: false,
			state: 'state',
			role: 'value',
			type: typeof value
		},
		type: id.split('.').length == 1 ? 'device' : 'state',
		_id: id
	};
	if (id.endsWith(learnName)) {
		st.common.role = 'button';
		st.common.write = true;
		st.common.type = typeof true;
	} else if (id.endsWith('.STATE')) {
		st.common.write = true;
		st.common.role = 'switch';
		st.common.type = typeof true;
	} else if (id.endsWith(tempName)) {
		st.common.role = "value.temperature";
		st.common.unit = "°C";
		st.common.type = typeof 1.1;
	} else if (id.indexOf(learnedName) != -1) {
		st.common.name = `${defaultName}${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "")}`
		st.common.role = 'button';
		st.common.write = true;
		st.common.type = typeof true;
	}
	if (add !== undefined)
		st.native = { broadlink2: add };
	if (id.endsWith('Percent'))
		st.common.unit = "%";
	
	return c2pP(adapter.extendObject)(id, st)
		.then(x => {
			objects.set(id, x);
			if (value !== undefined)
				return pSetState(id, value, true).then(a => x, e => x);
		})
		.catch(err => _D(`MS ${_O(err)}:=extend`, id))
		.then(() => objects.get(id));
}

function processMessage(obj) {
	if (obj && obj.command) {
		_D(`process Message ${_O(obj)}`);
		switch (obj.command) {
			case 'ping': {
				// Try to connect to mqtt broker
				if (obj.callback && obj.message) {
					ping.probe(obj.message, { log: adapter.log.debug }, function (err, result) {
						adapter.sendTo(obj.from, obj.command, res, obj.callback);
					});
				}
				break;
			}
		}
	}
	adapter.getMessage(function (err, obj) {
		if (obj) {
			processMessage(obj);
		}
	});
}

adapter.on('unload', function (callback) {
	try {
		if (currentDevice) {
			currentDevice.closeConnection();
			currentDevice = null;
		}
		adapter.log.info('Closed connection/listener');
		callback();
	} catch (e) {
		callback();
	}
}).on('objectChange', function (id, obj) {
	_D(`objectChange of "${id}": ${_O(obj)}`);
}).on('stateChange', function (id, state) {
	//	_D(`stateChange of "${id}": ${_O(state)}`); 
	if (state && !state.ack && state.from != 'system.adapter.' + ain) {
		let id0 = id.split('.').slice(2, 3)[0];
		let id2 = id.split('.').slice(2, -1).join('.');
		let id1 = id2.split(':')[0];
		let id3 = id.split('.').slice(-1)[0];
		// _D(`Somebody (${state.from}) changed ${id} of "${id2}" type ${id1} to ${_O(state)}`); 
		_D(`Somebody (${state.from}) id0 ${id0} changed ${id} of "${id2}" type ${id3} to ${_O(state)}`);
		let device = scanList.get(id0);
		if (!device) return _W(`stateChange error no device found: ${id} ${_O(state)}`);
		switch (id1) {
			case 'SP1':
			case 'SP2':
				device.set_power(state.val);
				_I(`Change ${id} to ${state.val}`)
				device.oval = state.val;
				break;
			case 'RM2':
				if (id.indexOf(learnedName) === -1)
					return startLearning(id2);
				//				_D(`Maybe I should send command from ${id0} changed ${id} of "${id2}" type ${id1} to ${id3}`);
				return isSignalCode(id3) && sendCode(device, id3);
			default:
				return _W(`stateChange error invalid id type: ${id}=${id1} ${_O(state)}`);
		}
	}
}).on('message', obj => processMessage(obj)
	).on('ready', function () {
		//	if (adapter.config.ip) {
		ain = adapter.name + '.' + adapter.instance + '.';
		_I('Discover UDP devices for 10sec on ' + ain);
		let connection = new broadlink();
		connection.on("deviceReady", function (device) {
			const typ = device.getType();
			//		device.typ = typ;
			_I(`Device type ${typ} dedected: ${_O(device, 1)}`);
			c2pP(dns.reverse)(device.host.address)
				.then(x => x.toString().trim().endsWith(adapter.config.ip) ? x.toString().trim().slice(0, x.length - adapter.config.ip.length - 1) : x, e => device.host.address.split('.').join('-'))
				.then(x => device.name = typ + ':' + x)
				.then(x => {
					if (scanList.has(x)) {
						return _W(`Device found already: ${x} with ${_O(scanList.get(x))} and ${_O(device)}`);
					}
					scanList.set(_D(`Device found ${x}`, x), device);
					device.iname = x;
					device.oval = false;
					switch (device.type) {
						case 'SP2':
							device.on('payload', (err, payload) => {
								let nst = x + '.STATE',
									res = !!payload[4];
								if (payload !== null && (payload[0] == 1 || payload[0] == 2)) {
									//								_D(`Device ${nst} sent cmd ${err}/${err.toString(16)} with "${res}"`);
									if (device.oval != res) {
										device.oval = res;
										return makeState(nst, res);
									}
								} else _W(`Device ${nst} sent err:${err}/${err.toString(16)} with ${payload.toString('hex')}`);
							});
							break;
						case 'RM2':
							device.on('temperature', (val) => {
								let nst = x + tempName;
								//							_D(`Received temperature ${val} from ${x}`);
								if (device.ltemp != val) {
									device.ltemp = val;
									makeState(nst, val);
								}
							});
							//						return makeState(x,false,{name: device.name, host: device.host, type: device.type });
							break;
					}
				}).catch(e => _W(`Error in device dedect: "${e}"`))
				;
			return false;
			//		}
		}).discover();
		wait(10000).then(() => main(_D('Start main()')));
	});

function sendCode(currentDevice, value) {
	let buffer = new Buffer(value.replace(reCODE, ''), 'hex');
	//var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string

	currentDevice.sendData(buffer);
	_D('sendData to ' + currentDevice.name + ', Code: ' + value);
}

function isSignalCode(value) {
	return reIsCODE.test(value);
}

function doPoll() {
	pSeries(scanList, x => {
		const device = x[1];
		device.checkTemperature && device.checkTemperature();
		return _PR(device.check_power && device.check_power());
	}, 50);
}

function startLearning(name) {
	_I('Start learning for device: ' + name);
	const device = scanList.get(name);
	if (!device)
		return (_E(`wrong name "${name}" in startLearning`));
	var learned = 30;
	device.emitter.once("rawData", data => {       // use currentDevice.emitter.once, not the copy currentDevice.on. Otherwise this event will be called as often you call currentDevice.on()
		const hex = data.toString('hex');
		learned = 0;
		_I(`Learned Code ${device.name} (hex): ${hex}`);
		makeState(name + learnedName + codeName + hex, undefined, { code: hex /* , data: data */ });
	});
	device.enterLearning();
	pRepeat(35, x => learned-- <= 0 ? _PR() : wait(_D(`Learning for ${device.name} wait ${learned} `, 1000)).then(e => device.checkData()))
		.catch(e => e)
		.then(() => _I(`Stop learning for ${name}!`));

}

function main() {
	_D('Config IP-Address end to remove: ' + adapter.config.ip);
	pSeries(scanList, x => {
		const devid = x[0],
			device = x[1],
			typ = device.getType();
		let nst = devid + '.STATE';

		_D(`Process item ${devid} with ${_O(device)}`);
		switch (typ) {
			case 'SP2':
			case 'SP1':
				return makeState(nst, undefined, { name: device.name, host: device.host, type: device.type })
					.then(x => pGetState(nst))
					.then(x => _D(`New State ${nst}: ${_O(x)}`))
					.then(x => device.check_power && device.check_power())
					.catch(e => _W(`Error in StateCreation ${e}`));
				break;
			case 'RM2':
				nst = devid + learnName;
				return makeState(nst, undefined, { name: device.name, host: device.host, type: device.type })
					.then(() => pGetState(nst))
					.then(x => _D(`New State ${nst}: ${_O(x)}`))
					.then(() => makeState(devid + tempName, undefined, { name: device.name, type: device.type }))
					.then(() => device.checkTemperature && device.checkTemperature())
					//					.then(x => makeState(devid+'.learnedStates.__DUMMY__',".... Dummy Entry ....",{name: device.name, type: device.type}))
					.catch(e => _W(`Error in StateCreation ${e}`))
				//					.then(() => startLearning(devid));
				break;
			default:
				_W(`unknown device type ${typ} for ${devid} on ${_O(device)}`);
				break;
		}
		return _PR(devid);
	}).then(x => {
		const p = parseInt(adapter.config.poll);
		if (p) {
			setInterval(doPoll, p * 1000);
			_D(`Poll every ${p} secods.`);
		}
	})
		.then(x => _I(`Adapter ${ain} started and found ${scanList.size} devices named ${Array.from(scanList.keys()).join(', ')}.`), e => _W(`Error in main: ${e}`))
		.then(x => adapter.subscribeStates('*'))
		;
	//	adapter.subscribeObjects('*');
	//	adapter.setState('enableLearningMode', { val: false, ack: true });
}
