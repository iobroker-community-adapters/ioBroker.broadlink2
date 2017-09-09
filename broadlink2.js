/**
 *      iobroker bmw Adapter
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
// jshint node:true, esversion:6, strict:global, undef:true, unused:true
"use strict";
const utils = require('./lib/utils'),
	adapter = utils.adapter('broadlink2'),
	MyAdapter = require('./myAdapter'),
	broadlink = require('./lib/broadlink'),
	dns = require('dns');

const A = new MyAdapter(adapter, main);

function main() {
	const scanList = {},
		tempName = '.Temperature',
		learnName = '.Learn',
		learnedName = '.LearnedStates.',
		codeName = "CODE_",
		reCODE = /^CODE_|^/,
		reIsCODE = /^CODE_[a-f0-9]{16}/,
		defaultName = '>>> Rename learned @ ';

		var currentDevice;
		
			function sendCode(currentDevice, value) {
		let buffer = new Buffer(value.replace(reCODE, ''), 'hex');
		//var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string

		currentDevice.sendData(buffer);
		A.D('sendData to ' + currentDevice.name + ', Code: ' + value);
	}

	function isSignalCode(value) {
		return reIsCODE.test(value);
	}

	function doPoll() {
		A.series(A.obToArray(scanList), device =>
			Promise.resolve(device.checkTemperature && device.checkTemperature(),
				device.check_power && device.check_power()), 50);
	}

	function startLearning(name) {
		A.I('Start learning for device: ' + name);
		const device = scanList[name];
		if (!device)
			return (A.E(`wrong name "${name}" in startLearning`));
		var learned = 30;
		device.emitter.once("rawData", data => { // use currentDevice.emitter.once, not the copy currentDevice.on. Otherwise this event will be called as often you call currentDevice.on()
			const hex = data.toString('hex');
			learned = 0;
			A.I(`Learned Code ${device.name} (hex): ${hex}`);
			A.makeState({
				id: name + learnedName + codeName + hex,
				name: `${defaultName}${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "")}`,
				write: true,
				role: 'button',
				type: 'string',
				native: {
					code: hex
				}
			}, codeName + hex, true);
		});
		device.enterLearning();
		A.repeat(35, () => learned-- <= 0 ? Promise.resolve() : A.wait(A.D(`Learning for ${device.name} wait ${learned} `, 1000)).then(() => device.checkData()))
			.catch(e => e)
			.then(() => A.I(`Stop learning for ${name}!`));
	}

	A.I('Discover UDP devices for 10sec on ' + A.ains);
	let connection = new broadlink();

	if ((A.debug = adapter.config.ip.startsWith('debug!')))
		adapter.config.ip = adapter.config.ip.slice(A.D(`Debug mode on!`, 6)).trim();

	A.unload = () => {
		if (currentDevice) {
			currentDevice.closeConnection();
			currentDevice = null;
		}
		A.D('Closed connection/listener');
	};

	A.objChange = function (obj) {
		if (typeof obj === 'string' && obj.indexOf(learnedName) > 0)
			return A.getObject(obj).
		then(oobj => {
			if (oobj.common.name.match(/[\.\,\;]/g) && !oobj.native.code)
				return A.W(`Cannot rename ${obj} to ${oobj.common.name} because it includes charaters like ".,;" or does not have a learned code`);
			let dev = obj.split('.'),
				nst = oobj.common;
			nst.id = (dev[2] + learnedName + oobj.common.name);
			nst.native = oobj.native;
			nst.val = codeName + oobj.native.code;
			if (oobj.common.name != dev[4])
				return A.makeState(nst, nst.val, true)
					.then(() => A.removeState(obj))
					.catch(err => A.W(`objChange error: ${obj}=${nst.id} ${A.O(err)}`));
		});
	};

	A.stateChange = function (id, state) {
		//	A.D(`stateChange of "${id}": ${A.O(state)}`); 
		if (!state.ack) {
			let id0 = id.split('.').slice(2, 3)[0],
				id2 = id.split('.').slice(2, -1).join('.'),
				id1 = id2.split(':')[0],
				id3 = id.split('.').slice(-1)[0];
			// A.D(`Somebody (${state.from}) changed ${id} of "${id2}" type ${id1} to ${A.O(state)}`); 
			A.D(`Somebody (${state.from}) id0 ${id0} changed ${id} of "${id2}" type ${id3} to ${A.O(state)}`);
			let device = scanList[id0];
			if (!device) return A.W(`stateChange error no device found: ${id} ${A.O(state)}`);
			switch (id1) {
				case 'SP1':
				case 'SP2':
					device.set_power(state.val);
					A.I(`Change ${id} to ${state.val}`);
					device.oval = state.val;
					break;
				case 'RM2':
					if (id.indexOf(learnedName) === -1)
						return startLearning(id2);
					//				A.D(`Maybe I should send command from ${id0} changed ${id} of "${id2}" type ${id1} to ${id3}`);
					return isSignalCode(state.val) && sendCode(device, state.val) ||
						A.getObject(id)
						.then((obj) =>
							obj && obj.native && obj.native.code ?
							sendCode(device, codeName + obj.native.code) :
							null);
				default:
					return A.W(`stateChange error invalid id type: ${id}=${id1} ${A.O(state)}`);
			}
		}
	};

	connection.on("deviceReady", function (device) {
		const typ = device.getType();
		//		device.typ = typ;
		A.I(`Device type ${typ} dedected: ${A.O(device, 1)}`);
		A.c2p(dns.reverse)(device.host.address)
			.then(x => x.toString().trim().endsWith(adapter.config.ip) ? x.toString().trim().slice(0, x.length - adapter.config.ip.length - 1) : x, () => device.host.address.split('.').join('-'))
			.then(x => device.name = typ + ':' + x)
			.then(x => {
				if (scanList[x]) {
					return A.W(`Device found already: ${x} with ${A.O(scanList[x])} and ${A.O(device)}`);
				}
				scanList[x] = device;
				device.iname = x;
				device.oval = false;
				switch (device.type) {
					case 'SP2':
						device.on('payload', (err, payload) => {
							let nst = x + '_STATE',
								res = !!payload[4];
							if (payload !== null && (payload[0] == 1 || payload[0] == 2)) {
								//								A.D(`Device ${nst} sent cmd ${err}/${err.toString(16)} with "${res}"`);
								if (device.oval != res) {
									device.oval = res;
									return A.makeState(nst, res, true);
								}
							} else A.W(`Device ${nst} sent err:${err}/${err.toString(16)} with ${payload.toString('hex')}`);
						});
						break;
					case 'RM2':
						device.on('temperature', (val) => {
							let nst = x + tempName;
							//							A.D(`Received temperature ${val} from ${x}`);
							if (device.ltemp != val) {
								device.ltemp = val;
								A.makeState(nst, val, true);
							}
						});
						//						return makeState(x,false,{name: device.name, host: device.host, type: device.type });
						break;
				}
			}).catch(e => A.W(`Error in device dedect: "${e}"`));
		return false;
	}).discover();

	A.D('Config IP-Address end to remove: ' + adapter.config.ip);
	A.wait(10000)
		.then(() => A.series(Object.keys(scanList), devid => {
			const device = scanList[devid],
				typ = device.getType();
			let nst = devid + '_STATE';

			A.D(`Process item ${devid} with ${A.O(device)}`);
			switch (typ) {
				case 'SP2':
				case 'SP1':
					let common = {
						id: nst,
						write: true,
						role: 'switch',
						type: typeof true,
						native: {
							host: device.host
						}
					};
					return A.makeState(common, undefined)
						.then(() => A.getState(nst))
						.then(x => A.D(`New State ${nst}: ${A.O(x)}`))
						.then(() => device.check_power && device.check_power())
						.catch(e => A.W(`Error in StateCreation ${e}`));
				case 'RM2':
					nst = devid + learnName;
					let st1 = {
						id: devid + learnName,
						write: true,
						role: 'button',
						type: typeof true,
						native: {
							host: device.host
						}
					};
					let st2 = {
						id: devid + tempName,
						role: "value.temperature",
						write: false,
						unit: "°C",
						type: typeof 1.1
					};
					return A.makeState(st1, undefined)
						.then(() => A.getState(nst))
						.then(x => A.D(`New State ${nst}: ${A.O(x)}`))
						.then(() => A.makeState(st2, undefined))
						.then(() => device.checkTemperature && device.checkTemperature())
						//					.then(x => makeState(devid+'.learnedStates.__DUMMY__',".... Dummy Entry ....",{name: device.name, type: device.type}))
						.catch(e => A.W(`Error in StateCreation ${e}`));
					//					.then(() => startLearning(devid));
				default:
					A.W(`unknown device type ${typ} for ${devid} on ${A.O(device)}`);
					return Promise.resolve(devid);
			}
		})).then(() => {
			const p = parseInt(adapter.config.poll);
			if (p) {
				setInterval(doPoll, p * 1000);
				A.D(`Poll every ${p} secods.`);
			}
		})
		.then(() => A.I(`Adapter ${A.ains} started and found ${Object.keys(scanList).length} devices named ${Object.keys(scanList)}.`), e => A.W(`Error in main: ${e}`))
		.then(() => adapter.subscribeStates('*'))
		.catch(e => A.W(`Unhandled error in main: ${e}`));
	//	adapter.subscribeObjects('*');
	//	adapter.setState('enableLearningMode', { val: false, ack: true });
}