"use strict";
var utils = require(__dirname + '/lib/utils'),
	adapter = utils.adapter('broadlink'),
	broadlink = require(__dirname + '/lib/broadlink'),
	//zlib = require('zlib'),
	namespaceChannelLearned = 'learnedSignals',
	currentDevice,
    inObjectChange;

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
     if (!id || !obj) return;
     if (obj.type === 'channel' || obj.type === 'device' && !inObjectChange) {
         inObjectChange = true;
         createLerningModeState (id, function () {
             if (inObjectChange) inObjectChange--;
         });
     }
}).on('stateChange', function (id, state) {
    if (!state || state.ack || id.indexOf (adapter.namespace) !== 0 || !currentDevice) return;
    
    var ar = id.split ('.');
    var command = ar[ar.length - 1];
    
    switch (command) {
        case 'enableLearningMode':
        case 'createCode':
            if (!state.val) break;
            
            var aktChannel = '', name = '';
            if (typeof state.val === 'string') {
                var nar = state.val.split ('.');
                name = nar.pop ();
                aktChannel = nar.join ('.');
                aktChannel = aktChannel [0] === '.' ? aktChannel.substr (1) : namespaceChannelLearned + '.' + aktChannel;
            } else {
                for (var i = 2; i < ar.length - 1; i++) {
                    aktChannel = aktChannel ? aktChannel + '.' + ar[i] : ar[i];
                }
            }
            enterLeaningMode (aktChannel, name);
            break;
        case 'sendCode':
            var code = state.val.replace(/^CODE_|^/, 'CODE_');
            if (isSignalCode (code)) sendCode (code);
            break;
        default:
            adapter.log.debug ('Preparing to send: ' + command);
            
            if (isSignalCode (command)) {
                sendCode (command);
            } else {
                // If the object is not a signal code, check the name of the object
                adapter.getObject (id, function (err, obj) {
                    if (err) {
                        adapter.log.error (err);
                    } else if (obj.common.name) {
                        if (isSignalCode (obj.common.name)) {
                            sendCode (obj.common.name)
                        }
                    }
                });
            }
    }
    
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
		var connection = new broadlink(adapter.config.ip);
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

function enterLeaningMode(aktChannel, name) {
	adapter.log.info('Enter learning mode - Wait 30 seconds for data before leaving...');
	var timer = setInterval(function () {
		adapter.log.debug("IR-Learning-Mode - check data...");
		currentDevice.checkData();
	}, 1000);

	var leaveLearningMode = (function () {
		clearInterval(timer);
		adapter.setState((aktChannel ? aktChannel + '.' : '') + 'enableLearningMode', {val: false, ack: true});
		adapter.log.info('Leaved learning mode');
	});

	currentDevice.enterLearning();
	currentDevice.on("rawData", function (data) {
		var hex = data.toString('hex');
		adapter.log.info('Learned Code (hex): ' + hex);

		leaveLearningMode();

		var id = aktChannel ? aktChannel : namespaceChannelLearned;
		id += '.CODE_' + hex;
		// Before create new object check one with the same id already exists
		adapter.getObject(id, function (err, obj) {
			if (err) {
				adapter.log.error(err);
			} else {
				if (!obj) {
					adapter.setObject(id, {
						type: 'state',
						common: {
							name: name ? name : '>>> Learned, please describe',
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

function createLerningModeState (path, cb) {
    var id = (path ? path + '.' : '') + 'enableLearningMode';
    adapter.setObject(id, {
        type: 'state',
        common: {
            name: 'Enable learning mode (30s timeout). Result saved in ' + namespaceChannelLearned,
            type: 'boolean',
            role: '',
            read: false,
            write: true
        },
        native: {}
    }, function (err, obj) {
        adapter.setState(id, {val: false, ack: true}, cb);
    });
    
}

function main() {
	//adapter.log.info('Config IP-Address: ' + adapter.config.ip);

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
    }, function(err, obj) {
        if (err || !obj) return;
        adapter.setState(obj.id, {val: '', ack: true});
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
    }, function(err, obj) {
        if (err || !obj) return;
        adapter.setState(obj.id, {val: '', ack: true});
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
    
	adapter.subscribeStates('*');
    adapter.subscribeObjects('*');
	adapter.setState('enableLearningMode', {val: false, ack: true});
}
