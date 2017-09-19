/**
 *      iobroker bmw Adapter
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
// jshint node:true, esversion:6, strict:global, undef:true, unused:true
"use strict";
const utils = require('./lib/utils'),
	adapter = utils.adapter('broadlink2'),
	broadlink = require('./lib/broadlink'),
	dns = require('dns'),
	assert = require('assert'),
	A = require('./myAdapter');

const scanList = {},
	tempName = '.Temperature',
	humName = '.Humidity',
	lightName = '.Light',
	lightRAWName = '.LightRAW',
	airQualityName = '.AirQuality',
	airQualityRAWName = '.AirQualityRAW',
	noiseName = '.Noise',
	noiseRAWName = '.NoiseRAW',
	learnName = '.Learn',
	learnedName = '.LearnedStates.',
	codeName = "CODE_",
	reCODE = /^CODE_|^/,
	reIsCODE = /^CODE_[a-f0-9]{16}/,
	defaultName = '>>> Rename learned @ ';

var currentDevice;

A.init(adapter, main); // associate adapter and main with MyAdapter

A.objChange = function (obj) {
	//	A.D(`objChange called for${obj._id} = ${that.O(obj)}`, id);
	if (typeof obj === 'string' && obj.indexOf(learnedName) > 0)
		return A.getObject(obj)
			.then(oobj => {
				const nst = oobj.common,
					ncn = nst.name,
					dev = obj.split('.'),
					fnn = dev.slice(2, -1).concat(ncn).join('.');
				if (ncn == dev[4] || ncn.startsWith(defaultName)) // no need to rename!
					return null;
				if (!A.states[fnn] ? (ncn.match(/[\.\,\;]/g) || !oobj.native.code ?
						A.W(`Cannot rename to ${oobj.common.name} because it includes charaters like ".,;" or does not have a learned code: ${obj}`, true) :
						false) :
					A.W(`Cannot rename to ${ncn} because the name is already used: ${obj}`, true)) {
					oobj.common.name = dev[4];
					return A.setObject(obj, oobj)
						.catch(e => A.W(`rename back err ${e} on ${A.O(oobj)}!`));
				}
				nst.id = (dev[2] + learnedName + ncn);
				nst.native = oobj.native;
				nst.val = codeName + oobj.native.code;

				if (oobj.common.name != dev[4])
					return A.makeState(nst, nst.val, true)
						.then(() => A.removeState(A.I(`rename ${obj} to ${fnn}!`, obj)).catch(() => true));
			})
			.catch(err => A.W(`objChange error: ${obj}} ${err}`));
};

A.stateChange = function (id, state) {

	function sendCode(currentDevice, value) {
		let buffer = new Buffer(value.replace(reCODE, ''), 'hex'); //var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string

		currentDevice.sendData(buffer);
		A.D('sendData to ' + currentDevice.name + ', Code: ' + value);
	}

	function startLearning(name) {
		A.I('Start learning for device: ' + name);
		const device = scanList[name];
		assert(!!device, `wrong name "${name}" in startLearning`);
		var learned = 35;
		device.emitter.once("rawData", data => { // use currentDevice.emitter.once, not the copy currentDevice.on. Otherwise this event will be called as often you call currentDevice.on()
			const hex = data.toString('hex');
			learned = 0;
			A.getObjectList({
					startkey: A.ain + name + learnedName,
					endkey: A.ain + name + learnedName + '\u9999'
				})
				.catch(() => ({
					rows: []
				}))
				.then(res => {
					for (let i of res.rows)
						if (i.doc.native.code == hex) // ? i.doc.common.name
							return Promise.reject(i.doc.common.name);
					return true;
				})
				.then(() => A.makeState({
						id: name + learnedName + codeName + hex,
						name: `${defaultName}${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "")}`,
						write: true,
						role: 'button',
						type: 'string',
						native: {
							code: hex
						}
					}, codeName + hex, A.I(`Learned new Code ${device.name} (hex): ${hex}`, true)),
					nam => A.I(`Code alreadly learned from: ${device.name} with ${nam}`))
				.catch(err => A.W(`learning makeState error: ${device.name}} ${err}`));
		});
		device.enterLearning();
		A.retry(learned, () => --learned <= 0 ?
				Promise.resolve() :
				A.wait(A.D(`Learning for ${device.name} wait ${learned} `, 1000))
				.then(() => Promise.reject(device.checkData())))
			//			.catch(e => e)
			.then(() => A.I(`Stop learning for ${name}!`), () => A.I(`Stop learning for ${name}!`));
	}

	//	A.D(`stateChange of "${id}": ${A.O(state)}`); 
	if (!state.ack) {
		let idx = id.split('.'),
			id0 = idx.slice(2, 3)[0].endsWith('_STATE') ? idx.slice(2, 3)[0].slice(0, -6) : idx.slice(2, 3)[0],
			id2 = (idx.slice(2, 3)[0].endsWith('_STATE') ? idx.slice(-1) : idx.slice(2, 3))[0],
			id1 = id2.split(':')[0],
			id3 = idx.slice(-1)[0];
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
				return reIsCODE.test(state.val) && sendCode(device, state.val) ||
					A.getObject(id)
					.then((obj) =>
						obj && obj.native && obj.native.code ?
						sendCode(device, obj.native.code) :
						null);
			default:
				return A.W(`stateChange error invalid id type: ${id}=${id0} ${A.O(state)}`);
		}
	}
};


function main() {

	function doPoll() {
		A.seriesOf(A.obToArray(scanList), device =>
			Promise.resolve(device.checkTemperature && device.checkTemperature(),
				device.check_sensors && device.check_sensors(),
				device.check_power && device.check_power()), 50);
	}

	A.unload = () => {
		if (currentDevice) {
			currentDevice.closeConnection();
			currentDevice = null;
		}
		A.D('Closed connection/listener');
	};

	A.I('Discover UDP devices for 10sec on ' + A.ains);
	let connection = new broadlink();

	if ((A.debug = adapter.config.ip.startsWith('debug!')))
		adapter.config.ip = adapter.config.ip.slice(A.D(`Debug mode on!`, 6)).trim();

	connection.on("deviceReady", function (device) {
		const typ = device.getType();
		//		device.typ = typ;
		A.I(`Device type ${typ} dedected: ${A.O(device, 1)}`);
		A.c2p(dns.reverse)(device.host.address)
			.then(x => x.toString().trim().endsWith(adapter.config.ip) ?
				x.toString().trim().slice(0, x.length - adapter.config.ip.length - 1) :
				x, () => device.host.address)
			.then(x => device.name = typ + ':' + x.split('.').join('-'))
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
						break;
					case 'A1':
						device.on("payload", function (err, payload) {
							let nst = x + tempName;
							if (!payload)
								return;
							
							var param = payload[0];
							switch (param) {
								case 1:
									
									var nnLight = { 0:"dunkel", 1:"dämerung", 2:"normal", 3:"hell"};
									var nnair = { 0:"sehr gut", 1:"gut", 2:"normal", 3:"schlecht"};
									var nnnoise = { 0:"ruhig", 1:"normal", 2:"laut"};									
									
									 data = {};
									 data['temperature'] = (payload[0x4] * 10 + payload[0x5]) / 10.0;
									 data['humidity'] = (payload[0x6] * 10 + payload[0x7]) / 10.0;
									 data['light'] = payload[0x8];
									 data['air_quality'] = payload[0x0a];
									 data['noise'] = payload[0xc];
																			 
									 A.makeState(x + tempName, data['temperature'],{name: device.name, host: device.host, type: typeof 1.1, role: "value.temperature", write: false, unit: "°C"});
									 A.makeState(x + humName, data['humidity'],{name: device.name, host: device.host, type:  typeof 1.1, role: "value.temperature", write: false, unit: "°C"})
									 A.makeState(x + lightName, nnLight[data['light']],{name: device.name, host: device.host, type: typeof "string"});
									 A.makeState(x + lightRAWName, data['light'],{name: device.name, host: device.host, type: typeof 1});
									 A.makeState(x + airQualityName, nnair[data['air_quality']],{name: device.name, host: device.host, type: typeof "string" });
									 A.makeState(x + airQualityRAWName, data['air_quality'],{name: device.name, host: device.host, type: device.type, type: typeof 1 });		
									 A.makeState(x + noiseName, nnnoise[data['noise']],{name: device.name, host: device.host, type: device.type, type: typeof "string" });
									 A.makeState(x + noiseRAWName, data['noise'],{name: device.name, host: device.host, type: device.type, type: typeof 1 });												 								 							 
									
									break;
								case 4: //get from check_data
									var data = Buffer.alloc(payload.length - 4, 0);
									payload.copy(data, 0, 4);
									//this.emit("rawData", data);
									this.emitter.emit("rawData", data);
									break;
								case 3:
									break;
								case 4:
									break;
							}
						})
						break; 						
						
				}
			}).catch(e => A.W(`Error in device dedect: "${e}"`));
		return false;
	}).discover();

	A.D('Config IP-Address end to remove: ' + adapter.config.ip);
	A.wait(10000)
		.then(() => A.seriesIn(scanList, devid => {
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
						//						.then(x => A.D(`New State ${nst}: ${A.O(x)}`))
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
						.catch(e => A.W(`Error in StateCreation ${e}`));
				case 'A1':
					return  device.check_sensors && device.check_sensors();
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
}
