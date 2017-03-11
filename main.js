"use strict";
var utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink'),
	broadlink = require(__dirname + '/lib/broadlink'),
	zlib = require('zlib'),
	currentDevice;

const NAMESPACE_LEARNED_CHANNEL = 'learnedSignals';

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
	try {
		// adapter.log.info('cleaned everything up...');
		callback();
	} catch (e) {
		callback();
	}
}).on('objectChange', function (id, obj) {
	// Warning, obj can be null if it was deleted
	// adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
}).on('stateChange', function (id, state) {
	// you can use the ack flag to detect if it is status (true) or command (false)
	if (state && !state.ack) {
		if (id === adapter.namespace + '.enableLearningMode') {
			if (state.val) {
				enterLeaningMode();
			}
		} else {
			var objectIdCode = id.split('.').pop();
			adapter.log.debug('Preparing to send: ' + objectIdCode);

			if (isSignalCode(objectIdCode)) {
				sendCode(objectIdCode);
			} else {
				// If the object is not a signal code, check the name of the object
				adapter.getObject(id, function (err, obj) {
					if (err) {
						adapter.log.error(err);
					} else if (obj.common.name) {
						if (isSignalCode(obj.common.name)) {
							sendCode(obj.common.name)
						}
					}
				});
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

function sendCode(value) {
	var buffer = new Buffer(value.substr(5), 'hex'); // substr(5) removes CODE_ from string
	currentDevice.sendData(buffer);
	adapter.log.debug('sendData to ' + currentDevice.host.address + ', Code: ' + value);
}

function isSignalCode(value) {
	return value.length > 21 && value.substr(0, 5) == 'CODE_';
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
		var hex = data.toString('hex');
		adapter.log.info('Learned IR-HEX: ' + hex);

		leaveLearningMode();

		// Before create new object check one with the same id already exists
		adapter.getObject(NAMESPACE_LEARNED_CHANNEL + '.' + hex, function (err, obj) {
			if (err) {
				adapter.log.error(err);
			} else {
				if (!obj) {
					adapter.setObject(NAMESPACE_LEARNED_CHANNEL + '.CODE_' + hex, {
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
					adapter.log.info('New IR-Code created in ' + NAMESPACE_LEARNED_CHANNEL);
				} else {
					adapter.log.info('IR-Code already exists: ' + obj.common.name);
				}
			}
		});
	});

	// Leave learning mode after 30 seconds, because the device itself has an built in timeout
	setTimeout(leaveLearningMode, 30000);
}

function main() {
	//adapter.log.info('Config IP-Address: ' + adapter.config.ip);

	adapter.setObject(NAMESPACE_LEARNED_CHANNEL, {
		type: 'channel',
		common: {
			name: ''
		},
		native: {}
	});
	adapter.setObject(NAMESPACE_LEARNED_CHANNEL + '.000000', {
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
			name: 'Enable learning mode. Result saved in ' + NAMESPACE_LEARNED_CHANNEL,
			type: 'boolean',
			role: '',
			read: false,
			write: true
		},
		native: {}
	});

	adapter.subscribeStates('*');
	adapter.setState('enableLearningMode', {val: false, ack: true});
}
