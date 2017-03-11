"use strict";
var utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink'),
	broadlink = require(__dirname + '/lib/broadlink'),
	zlib = require('zlib'),
	namespaceChannelLearned = 'learnedSignals',
	currentDevice;

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
	//if (currentDevice) {
		// Warning, obj can be null if it was deleted
		// adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
	//}
}).on('stateChange', function (id, state) {
	if (currentDevice) {
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
	}
}).on('message', function (obj) {
	//if (currentDevice) {
	//	if (typeof obj == 'object' && obj.message) {
	//		if (obj.command == 'send') {
	//			// e.g. send email or pushover or whatever
	//			console.log('send command');
	//			// Send response in callback if required
	//			if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	//		}
	//	}
	//}
}).on('ready', function () {
	if (adapter.config.ip) {
		adapter.log.info('Discover UDP devices');
		var connection = new broadlink();
		connection.on("deviceReady", function (device) {
			if (device.host.address == adapter.config.ip) {
				currentDevice = device;
				adapter.log.info('Device connected: ' + adapter.config.ip + ' (' + device.getType() + ')');
				main();
				return false;
			}
		}).discover();
	} else {
		adapter.log.warn('No IP-Address found. Please set in configuration.');
	}
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
		adapter.log.info('Learned Code (hex): ' + hex);

		leaveLearningMode();

		// Before create new object check one with the same id already exists
		adapter.getObject(namespaceChannelLearned + '.' + hex, function (err, obj) {
			if (err) {
				adapter.log.error(err);
			} else {
				if (!obj) {
					adapter.setObject(namespaceChannelLearned + '.CODE_' + hex, {
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
					adapter.log.info('New IR-Code created in ' + namespaceChannelLearned);
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

	adapter.setObject(namespaceChannelLearned, {
		type: 'channel',
		common: {
			name: ''
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
	adapter.setObject('enableLearningMode', {
		type: 'state',
		common: {
			name: 'Enable learning mode (30s timeout). Result saved in ' + namespaceChannelLearned,
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
