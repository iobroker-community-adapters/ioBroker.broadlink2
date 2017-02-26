"use strict";
var utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink'),
	broadlink = require(__dirname + '/lib/broadlink'),
	currentDevice;

const NAMESPACE_IR = 'IR_Signals';

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
	try {
		adapter.log.info('cleaned everything up...');
		callback();
	} catch (e) {
		callback();
	}
}).on('objectChange', function (id, obj) {
	// Warning, obj can be null if it was deleted
	adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
}).on('stateChange', function (id, state) {
	// you can use the ack flag to detect if it is status (true) or command (false)
	if (state && !state.ack) {

		// Send IR Signal
		if (id.indexOf(adapter.namespace + '.' + NAMESPACE_IR) === 0) {
			var rawId = getRawIrObjectId(id);
			var buffer = new Buffer(rawId, 'hex');
			currentDevice.sendData(buffer);
			adapter.log.debug('sendData to ' + currentDevice.host.address + ', IR-HEX: ' + rawId);
		} else if (id === adapter.namespace + '.enableLearningMode') {
			if (state.val) {
				enterLeaningMode();
			}
		}
	}
}).on('message', function (obj) {
	if (typeof obj == 'object' && obj.message) {
		if (obj.command == 'send') {
			// e.g. send email or pushover or whatever
			//console.log('send command');

			// Send response in callback if required
			//if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
		}
	}
}).on('ready', function () {
	adapter.log.info('Discover UDP devices');
	var connection = new broadlink();
	// @TODO: check if works if connection is lost, e.g. the broadlink get off from power or net
	connection.on("deviceReady", function (device) {
		if (device.host.address == adapter.config.ip) {
			currentDevice = device;
			adapter.log.info('Device connected: ' + adapter.config.ip);
			main();
			return false;
		}
	}).discover();
});

function getRawIrObjectId(id) {
	var newId = id.replace(adapter.namespace + '.' + NAMESPACE_IR + '.', '');
	adapter.log.debug('Object ID converted to IR: ' + newId);
	return newId;
}

function enterLeaningMode() {
	adapter.log.info('Enter learning mode - Wait 30 seconds for data before leaving...');
	var timer = setInterval(function () {
		adapter.log.debug("IR-Learning-Mode - check data...");
		currentDevice.checkData();
	}, 1000);

	var leaveLearningMode = (function () {
		clearInterval(timer);
		adapter.setState('enableLearningMode', {val: false, ack: true});
		adapter.log.info('Leaved learning mode');
	});

	currentDevice.enterLearning();
	currentDevice.on("rawData", function (data) {
		var b = new Buffer(data);
		var hex = b.toString('hex');
		adapter.log.info('Learned IR-HEX: ' + hex);
		leaveLearningMode();

		// Before create new object check one with the same id already exists
		adapter.getObject(NAMESPACE_IR + '.' + hex, function (err, obj) {
			if (err) {
				adapter.log.error(err);
			} else {
				if (!obj) {
					adapter.setObject(NAMESPACE_IR + '.' + hex, {
						type: 'state',
						common: {
							name: '>>> Learned, please describe',
							type: 'boolean',
							role: '',
							read: false,
							write: true
						},
						native: {}
					});
					adapter.log.info('New IR-Code created in ' + NAMESPACE_IR);
				} else {
					adapter.log.info('IR-Code already exists: ' + obj.common.name);
				}
			}
		});
	});

	// Leave learning mode after 30 seconds
	setTimeout(leaveLearningMode, 30000);
}

function main() {
	//adapter.log.info('Config IP-Address: ' + adapter.config.ip);

	adapter.setObject(NAMESPACE_IR, {
		type: 'channel',
		common: {
			name: 'IR_Signals'
		},
		native: {}
	});
	adapter.setObject(NAMESPACE_IR + '.000000', {
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
	adapter.setObject('enableLearningMode', {
		type: 'state',
		common: {
			name: 'Enable learning mode',
			type: 'boolean',
			role: '',
			read: false,
			write: true
		},
		native: {}
	});

	// in this broadlink all states changes inside the adapters namespace are subscribed
	adapter.subscribeStates('*');


	/**
	 *   setState examples
	 *
	 *   you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
	 *
	 */

	// the variable testVariable is set to true as command (ack=false)
	//adapter.setState('testVariable', true);

	// same thing, but the value is flagged "ack"
	// ack should be always set to true if the value is received from or acknowledged from the target system
	//adapter.setState('testVariable', {val: true, ack: true});

	// same thing, but the state is deleted after 30s (getState will return null afterwards)
	//adapter.setState('testVariable', {val: true, ack: true, expire: 30});


	// examples for the checkPassword/checkGroup functions
	//adapter.checkPassword('admin', 'iobroker', function (res) {
	//    console.log('check user admin pw ioboker: ' + res);
	//});

	//adapter.checkGroup('admin', 'admin', function (res) {
	//    console.log('check group user admin group admin: ' + res);
	//});


	adapter.setState('enableLearningMode', {val: false, ack: true});
	//enterLeaningMode();
}
