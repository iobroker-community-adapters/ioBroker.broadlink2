"use strict";
var utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink2'),
	broadlink = require(__dirname + '/lib/broadlink'),
	//zlib = require('zlib'),
	namespaceChannelLearned = 'learnedSignals',
	currentDevice,
	inObjectChange;

const util = require('util');
const exec = require('child_process').exec;
const dns =       require('dns');
const debug = false;

function _O(obj, level) { return util.inspect(obj, false, level || 2, false).replace(/\n/g, ' '); }

// function _J(str) { try { return JSON.parse(str); } catch (e) { return {'error':'JSON Parse Error of:'+str}}} 
function _N(fun) { return setTimeout.apply(null, [fun, 0].concat(Array.prototype.slice.call(arguments, 1))); } // move fun to next schedule keeping arguments
function _D(l, v) { (debug ? adapter.log.info : adapter.log.debug)(`<span style="color:darkblue;">debug: ${l}</span>`); return v === undefined ? l : v; }
function _I(l, v) { adapter.log.info(l); return v === undefined ? l : v; }
function _W(l, v) { adapter.log.warn(l); return v === undefined ? l : v; }
function _PR(v) { return Promise.resolve(v); } function _PE(v) { return Promise.reject(v); }


const pExec = c2pP(exec);
function wait(time,arg) { return new Promise(res => parseInt(time)>=0 ? setTimeout(res,parseInt(time), arg) : res(arg))}  // wait time (in ms) and then resolve promise with arg, returns a promise thich means the '.then()' will be executed after the delay

function pSeries(obj,promfn,delay) {  // makes an call for each item 'of' obj to promfun(item) which need to return a promise. All Promises are executed therefore in sequence one after the other
    var p = Promise.resolve();
    const   nv = [], f = (k) => p = p.then(() => promfn(k).then(res => wait(delay || 0,nv.push(res))));
    for(var item of obj) f(item);
    return p.then(() => nv);
}
/*
function pSeriesIn(obj,promfn,delay) {  // makes an call for each item 'in' obj to promfun(key,obj) which need to return a promise. All Promises are executed therefore in sequence one after the other
    var p = Promise.resolve();
    const   nv = [], f = k => p = p.then(() => promfn(k,obj).then(res => wait(delay || 0, nv.push(res))));
    for(var item in obj) f(item);
    return p.then(() => nv);
}
*/
function c2pP(f) {// turns a callback(err,data) function into a promise 
    return function () {
        const args = Array.prototype.slice.call(arguments);
        return new Promise((res, rej) => {
            args.push((err, result) => (err && rej(err)) || res(result));
            f.apply(this, args);
        });
    };
}
/* 
function c1pP(f) {  // turns a callback(data) function into a promise
    return function () {
        const args = Array.prototype.slice.call(arguments);
        return new Promise((res, rej) => {
            args.push((result) => res(result));
            f.apply(this, args);
        });
    };
}
*/
var ain = '';
const scanList = new Map();
const objects = new Map();
//const pSetState = c2pP(adapter.setState);
function pSetState(id,val,ack) {
//    _D(`pSetState: ${id} = ${val} with ${ack}`);
    return c2pP(adapter.setState)(id,val,ack ? true : false);
}

function makeState(id,value) {
    if (objects.has(id))
        return pSetState(id,value,true);
    _D(`Make State ${id} and set value to '${_O(value)}'`) ///TC
    var st = {
        common: {
            name:  id, // You can add here some description
            read:  true,
            write: id.endsWith('.STATE'),
            state: 'state',
            role:  'value',
            type:  typeof value
        },
        type: 'state',
        _id: id
    };
    if (id.endsWith('Percent'))
        st.common.unit = "%";
    return  c2pP(adapter.extendObject)(id,st)
        .then(x => {
            objects.set(id,x);
           return pSetState(id,x.val,true).then( a => x, e => x);
        })
        .catch(err => _D(`MS ${_O(err)}:=extend`,id));

}

function getState(id) {
	return c2pP(adapter.getState)(id);
}

function processMessage(obj) {
    if (obj && obj.command) {
        _D(`process Message ${_O(obj)}`);
        switch (obj.command) {
            case 'ping': {
                // Try to connect to mqtt broker
                if (obj.callback && obj.message) {
                    ping.probe(obj.message, {log: adapter.log.debug}, function (err, result) {
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

var reCODE = /^CODE_|^/;
var reIsCODE = /^CODE_[a-f0-9]{16}/;
var codes = {};
var defaultName = '>>> Learned, please describe';

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
	_D(`objectChange of "${id}": ${_O(obj)}`); /*
	if (!id || !obj) {
		if (id) delete codes[id];
		return;
	}
	addCode(id, obj);
	if (obj.type === 'channel' || obj.type === 'device' && !inObjectChange) {
		inObjectChange = true;
		createLerningModeState(id, function () {
			if (inObjectChange) inObjectChange--;
		});
	}
	*/
}).on('stateChange', function (id, state) {
	_D(`stateChange of "${id}": ${_O(state)}`); 
	if (state && !state.ack && state.from!= 'system.adapter.'+ain) {
		var id2 = id.split('.').slice(2,-1).join('.');
		var id1 = id.split('.').slice(2,3)[0];
		_D(`Somebody (${state.from}) changed ${id.split('.').slice(-1)[0]} of "${id2}" type ${id1} to ${_O(state)}`); 
		var device = scanList.get(id2);
		if (!device) return _W(`stateChange error no device found: ${id} ${_O(state)}`);
		switch(id1) {
			case 'SP1':
			case 'SP2':
				device.set_power(state.val);
				_I(`Change ${id} to ${state.val}`)
				break;
			default:
				_W(`stateChange error invalid id type: ${id}=${id1} ${_O(state)}`);
				break;
		}
		
	}
/*
	if (!state || state.ack || id.indexOf(adapter.namespace) !== 0 || !currentDevice) return;
	
	var ar = id.split('.');
	var command = ar[ar.length - 1];

	switch (command) {
		case 'enableLearningMode':
		case 'createCode':
			if (!state.val) break;

			var aktChannel = '', name = '';
			if (typeof state.val === 'string') {
				var nar = state.val.split('.');
				name = nar.pop();
				aktChannel = nar.join('.');
				aktChannel = aktChannel[0] === '.' ? aktChannel.substr(1) : namespaceChannelLearned + '.' + aktChannel;
			} else {
				for (var i = 2; i < ar.length - 1; i++) {
					aktChannel = aktChannel ? aktChannel + '.' + ar[i] : ar[i];
				}
			}
			enterLeaningMode(aktChannel, name);
			break;
		case 'sendCode':
			var code = state.val.replace(reCODE, 'CODE_');
			if (isSignalCode(code)) sendCode(code);
			break;
		default:
			adapter.log.debug('Preparing to send: ' + command);

			if (isSignalCode(command)) {
				sendCode(command);
			} else if (codes[id]) {
				sendCode(codes[id]);
			}
		//     // If the object is not a signal code, check the name of the object
		//     adapter.getObject (id, function (err, obj) {
		//         if (err || !obj) {
		//             adapter.log.error (err);
		//         } else if (obj.native && obj.native.keyCode) {
		//             sendCode (obj.native.keyCode);
		//         } else if (obj.common.name) {
		//             if (isSignalCode (obj.common.name)) {
		//                 sendCode (obj.common.name)
		//             }
		//         }
		//     });
		// }
	}
*/
	// }).on('stateChange', function (id, state) {
	// 	if (currentDevice) {
	// 		if (state && !state.ack && id.indexOf(adapter.namespace) === 0) {
	// 		    var ar = id.split('.');
	// 		    if (ar[ar.length-1] === 'enableLearningMode') {
	//                 if (state.val) {
	//                     var aktChannel = '', name = '';
	//                     for (var i=2; i<ar.length-1; i++) {
	//                         aktChannel = aktChannel ? aktChannel + '.' + ar[i] : ar[i];
	//                     }
	//                     if (typeof state.val === 'string') {
	//                         var nar = state.val.split('.');
	//                         name = nar.pop();
	//                         aktChannel = nar.join('.');
	//                         aktChannel = aktChannel [0] === '.' ? aktChannel.substr(1) : namespaceChannelLearned + '.' + aktChannel;
	//                     }
	//                     enterLeaningMode(aktChannel, name);
	//                 }
	// 			} else {
	// 				var objectIdCode = id.split('.').pop();
	// 				adapter.log.debug('Preparing to send: ' + objectIdCode);
	//
	// 				if (isSignalCode(objectIdCode)) {
	// 					sendCode(objectIdCode);
	// 				} else {
	// 					// If the object is not a signal code, check the name of the object
	// 					adapter.getObject(id, function (err, obj) {
	// 						if (err) {
	// 							adapter.log.error(err);
	// 						} else if (obj.common.name) {
	// 							if (isSignalCode(obj.common.name)) {
	// 								sendCode(obj.common.name)
	// 							}
	// 						}
	// 					});
	// 				}
	// 			}
	// 		}
	// 	}
}).on('message', obj => processMessage(obj)
).on('ready', function () {
	//	if (adapter.config.ip) {
	ain = adapter.name + '.' + adapter.instance + '.';
	_I('Discover UDP devices for 10sec on '+ain);
	var connection = new broadlink();
	connection.on("deviceReady", function (device) {
		const typ = device.getType();
		_I(`Device type ${typ} dedected: ${_O(device,1)}`);
		c2pP(dns.reverse)(device.host.address)
			.then( x => x.toString().trim().endsWith(adapter.config.ip) ? x.toString().trim().slice(0,x.length-adapter.config.ip.length-1) : x, e => device.host.address.split('.').join('-'))
			.then( x => device.name = typ + '.' + x )
			.then( x => {
				if(scanList.has(x))  {
					return _W(`Device found already: ${x} with ${_O(scanList.get(x))} and ${_O(device)}`);
				}
				scanList.set(_D(`Device found ${x}`,x),device);
				device.on('payload', (err,payload) => {
					_D(`Device ${device.name} sent err:"${_O(err)}" with payload "${_O(payload)}"`);
				});
				return makeState(x,device);
				})
			.catch(e => _W(`Error in device dedect: "${e}"`))
			;
/*
			if (device.host.address === adapter.config.ip) {
			device.checkTemperature();
			device.emitter.on('temperature', function (temperature) {
				var i = temperature;
			});
			currentDevice = device;
			adapter.log.info('Device connected: ' + adapter.config.ip + ' (' + device.getType() + ')');
			main();
*/
			return _D(true,true);
//		}
	}).discover();
	wait(10000).then(x => main(_D('Start main()')));
	//	} else {
	//		adapter.log.warn('No IP-Address found. Please set in configuration.');
	//	}
});

function sendCode(value) {
	var buffer = new Buffer(value.replace(reCODE, ''), 'hex');
	//var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string

	currentDevice.sendData(buffer);
	adapter.log.debug('sendData to ' + currentDevice.host.address + ', Code: ' + value);
}

function isSignalCode(value) {
	return reIsCODE.test(value);
	//return value.length > 21 && value.substr(0, 5) == 'CODE_';

}

function enterLeaningMode(aktChannel, name) {
	var leaveTimer;
	adapter.log.info('Enter learning mode - aktChannel=' + aktChannel + ' Wait 30 seconds for data before leaving...');
	var timer = setInterval(function () {
		adapter.log.debug("IR-Learning-Mode - check data...");
		currentDevice.checkData();
	}, 1000);

	var leaveLearningMode = (function () {
		if (leaveTimer) {
			//clearTimeout (leaveTimer);
			leaveTimer = null;

		}
		clearInterval(timer);
		currentDevice.emitter.removeAllListeners('rawData');
		adapter.setState((aktChannel ? aktChannel + '.' : '') + 'enableLearningMode', { val: false, ack: true });
	});

	currentDevice.enterLearning();

	//currentDevice.on("rawData", function (data) {

	//currentDevice.emitter.removeAllListeners('rawData');  // also possible...
	//currentDevice.emitter.on("rawData", function (data) { //

	currentDevice.emitter.once("rawData", function (data) {       // use currentDevice.emitter.once, not the copy currentDevice.on. Otherwise this event will be called as often you call currentDevice.on()
		var hex = data.toString('hex');
		adapter.log.info('Learned Code - aktChannel=' + aktChannel + ' (hex): ' + hex);

		leaveLearningMode();

		var id = aktChannel ? aktChannel : namespaceChannelLearned;
		//id += '.CODE_' + hex; // see remarks at checkMigrateStates
		id += '.' + name;
		// Before create new object check one with the same id already exists
		adapter.getObject(id, function (err, obj) {
			if (err) {
				adapter.log.error(err);
			} else {
				// see remarks at checkMigrateStates
				//if (!obj) {
				adapter.setObject(id, {
					type: 'state',
					common: {
						name: name ? name : defaultName,
						type: 'boolean',
						role: 'button',
						read: false,
						write: true
					},
					native: {
						code: hex
					}
				});
				if (!obj) {
					adapter.log.info('New IR-Code created in ' + namespaceChannelLearned);
				} else {
					adapter.log.info('IR-Code owerwritten: ' + obj.common.name);
				}
			}
		});
	});
	// Leave learning mode after 30 seconds, because the device itself has an built in timeout
	leaveTimer = setTimeout(leaveLearningMode, 30000);
}

function createLerningModeState(path, cb) {
	var id = (path ? path + '.' : '') + 'enableLearningMode';
	adapter.setObject(id, {
		type: 'state',
		common: {
			name: 'Enable learning mode (30s timeout). Result saved here',
			type: 'boolean',
			role: '',
			read: false,
			write: true
		},
		native: {}
	}, function (err, obj) {
		adapter.setState(id, { val: false, ack: true }, cb);
	});
}

function addCode(id, obj) {
	if (obj.type !== 'state') return false;
	var code = isSignalCode(obj.common.name) ? obj.common.name.replace(reCODE, '') : obj.native ? obj.native.code : undefined;
	if (code) codes[id] = code;
}


function checkMigrateStates(objs, cb) {
	return cb && cb(); // remove this line,
	// if you want to move the (ir)code from the 'id' or 'name' to the obj.native.code property
	// this function will convert all existing states with a name or id != the nativeName // '>>> Learned, please describe'
	//
	// the id shouldn't be used because in this case the (ir)code can change. the native object is for own, native values

	var objsArr = [];
	for (var id in objs) {
		objsArr.push(id);
	}

	var doIt = function () {
		if (objsArr.length <= 0) return cb && cb();
		var id = objsArr.pop();
		var obj = objs[id];
		if (obj.native && obj.native.code) return doIt();
		var idCode = id.replace(/.*(CODE_.*$)/, '$1');
		obj.native = obj.native || {};
		if (isSignalCode(obj.common.name)) {
			obj.native.code = obj.common.name;
			var ar = id.split('.');
			obj.common.name = ar[ar.length - 1];
			obj.common.role = 'button';
			adapter.setObject(id, obj);
		} else if (isSignalCode(idCode)) {
			obj.native.code = idCode.replace(reCODE, '');
			obj.common.role = 'button';
			if (obj.common.name === defaultName) {
				adapter.setObject(id, obj, doIt);
				return;
			}
			var newId = id.replace(/(CODE_.*$)/, obj.common.name);
			adapter.setObject(newId, obj, function (err, obj) {
				adapter.getState(id, function (err, state) {
					if (err || !state) return adapter.delObject(id, doIt);
					adapter.setState(newId, state, function (err, state) {
						adapter.delState(id, function () {
							adapter.delObject(id, doIt);
						});
					})
				})
			})
		} else {
			doIt();
		}
	};
	doIt();
}

function main() {
	_D('Config IP-Address end to remove: ' + adapter.config.ip);
	pSeries(scanList, x => {
		const devid = x[0],
			device = x[1],
			typ = device.getType();

		_D(`Process item ${devid} with ${_O(device)}`);
		switch (typ) {
			case 'SP2':
			case 'SP1':
				let nst = devid+'.STATE';
				return makeState(nst,false)
					.then(x => getState(nst))
					.then(x => _D(`New State ${nst}: ${_O(x)}`))
					.then(x => _D(device.check_power()))
					.catch(e => _W(`Error in StateCreation ${e}`));
				break;
			default:
				_W(`unknown device type ${typ} for ${devid} on ${_O(device)}`);
				break;
		}
		return _PR(devid);
	}).then(x => _D('Main finish'),e => _W(`Error in main: ${e}`));
/*
	adapter.getAdapterObjects(function (objs) {
		for (var id in objs) {
			_D(`getAdapterObjects ${id} ${_O(objs[id])}`);
			addCode(id, objs[id]);
		}
		checkMigrateStates(objs);
	});

	adapter.setObject(namespaceChannelLearned, {
		type: 'channel',
		common: {
			name: 'Learned Codes'
		},
		native: {}
	});
	adapter.setObject(namespaceChannelLearned + '.000000', {
		type: 'state',
		common: {
			name: '__DUMMY_SIGNAL__',
			type: 'boolean',
			role: '',
			read: false,
			write: true
		},
		native: {}
	});

	adapter.setObject('sendCode', {
		type: 'state',
		common: {
			name: 'Send a given code',
			type: 'string',
			role: '',
			read: true,
			write: true
		},
		native: {}
	}, function (err, obj) {
		if (err || !obj) return;
		adapter.setState(obj.id, { val: '', ack: true });
	});
	adapter.setObject('createCode', {
		type: 'state',
		common: {
			name: 'Create a code with name',
			desc: 'Learing mode with a given Name and path. E.g.: Yamaha.On/Off',
			type: 'string',
			role: '',
			read: true,
			write: true
		},
		native: {}
	}, function (err, obj) {
		if (err || !obj) return;
		adapter.setState(obj.id, { val: '', ack: true });
	});

	// adapter.setObject('enableLearningMode', {
	// 	type: 'state',
	// 	common: {
	// 		name: 'Enable learning mode (30s timeout). Result saved in ' + namespaceChannelLearned,
	// 		type: 'boolean',
	// 		role: '',
	// 		read: false,
	// 		write: true
	// 	},
	// 	native: {}
	// });
	createLerningModeState();
*/
	adapter.subscribeStates('*');
	adapter.subscribeObjects('*');
//	adapter.setState('enableLearningMode', { val: false, ack: true });
}
