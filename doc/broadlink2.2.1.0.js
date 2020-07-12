/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable complexity */
/**
 *      iobroker bmw Adapter
 *      (c) 2016- <frankjoke@hotmail.com>
 *      MIT License
 */
// jshint node:true, esversion:6, strict:true, undef:true, unused:true
"use strict";
const
	Broadlink = require('./broadlink_fj.js'),
	A = require('./fjadapter.js');
//	utils = require('./lib/utils'),
//	adapter = utils.Adapter('broadlink2'),

const scanList = {},
	tempName = '.Temperature',
	humName = '.Humidity',
	lightName = '.Light',
	airQualityName = '.AirQuality',
	noiseName = '.Noise',
	learnRf = 'RF',
	learnIr = '',
	learnName = '._Learn',
	sendName = '._SendCode',
	sceneName = '_SendScene',
	scenesName = 'Scenes',
	statesName = 'States',
	learnedName = '.L.',
	scanName = '_NewDeviceScan',
	reachName = '._notReachable',
	codeName = "CODE_",
	reCODE = /^CODE_|^/,
	reIsCODE = /^CODE_[a-f0-9]{16}/,
	defaultName = '_Rename_learned_';

let brlink, adapterObjects = [],
	states = {};

// eslint-disable-next-line no-unused-vars
A.init(module, 'broadlink2', main); // associate adapter and main with MyAdapter


//A.I('Adapter starting...');
// eslint-disable-next-line
A.objChange = async function (obj, val) { //	This is needed for name changes
	//	A.I(A.F(obj,' =O> ',val));
	val = val || A.D(' objChange val not defined');
	if (typeof obj === 'string' && obj.indexOf(learnedName) > 0) try {
		const oobj = A.getObject(obj);
		A.Df('get object %O gets changed to  %O', oobj, obj);
		const nst = oobj.common,
			ncn = nst.name,
			nid = ncn.replace(A.adapter.FORBIDDEN_CHARS, '_'),
			dev = obj.split('.'),
			fnn = dev.slice(2, -1).concat(nid).join('.');
		if (nid === dev[4] || nid.startsWith(defaultName)) // no need to rename!
			return null;
		if (!A.states[fnn] ? (!oobj.native.code ? A.W(`Cannot rename to ${oobj.common.name} because it does not have a learned code: ${obj}`, true) : false) :
			A.W(`Cannot rename to ${ncn} because the name is already used: ${obj}`, true)) {
			oobj.common.name = dev[4];
			return A.setObject(obj, oobj)
				.catch(e => A.W(`rename back err ${e} on ${A.O(oobj)}!`));
		}
		nst.id = (dev[2] + learnedName + nid);
		nst.native = oobj.native;
		//				nst.val = codeName + oobj.native.code;
		if (nid !== dev[4]) {
			await A.makeState(nst, false, true);
			await A.removeState(A.I(`rename ${obj} to ${fnn}!`, obj)).catch(A.nothing);
			A.wait(100);
		}
	} catch (err) {
		A.W(`objChange error: ${obj} ${err}`);
	}
	return true;
};

function sendCode(device, value) {
	let buffer = new Buffer(value.replace(reCODE, ''), 'hex'); //var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string

	return device.sendVal(buffer).then(x => device.name + ' sent ' + value + ', ' + x);
	//	return Promise.resolve(A.D('sendData to ' + device.name + ', Code: ' + value));
}

// eslint-disable-next-line complexity
A.stateChange = async function (id, state) {
	A.Df('Change %s to %O', id, state);

	let thisDevice;

	async function startLearning(name, type) {

		async function learnMsg(text) {
			A.I(text);
			await A.makeState(name, text, true);
		}

		thisDevice = scanList[name];
		if (!thisDevice) throw Error(`wrong name "${name}" in startLearning`);
		if (thisDevice.learning) {
			const err = A.W(`Device ${name} is still in learning mode and cannot start it again!`);
			throw new Error(err);
		}
		// A.I(`Start ${type}-learning for device: ${name}`);

		// await A.makeState(name, thisDevice.learning = true, true);
		const l = type === learnRf && thisDevice.learnRf ? await thisDevice.learnRf(learnMsg) : await thisDevice.learn(learnMsg);
		await A.makeState(name, "", true);
		// A.I(`Stop learning ${type} for ${name}!`);
		if (l.data) try {
			const hex = l.data;
			const res = await A.getObjectList({
					startkey: A.ain + thisDevice.name + learnedName,
					endkey: A.ain + thisDevice.name + learnedName + '\u9999'
				})
				.catch(() => ({
					rows: []
				}));
			for (let i of res.rows)
				if (i.doc.native.code === hex) // ? i.doc.common.name
					return A.I(`Code alreadly learned from: ${thisDevice.name} with ${i.doc.common.name + ':' + i.doc._id}`);
			await A.makeState({
				id: thisDevice.name + learnedName + codeName + hex,
				name: `${defaultName} ${type} ${A.dateTime()}`,
				write: true,
				role: 'button',
				type: typeof true,
				native: {
					code: hex
				}
			}, false, true);
			A.I(`Learned new ${type} Code ${thisDevice.name} (hex): ${hex}`);
		} catch (err) {
			A.W(`learning makeState error: ${thisDevice.name}} ${err}`);
		}
	}

	function checkT1(device, state, id) {
		if (id.endsWith('._setTime')) return device.setTime();
		if (id.endsWith('.autoMode')) return device.setMode(state.val);
		if (id.endsWith('.loopMode')) return device.setMode(undefined, state.val);
		if (id.endsWith('.sensor')) return device.setMode(undefined, undefined, state.val);
		if (id.endsWith('.thermostatTemp')) return device.setTemp(state.val);
		if (id.endsWith('.remoteLock')) return device.setPower(undefined, state.val);
		if (id.endsWith('.power')) return device.setPower(state.val);
		for (let e of ['.loopMode', '.sensor', '.osv', '.dif', '.svh', '.svl', '.roomTempAdj', '.fre', '.poweron'])
			if (id.endsWith(e))
				return device.setAdvanced(e.slice(1), state.val);
		for (let e of ['.startHour', '.startMinute', '.temp'])
			if (id.endsWith(e)) {
				let i = id.split('.');
				device._val[i[1]][parseInt(i[2].slice(1)) - 1][i[3]] = state.val;
				return device.setSchedule(id, state.val);
			}
		return A.reject(A.Wf("checkT1 don't know how to set %s of %s to %O", id, device.name, state.val));
	}

	function checkLB(device, state, id) {
		const item = id.split('.').slice(-1)[0];
		// A.I(`would like to set ${device.name}.${item} to ${state.val}`);
		return device.setItem(item, state.val);
	}

	//	A.D(`stateChange of "${id}": ${A.O(state)}`); 
	if (!state.ack) {
		if (id.startsWith(A.ain))
			id = id.slice(A.ain.length);
		let idx = id.split('.'),
			id0 = idx[0],
			temp = {};
		if (id0 === scanName && idx.slice(-1)[0] === scanName) return deviceScan();
		if (id0 === sceneName && idx.slice(-1)[0] === sceneName) {
			const scene = state.val;
			state.val = true;
			return sendScene(scene, state);
		}
		//		A.D(`Somebody (${state.from}) id0 ${id0} changed ${id} of "${id0}" to ${A.O(state)}`);
		if (id0 === scenesName) {
			const obj = await A.getObject(id);
			if (obj && obj.native && obj.native.scene) await sendScene(obj.native.scene, state);
			else return A.D(`Invalid command "${id}" in scenes`);
		}
		if (id0 === statesName) {
			const obj = await A.getObject(id);
			if (obj && obj.native && obj.native.state) await sendState(obj.native.state, state.val);
			else return A.D(`Invalid command "${id}" in states`);
		}
		let device = scanList[id0];
		if (!device) return A.W(`stateChange error no device found: ${id} ${A.O(state)}`);
		switch (device.typ) {
			case 'SP':
				await device.setVal(A.parseLogic(state.val));
				A.I(`Change ${id} to ${state.val}`);
				return (device.oval = state.val);
			case 'RM':
				if (id.endsWith(sendName))
					return state.val.startsWith(codeName) ? sendCode(device, state.val) :
						A.W(`Code to send to ${id0} needs to start with ${codeName}`);
				if (id.endsWith(learnName + learnIr)) return startLearning(id0, learnIr);
				if (id.endsWith(learnName + learnRf)) return startLearning(id0, learnRf);
				if (reIsCODE.test(state.val)) await sendCode(device, state.val);
				else {
					const obj = await A.getObject(id);
					if (obj && obj.native && obj.native.code) {
						await setState(obj.common.name);
						await sendCode(device, obj.native.code);
						return true;
					}
					A.W(`cannot get code to send for: ${id}=${id0} ${A.O(state)}`);
				}
				break;
			case 'T1':
				await checkT1(device, state, id);
				temp = await device.getAll();
				if (temp && temp.here && device.update)
					await device.update(temp);
				break;
			case 'LB':
				await checkLB(device, state, id);
				// temp = await device.getAll();
				// if (temp && temp.here && device.update)
				await device.update(device._val);
				break;
			default:
				return A.W(`stateChange error invalid id type: ${id}=${id0} ${A.O(state)}`);
		}
	}
};

async function deviceScan() {
	if (!brlink) throw new Error(A.W(`No current driver to start discover!`));
	if (brlink.scanning) throw new Error(A.W(`Scan operation in progress, no new scan can be started until it finished!`));
	try {
		await A.makeState({
			id: scanName,
			write: true,
			role: 'button',
			type: typeof true,
		}, brlink.scanning = true, true);
		await brlink.discover();
		for (const a of additional) {
			A.D(`Try to discover ${a}`);
			await brlink.discover({
				address: a
			}, 3000);
		}
		await A.wait(1000); // 6s for the scan of ip' should be OKs
		await A.makeState(scanName, brlink.scanning = false, true);
	} catch (err) {
		A.W(`Error in deviceScan: ${brlink.scanning = false, A.O(err)}`);
	}
	return null;
}

function sendScene(scene, st) {
	const s = A.T(scene, []) ? A.trim(scene) : A.T(scene, '') ? A.trim(scene.split(',')) : `error in scene: neither a string nor an Array!: ${A.O(scene)}`;
	const sn = s.map(ss => A.trim(ss) === parseInt(ss).toString() ? parseInt(ss) : A.trim(ss));
	return A.seriesOf(sn, i => {
		if (typeof i === 'number')
			return A.wait(i);
		const mm = i.match(/^\s*(\d+)\s*\(\s*(\S+)\s*\)\s*(\d*)\s*$/);
		if (mm)
			return A.repeat(mm[1], () => sendScene([mm[2]], st).then(() => A.wait(mm[3] ? mm[3] : 300)));
		if (i.split('=').length === 2) {
			let s = A.trim(i.split('='));
			i = s[0];
			st.val = s[1];
		} else st.val = true;
		const f = adapterObjects.filter(x => x.common.name === i);
		if (f.length === 1)
			i = f[0]._id;
		else if (f.length > 1)
			A.W(`Multiple states with name '${i}: ${f.map(x => x._id)}`);
		if (i.startsWith(A.ain))
			i = i.slice(A.ain.length);

		const j = A.trim(i.split('.')),
			id = j[0],
			code = j[1],
			dev = scanList[id],
			typ = dev ? dev.type.slice(0, 2) : '';
		if (dev && typ === 'RM' && code.startsWith(codeName))
			return sendCode(scanList[id], code);

		if (typ === 'RM' || typ == 'SP' || i.startsWith(scenesName + '.'))
			return A.stateChange(i, st);

		if (i.startsWith(statesName + '.'))
			return A.stateChange(i, {
				val: st.val
			});

		return A.getState(i).then(() =>
			A.setForeignState(i, st, false),
			(err) => A.W(`id ${i[0]} not found in scene ${scene} with err: ${A.O(err)}`));
	}, 100);
}

A.messages = (msg) => {
	if (A.T(msg.message) !== 'string')
		return A.W(`Wrong message received: ${A.O(msg)}`);
	const st = {
		val: true,
		ack: false,
		from: msg.from
	};
	let id = msg.message.startsWith(A.ain) ? msg.message.trim() : A.ain + (msg.message.trim());
	let ids, idx, code;

	switch (msg.command) {
		case 'switch_off':
			st.val = false;
			/* falls through */
		case 'switch_on':
		case 'send':
			return A.getObject(id)
				.then(obj => obj.common.role === 'button' || (obj.common.role === 'switch' && msg.command.startsWith('switch')) ?
					A.stateChange(id, st) :
					Promise.reject(A.W(`Wrong id or message ${A.O(msg)} id = ${A.O(obj)}`)),
					err => Promise.reject(err))
				.then(() => A.D(`got message sent: ${msg.message}`));
		case 'send_scene':
			return sendScene(msg.message, st);

		case 'send_code':

			if (msg.message.startsWith(A.ain))
				msg.message = msg.message.slice(A.ain.length);
			ids = msg.message.split('.');
			code = ids[1];
			id = ids[0];
			if (!id.startsWith('RM:') || !scanList[id] || !code.startsWith(codeName))
				return Promise.reject(A.D(`Invalid message "${msg.message}" for "send" to ${id}${sendName}`));
			return Promise.resolve(A.D(`Executed on ${id} the message "${msg.message}"`), sendCode(scanList[id], code));
		case 'get':
			return A.getState(id);
		case 'switch':
			idx = A.split(msg.message, '=');
			if (idx.length !== 2 && !idx.startsWith('SP:'))
				return Promise.reject(A.D(`Invalid message to "switch" ${msg.message}" to ${idx}`));
			st.val = A.parseLogic(idx[1]);
			return A.stateChange(idx[0], st);
		default:
			return Promise.reject(A.D(`Invalid command "${msg.command}" received with message ${A.O(msg)}`));
	}
};

let discoverAll = 0;
let firsttime = true;

async function doPoll() {
	let na = [];
	discoverAll = discoverAll >= 9 ? 0 : ++discoverAll;
	for (const item of Object.entries(scanList)) {
		const [key, device] = item;
		if (device.learning) continue;
		if (!device.getAll || device.dummy) {
			if (!device.searchc) {
				device.searchm = 2;
				device.searchc = 1;
			}
			if (++device.searchc % device.searchm === 0) {
				na.push(device.host);
				if (device.searchm < 256) device.searchm *= 2;
			}
			// eslint-disable-next-line no-continue
			continue;
		}
		let x = await device.getAll();
		if (firsttime)
			A.Dr(x, 'Device %s returned %O', device.name, x);
		if (x && x.here && device.update) await device.update(x);
		if (x && x.here && !device.update) {
			x.noUpdateFunction = 'do not know how to update';
		} else if (!x)
			x = {
				here: false
			};
		//				A.Ir(x, 'Device %s will reject %O', device.name, x);
		if (!x.here) {
			A.Df('device %s not reachable, waiting for it again %O', device.name, x);
			if (device.lastResponse && device.lastResponse < Date.now() - 1000 * 60 * 5) {
				if (device.close)
					device.close();
				A.W(`Device ${device.name} not reachable, switched it off and will search for it every while.`);
				await A.makeState(device.name + reachName, device.unreach = true, true);
			}
		}
	}
	firsttime = false;
	if (na.length) {
		A.D(`should discover/search ${na}`);
		if (!discoverAll) await brlink.discover();
		for (const d of na) await brlink.discover(d, 2000);
	}
}

function setState(name) {
	name = name.trim();
	let str = null;
	for (let k in states) {
		const st = states[k];
		let where = A.includes(st.on, name) ? st.on : A.includes(st.off, name) ? st.off : null;
		if (where) {
			str = {
				state: st,
				index: (where === st.off ? -1 : st.on.indexOf(name))
			};
			break;
		}
	}
	if (!str)
		return Promise.resolve();
	if (str.index < 0) // was found in off so switch state off!
		return A.changeState(str.state.id, false, true);
	return A.changeState(str.state.id, str.state ? true : str.index);
}

function sendState(state, val) {
	var send = A.T(val, 0) && state.on[val];
	if (A.T(val, true))
		send = val ? state.on[0] : state.off[0];
	if (state.mult && val > 9) {
		const vals = val.toString().split('').map(x => parseInt(x));
		return A.seriesOf(vals, num => sendState(state, num), 300);
	}
	const sobj = adapterObjects.filter(x => x.common.name === send);
	if (sobj.length > 1)
		A.W(`sendState error: multiple commands for name ${send}, ill use only first instance: ${sobj[0]._id}!`);
	return (sobj && sobj.length ? A.getObject(sobj[0]._id.slice(A.ain.length)) : Promise.resolve(null)).catch(() => null)
		.then(obj => {
			if (!obj)
				return A.W(`sendState could not find command or scene named '${send}'`);
			return A.stateChange(obj._id, {
				val: true,
				ack: false
			});
		})
		.then(() => A.makeState(state.id, val, true))
		.catch(A.pE);
}

async function updateValues(device, val, values) {
	for (const item of values) {
		let i = Object.assign({}, item);
		const name = i.name;
		delete i.name;
		i.id = device.host.iname + (i.id || i.id === '' ? i.id : '.' + name);
		i.write = !!i.write;
		let v = val[name];
		i.native = {
			host: device.host
		};
		if (i.type === 'json') {
			i.type = 'string';
			v = JSON.stringify(v);
		}
		if (v !== undefined) {
			if (typeof i.fun === 'function')
				await i.fun(device, i, v);
			else
				await A.makeState(i, v, true);
		}
	}
}

let rename = [];
let additional = [];

function findName(name) {
	for (let i of rename)
		if (i[0] === name)
			return i[1];
	return null;
}


async function createStatesDevice(device) {

	function setp(dn) {
		return [{
			id: dn + '.startHour',
			name: 'startHour',
			write: true,
			type: typeof 1,
			role: "value",
		}, {
			id: dn + '.startMinute',
			name: 'startMinute',
			write: true,
			type: typeof 1,
			role: "value",
		}, {
			id: dn + '.temp',
			name: 'temp',
			write: true,
			type: typeof 1.0,
			role: "value.temperature",
		}];
	}
	let x = device.name;
	await A.makeState({
		id: x + reachName,
		write: false,
		role: 'indicator.unreach',
		type: typeof true,
		native: {
			host: device.host
		}
	}, device.unreach = false, true);
	switch (device.typ) {
		case 'SP':
			device.oval = undefined;
			device.update = async (val) => {
				//							A.If('Should update %s with %O', device.host.name, val);
				if (val.state !== undefined && device.oval !== val.state) {
					if (device.oval !== undefined)
						A.I(`Switch ${device.host.iname} changed to ${val.state} most probably manually!`);
					device.oval = val.state;
					await A.makeState({
						id: device.host.iname,
						write: true,
						role: 'switch',
						type: typeof true,
						native: {
							host: device.host
						},
						custom: {
							iobroker: {
								enabled: true,
								device: device.host
							}
						}
					}, val.state, true);
				}
				await updateValues(device, val, [{
						name: 'energy',
						id: '.CurrentPower',
						role: "level",
						write: false,
						unit: "W",
						type: typeof 1.1
					}, {
						name: 'nightlight',
						id: '.NightLight',
						role: "switch",
						write: true,
						type: typeof true
					}, {
						name: 'state',
						role: "switch",
						type: typeof true
					}])
					.catch(e => A.Wf('Update device %s Error: %O', device.host.name, e));
			};
			break;
		case 'S1':
			device.update = async (val) => {
				for (const i of A.ownKeysSorted(val)) {
					await A.makeState({
							id: device.host.iname + (i === 'here' ? '' : '.' + i),
							write: false,
							role: 'value',
							type: i === 'here' ? typeof true : typeof 1,
							native: {
								host: device.host
							}
						},
						val[i],
						true);
					await A.wait(1);

				}
			};
			break;
		case 'RM':
			device.ltemp = undefined;
			device.update = async (val) => {
				//							A.If('Should update %s with %O', device.host.name, val);
				await updateValues(device, val, [{
					id: tempName,
					role: "temperature",
					name: 'temperature',
					write: false,
					unit: "°C",
					type: typeof 1.1
				}, {
					id: humName,
					role: "value.humidity",
					name: 'humidity',
					min: 0,
					max: 100,
					write: false,
					unit: "%",
					type: typeof 1.1
				}]);
				await A.makeState({
					id: x,
					role: "value",
					write: true,
					type: typeof "",
				}, "", true);
				await A.makeState({
					id: x + learnName + learnIr,
					write: true,
					role: 'button',
					type: typeof true,
				}, false, true);
				await A.makeState({
					id: x + sendName,
					role: "text",
					write: true,
					type: typeof ''
				}, ' ', true);
				if (device.learnRf)
					await A.makeState({
						id: x + learnName + learnRf,
						write: true,
						role: 'button',
						type: typeof true,
					}, false, true);
			};
			break;
		case 'LB':
			device.update = async (val) => {
				await updateValues(device, val, [{
					name: 'pwr',
					type: typeof true,
					write: true,
					role: "switch.light",
				}, {
					name: 'brightness',
					type: typeof 1,
					role: "level.dimmer",
					write: true,
					min: 0,
					max: 100,
					unit: "%"
				}, {
					name: 'bulb_colormode',
					type: typeof 0,
					write: true,
					role: "level",
					min: 0,
					max: 7,
					states: "0:lovely color;1:flashlight;2:lightning;3:color fading;4:color breathing;5:multicolor breathing;6:color jumping;7:multicolor jumping",
				}, {
					name: 'bulb_scenes',
					type: "array",
					write: true,
					role: "level",
				}, {
					name: 'bulb_scene',
					type: typeof "",
					write: true,
					role: "level",
				}, {
					name: 'bulb_sceneidx',
					type: typeof 1,
					role: "level",
					write: true,
					min: 0,
					max: 255,
				}]);
			};
			break;
		case 'T1':
			device.setTime();
			device.update = async (val) => {
				//							A.If('Should update %s with %O', device.host.name, val);
				await A.makeState({
					id: x + '._setTime',
					type: typeof true,
					write: true,
					role: "button",
				}, true, true);
				await updateValues(device, val, [{
					id: '',
					name: 'roomTemp',
					type: typeof 1.1,
					role: "value.temperature",
					unit: "°C",
					native: {
						host: device.host
					}
				}, {
					name: 'thermostatTemp',
					write: true,
					type: typeof 1.1,
					role: "value.temperature",
					unit: "°C"
				}, {
					name: 'roomTempAdj',
					write: true,
					type: typeof 1.1,
					role: "value.temperature",
					unit: "°C"
				}, {
					name: 'externalTemp',
					type: typeof 1.1,
					role: "value.temperature",
					unit: "°C"
				}, {
					name: 'roomTemp',
					type: typeof 1.1,
					role: "value.temperature",
					unit: "°C"
				}, {
					name: 'remoteLock',
					type: typeof true,
					write: true,
					role: "switch",
				}, {
					name: 'power',
					type: typeof true,
					write: true,
					role: "switch",
				}, {
					name: 'active',
					type: typeof true,
					write: true,
					role: "switch",
				}, {
					name: 'time',
					type: typeof '',
					role: "value",
				}, {
					name: 'autoMode',
					type: typeof 0,
					role: "value",
					min: 0,
					max: 1,
					states: "0:manual;1:auto",
					write: true,
				}, {
					name: 'loopMode',
					type: typeof 0,
					write: true,
					role: "value",
					min: 1,
					max: 3,
					states: "1:weekend starts Saturday;2:weekend starts Sunday;3:All days are weekdays",
				}, {
					name: 'sensor',
					type: typeof 0,
					write: true,
					role: "value",
					min: 0,
					max: 2,
					states: "0:internal;1:external;2:internalControl-externalLimit"
				}, {
					name: 'weekday',
					fun: (device, i, v) => {
						let d = 0;
						return A.seriesOf(v, (x) => {
							let dn = '.weekday.s' + ++d;
							return updateValues(device, x, setp(dn));
						}, 0);
					}
				}, {
					name: 'weekend',
					fun: (device, i, v) => {
						let d = 0;
						return A.seriesOf(v, (x) => {
							let dn = '.weekend.s' + ++d;
							return updateValues(device, x, setp(dn));
						}, 0);
					}
				}, {
					name: 'osv',
					type: typeof 0.1,
					write: true,
					role: "value.temperature",
					unit: "°C",
					min: 5,
					max: 99
				}, {
					name: 'dif',
					type: typeof 0.1,
					write: true,
					role: "value.temperature",
					unit: "°C",
					min: 1,
					max: 9
				}, {
					name: 'svh',
					type: typeof 0.1,
					write: true,
					role: "value.temperature",
					unit: "°C",
					min: 5,
					max: 99
				}, {
					name: 'svl',
					type: typeof 0.1,
					write: true,
					role: "value.temperature",
					unit: "°C",
					min: 5,
					max: 99
				}]).catch(e => A.Wf('Update device %s Error: %O', device.host.name, e));
			};
			break;
		case 'A1':
			device.update = (val) =>
				updateValues(device, val, [{
					id: '',
					name: 'temperature',
					type: typeof 1.1,
					role: "value.temperature",
					write: false,
					unit: "°C",
				}, {
					id: humName,
					name: 'humidity',
					type: typeof 1.1,
					role: "value.humidity",
					write: false,
					min: 0,
					max: 100,
					unit: "%"
				}, {
					id: lightName,
					name: 'light',
					type: typeof 0,
					role: "value",
					min: 0,
					max: 3,
					states: "0:finster;1:dunkel;2:normal;3:hell"
				}, {
					id: airQualityName,
					name: 'air_quality',
					type: typeof 0,
					role: "value",
					min: 0,
					max: 3,
					states: "0:sehr gut;1:gut;2:normal;3:schlecht"
				}, {
					id: noiseName,
					name: 'noise',
					type: typeof 0,
					role: "value",
					min: 0,
					max: 3,
					states: "0:ruhig;1:normal;2:laut;3:sehr laut"
				}])
				.catch(e => A.Wf('Update device %s Error: %O', device.host.iname, e));

			break;
		default:
			A.Wf('Unknown %s with %O', device.host.iname, device.host);
	}
	return true;
}

let aif = "";
const macList = {};
const macObjects = {};
async function main() {

	function renId(id, oldid, newid) {
		if (id.startsWith(A.ain + oldid + '.'))
			return A.ain + newid + '.' + id.slice((A.ain + oldid + '.').length);
		return id;
	}

	let didFind = [],
		notFound = [];

	if (!A.C.new)
		A.C.new = '';

	if (A.C.new.endsWith('!')) {
		A.D(`Debug mode on!`);
		A.C.new = A.C.new.slice(0, -1);
		A.debug = true;
	}

	let add = A.C.new.split(',').map(x => x.split('=').map(s => s.trim()));
	if (add.length === 1 && add[0].length === 1)
		add = [];

	if (typeof A.C.interface === "string" && A.C.interface.length >=7)
		aif = A.C.interface;

	if (!A.C.rename)
		A.C.rename = '';
	rename = A.C.rename.split(',').map(x => x.split('=').map(s => s.trim()));
	if (rename.length === 1 && rename[0].length === 1)
		rename = [];
	rename = rename.map(x => [x[0], x[1].replace(A.adapter.FORBIDDEN_CHARS, '_')]);
	if (A.C.additional) {
		if (!Array.isArray(A.C.additional)) {
			A.C.additional = typeof A.C.additional == "string" ? A.C.additional.split(",").map(i => i.trim().toLowerCase()) : [];
		}
		if (A.C.additional.length == 1 && !A.C.additional[0])
			A.C.additional = [];
	} else A.C.additional = [];
	A.C.additional.map(i => additional.push(i));
	A.I(`Scanning additional IP's: ${additional.join(", ")}`);
	A.If('Devices to add: %s', add, add.map(x => x.join('=')).join(','));
	A.If('Devices to rename: %s', rename.map(x => x.join('=')).join(','));

	brlink = new Broadlink(add, aif);
	brlink.on("deviceReady", device => {
		// const typ = device.type.slice(0, 2);
		device.typ = device.type.slice(0, 2);
		const mac = device.host.mac;
		if (macList[mac] && macList[mac].host.name == device.host.name)
			return A.D(`Device ${device.host.name} already found!`);
		macList[mac] = device;
		device.removeAllListeners('error');
		device.on('error', A.W);
		//		A.If('what is name of %O', device);
		let x = macObjects[device.host.mac] && macObjects[device.host.mac].name;
		if (x && x != device.host.name)
			A.I(`Found new device (${device.host.name}) with mac ${device.host.mac} and gave it previous known name ${x}`);
		if (!x) x = findName(device.host.name);
		else if (findName(x)) x = findName(x);
		device.host.iname = x = device.name = x ? x : device.host.name;
		//	A.If('found device %s and named %s, in objects: %O', device.host.name, x, A.objects[device.host.name]);
		//	A.getObject(device.host.name).then(res => A.If('got object %s: %O', device.host.name, res)).catch(A.pE);
		if (scanList[x] && !scanList[x].dummy)
			return A.Wf(`Device found already: %s with %O`, x, device.host);
		A.If('Device %s dedected: address=%s, mac=%s, typ=%s, id=%s devtype=%s%s', x, device.host.address, device.host.mac, device.host.type, device.host.devhex, device.host.devname,
			device.host.name === device.name ? '' : ', originalName=' + device.host.name);
		scanList[x] = device;
	});

	A.unload = () => brlink.close.bind(brlink)(A.I('Close all connections...'));
	for (const ob of Object.entries(A.objects)) {
		const [key, obj] = ob;
		if (obj.native && obj.native.host) {
			if (macObjects[obj.native.host.mac]) {
				const m1 = macObjects[obj.native.host.mac];
				const n1 = m1.host.name;
				const n2 = obj.native.host.name;
				if (n1 != n2)
					A.W(`same broadlink mac in two different devices: '${m1.mac}' in '${n1}' and '${n2}', will keep first!`);
			} else macObjects[obj.native.host.mac] = obj.native;
		}
	}
	A.If('macObjects: %O', A.ownKeysSorted(macObjects));
	try {
		A.D('Config IP-Address end to remove: ' + A.C.ip);
		for (const scene of A.C.scenes) {
			await A.makeState({
				id: scenesName + '.' + scene.name.trim(),
				write: true,
				role: 'button',
				type: typeof true,
				native: {
					scene: scene.scene
				}
			}, false);
			await A.wait(1);
		}
		brlink.start15001();
		await deviceScan(A.I('Discover Broadlink devices for 10sec on ' + A.ains));
		for (const state of A.C.switches) {
			let name = state.name && state.name.trim(),
				on = state.on && state.on.trim(),
				off = state.off && state.off.trim();
			if (!name || !on) {
				A.W(`Invalid State without name or 'on' string: ${A.O(state)}`);
				continue;
			}
			if (!off || off === '')
				off = null;
			const mult = (off === '+');
			if (mult)
				off = null;
			on = A.trim(A.split(on, ','));
			const option = {
				id: statesName + '.' + name,
				name: name,
				type: off ? typeof true : typeof 0,
				role: off ? "switch" : "level",
				write: true,
			};
			if (!off) {
				option.min = 0;
				option.max = mult ? 9999 : on.length - 1;
				if (mult)
					option.states = null;
				else
					option.states = on.map((s, i) => `${i}:${s.trim()}`).join(';');
			}
			option.native = {
				state: {
					id: option.id,
					name: option.name,
					on: on,
					off: off ? A.trim(A.split(off, ',')) : null,
					mult: mult
				}
			};
			if (states[option.name]) {
				A.W(`double state name will be ignored: ${option.name}`);
				continue;
			}
			states[option.name] = option.native.state;
			await A.makeState(option, false, true);
			await A.wait(1);
		}
		for (const item of Object.entries(scanList)) {
			const [name, dev] = item;
			let oname = dev.host.name;
			let iname = dev.name;
			let oobj, iobj;
			oobj = await A.getObject(oname).catch(A.nop);
			iobj = await A.getObject(iname).catch(A.nop);

			if (oname != iname) {
				if (oobj && iobj) {
					A.Wf(`Got item which had original name of %s and new name of %s,\n please delete new one to get old renamed or old one if you don't need it's items anymore.`, oname, iname);
					//							A.getObjects(oname).then(res => A.If('olist =%O', res.map(x => x.id)));
				} else if (oobj) {
					A.If('Should rename %s to %s!', oname, iname);
					for (const item of Object.entries(A.objects)) {
						const [on, ob] = item;
						if (ob._id.startsWith(A.ain + oname + '.') && ob.native && ob.native.code) {
							let ns = Object.assign({}, ob.common);
							ns.name = renId(ns.name, oname, iname);
							ns.id = renId(ob._id, oname, iname);
							ns.native = ob.native;
							await A.makeState(ns, false, true);
						}
						await A.delState(ob._id);
						await A.delObject(ob._id);
					}
				}
			}
			await createStatesDevice(dev);
		}
		for (let i of A.ownKeys(A.objects))
			if (i.startsWith(A.ain))
				adapterObjects.push(A.objects[i]);
		A.Df('%s has %d old states!', A.name, adapterObjects.length);
		didFind = Object.keys(scanList);
		for (const dev of A.obToArray(A.objects).filter(x => x._id.startsWith(A.ain) && x.native && x.native.host)) {
			//		.then(() => A.seriesOf(A.obToArray(A.objects).filter(x => x._id.startsWith(A.ain) && x.native && x.native.host), dev => {
			let id = dev.native.host.name; // dev._id.slice(A.ain.length);
			if (id && !findName(id) && !scanList[id] && dev._id === A.ain + dev.common.name && dev.common.name.indexOf('.') < 0) {
				//			!id.endsWith(learnName + learnRf) && !id.endsWith(learnName + learnIr)) {
				//				A.If('found %s', id);
				let device = {
					name: id,
					fun: Promise.reject,
					host: dev.native.host,
					dummy: true,
					type: "closed",
				};
				if (brlink.getDev(dev.native.host.mac)) {
					device = brlink.getDev(dev.native.host.mac);
					A.Wf('seems that device %s got renamed to %s! You may delete old device and change your scripts!', id, device.name);
				} else {
					A.W(`device ${id} not found, please rescan later again or delete it! It was: ${A.obToArray(device.host)}`);
					scanList[id] = device;
					notFound.push(id);
				}
			}
		}
		for (const k of Object.keys(macObjects)) {
			const m = macObjects[k];
			let f = false;
			let d = null;
			for (const found of Object.keys(scanList)) {
				const dev = scanList[found];
				if (dev.host.mac == m.host.mac) {
					f = true;
					break;
				} else d = dev;
			}
			if (!f) {
				A.I(`Did not find ${A.O(m)}`);
				if (notFound.indexOf(m.host.name) < 0)
					notFound.push(m.host.name);
			}
		}
		await doPoll();
		await A.makeState({
			id: sceneName,
			write: true,
			role: 'text',
			type: typeof '',
		}, ' ', true);
		const p = parseInt(A.C.poll);
		if (p) {
			setInterval(doPoll, p * 1000);
			A.I(`Poll every ${p} secods.`);
		}
		A.I(`${A.ains} started and found ${didFind.length} devices named ${didFind.join(", ")}`);
		if (notFound.length > 0) A.I(`${notFound.length} were not found: ${notFound.join(", ")}`);
		A.I(`found macs: ${Object.keys(macList).join(', ')}`);
	} catch (e) {
		A.W(`Unhandled error in main: ${A.O(e)}`);
		A.stop();
	}
}