'use strict';
const _blEvnt = 'brl:';
const crypto = require('crypto');
var BLK = {};
BLK.Commands = {
    Hello: [0x6, 0x7],
    Discover: [0x1a, 0x1b],
    Join: [0x14, 0x15],
    Auth: [0x65, 0x3e9],
    TogglePower: [0x6a, 0x3ee]
};
BLK.Hello = {
    Request: (ip, port) => {
        var res = {
            command: BLK.Commands.Hello,
        };

        if (ip && port) {
            var buffer = Buffer.alloc(40);
            var d = new Date();
            var os = d.getTimezoneOffset() / 60 * -1;
            buffer.writeUInt32LE(os, 0);
            buffer.writeUInt16LE(d.getFullYear(), 4);
            buffer.writeUInt8(d.getSeconds(), 6);
            buffer.writeUInt8(d.getMinutes(), 7);
            buffer.writeUInt8(d.getHours(), 8);
            buffer.writeUInt8(d.getDay(), 9);
            buffer.writeUInt8(d.getDate(), 10);
            buffer.writeUInt8(d.getMonth(), 11);
            buffer.writeInt32LE(_parseIp(ip), 16);
            buffer.writeUInt16LE(port, 20);
            res.payload = buffer;
        }
        return res;
    },
    Response: (buffer) => {
        var res = {};
        res.ip = _readIp(buffer, 54);
        res.mac = _readMac(buffer, 58);
        res.type = _readType(buffer, 64);

        return res;
    }
};
BLK.Discover = {
    Request: (target) => {
        var res = {
            command: BLK.Commands.Discover,
            target: target
        };
        return res;
    },
    Response: (buffer) => {
        var res = {};

        res.networks = [];
        var offset = 48;
        var c = buffer.readUInt8(offset);
        offset += 4;
        for (; offset <= c * 64; offset += 64) {
            var l = buffer.readUInt8(offset + 32 + 4);
            var n = {
                ssid: buffer.toString('ascii', offset, offset + l),
                x1: buffer.readUInt8(offset + 32 + 4 + 12),
                encryption: buffer.readUInt8(offset + 32 + 4 + 24)
            };
            res.networks.push(n);
        }

        return res;
    }
};
BLK.Join = {
    Request: (target, ssid, pwd, security) => {
        var res = {
            isPublic: true,
            command: BLK.Commands.Join,
            target: target
        };
        if (ssid && pwd) {
            var buffer = Buffer.alloc(128);
            buffer.writeUInt8(ssid.length, 124);
            buffer.writeUInt8(pwd.length, 125);
            buffer.write(ssid, 60, 'ascii');
            buffer.write(pwd, 92, 'ascii');
            var s = security || ((!pwd || pwd == '') ? 0 : 4); //(0 = none, 1 = WEP, 2 = WPA1, 3 = WPA2, 4 = WPA1/2)
            buffer.writeUInt8(s, 126);
            res.payload = buffer;
        }

        return res;
    },
    Response: () => {
        var res = {};
        //nothing here - just ACK
        return res;
    }
};
BLK.Auth = {
    Request: (target) => {
        var res = {
            command: BLK.Commands.Auth,
            target: target,
            isEncrypted: true
        };
        if (!target) return res;
        var buffer = Buffer.alloc(80);
        var key = crypto.randomBytes(16); //target.key || BLK.key;
        key.copy(buffer, 4); //  0x4     : Shared key (16 bytes)

        //buffer.writeUInt8(0x1,30); //                 0x1e    : 0x1
        buffer.writeUInt8(0x1, 45); //                   0x2d    : 0x1
        buffer.write('Khone alone', 48, 'ascii'); //     0x30    : Device name
        res.payload = buffer;

        return res;
    },
    Response: (buffer, target) => {
        var res = {};
        var data = _decryptPayload(buffer, BLK.key);
        var key = Buffer.alloc(16);
        data.copy(key, 0, 4, 20); //                               0x4     : key in payload
        var id = data.readInt32LE(0); //                        0x0     : device id in payload
        res.key = key;
        res.id = id;
        res.target = target; //TODO do not need to return res, return target itself
        console.log('INFO | %s (#%s) key is %s', target.kind, res.id, res.key.toString('hex'));
        return res;
    }
};
BLK.TogglePower = {
    Request: (target, state) => {
        var res = {
            command: BLK.Commands.TogglePower,
            target: target,
            isEncrypted: true
        };
        if (target && target.id && target.key) {
            var buffer = Buffer.alloc(16);
            buffer.writeUInt8((state !== null) ? 2 : 1, 0); //          0x0 : toggle->value=2, check->value=1
            buffer.writeUInt8(state ? 1 : 0, 4); //                     0x4 : 1: on, 2: off
            res.payload = buffer;
        }
        return res;
    },
    Response: (buffer, target) => {
        var res = {
            target: target
        };
        var err = buffer.readUInt16LE(34); //           0x22 : Error
        if (err === 0) {
            var data = _decryptPayload(buffer, target.key);
            res.state = data.readUInt8(4) ? 'ON' : 'OFF'; // 0x4 : State
            if (data.length > 16) {
                //this is info message
                //TODO: parse and learn
                console.log('==>', data.toString('hex'));
            }
        } else {
            console.log('ERR | Error %s getting device %s power state', err, target.id);
        }
        return res;
    }
};
BLK.getPacket = (message, deviceId = 0x7D00, currentCID = [0xa5, 0xaa, 0x55, 0x5a, 0xa5, 0xaa, 0x55, 0x0]) => {
    var packet,cid,cs;
    if (!message.payload) message.payload = Buffer.alloc(0);
    var isBroadcast = !message.target || !message.target.ip || message.target.ip == '255.255.255.255' || message.target.ip == '224.0.0.251';
    //QUIC header
    if (isBroadcast || message.isPublic) {
        packet = Buffer.alloc(8); //0x8 padding, Public flag = 0x0
        //multicast - PKN:0
        //merge payload right away
        if (message.payload.length < 40) { // minimum payload length
            var filler = Buffer.alloc(40 - message.payload.length);
            message.payload = Buffer.concat([message.payload, filler]);
        }
        packet = Buffer.concat([packet, message.payload]);
    } else {
        packet = Buffer.alloc(56); //0x38 total custom header length
        packet.writeUInt8(0x5a, 0); //Version:0, Reset:Yes, CID:0x2,Packet #1, Multipath:Yes
        cid = Buffer.from(message.target.CID || currentCID);
        cid.copy(packet, 1);
        //tag:0x0, tag #:0x0, padding: 0
    }
    packet.writeUInt16LE(deviceId, 36); //                               0x24  : Device ID
    packet.writeUInt8(message.command[0], 38); //                        0x26  : Command

    if (!isBroadcast && !message.isPublic) {
        BLK.mgs = BLK.mgs || 0;
        packet.writeUInt16LE(BLK.mgs++ & 0xFFFF, 40); //      0x28  : Send Counter

        if (message.target.mac) {
            var m = message.target.mac.split(':').reverse();
            var offset = 42; //                                         0x2a  : MAC
            for (var i = 0; i < m.length; i++) {
                packet.writeUInt8(parseInt(m[i], 16), offset++);
            }
        }
        if (message.target.id) {
            packet.writeUInt32LE(48); //        0x30  : Device ID
        }
        if (message.payload.length > 0) {
            cs = _cs(message.payload);
            packet.writeUInt16LE(cs, 52); //                               0x34  : Header Checksum
        }
        if (message.isEncrypted) {

            BLK.key = Buffer.from([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23, 0x76, 0x5c, 0x15, 0x13, 0xac, 0xcf, 0x8b, 0x02]);
            BLK.iv = Buffer.from([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]);
            var key = message.target.key || BLK.key;
            var cipher = crypto.createCipheriv('aes-128-cbc', key, BLK.iv);
            cipher.setAutoPadding(false);
            message.payload = Buffer.concat([cipher.update(message.payload), cipher.final()]);
        }

        packet = Buffer.concat([packet, message.payload]);
    }
    cs = _cs(packet);
    packet.writeUInt16LE(cs, 32); //                                        0x20   : Full checksum
    return packet;
};
var _decryptPayload = (buffer, key) => {
    var data = Buffer.alloc(buffer.length - 56); //         0x38    : Encrypted payload
    buffer.copy(data, 0, 56, buffer.length);

    var decipher = crypto.createDecipheriv('aes-128-cbc', key, BLK.iv);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(data), decipher.final()]);
};
var _parseIp = (ip) => {
    var o = ip.split('.');
    var res = 0;
    for (var i = 0; i < o.length; ++i) {
        var p = parseInt(o[i]);
        res |= p << ((o.length - i) * 8);
    }
    return res;
};
var _readIp = (buffer, start) => {
    var ip = buffer.readInt32LE(start);
    var p = [];
    for (var s = 0; s <= 24; s += 8) {
        p.push(((ip >> s) & 0xFF).toString());
    }
    return p.join('.');
};
var _readMac = (buffer, start) => {
    var mac = [];
    for (var i = start; i < start + 6; i++) {
        mac.push(buffer.readUInt8(i).toString(16));
    }
    return mac.reverse().join(':');
};
var _cs = (buffer) => (0xbeaf + Array.prototype.slice.call(buffer, 0).reduce((p, c) => (p + c))) & 0xffff;
var _readType = (buffer, start) => { //TODO: Maybe i will call it translate? :)
    var type = buffer.toString('utf8', start, buffer.length);
    if (type.match('智能插座').length > 0) return 'SMART SOCKET';
    else return 'UNDEFINED';
};
// eslint-disable-next-line complexity
var _readDeviceType = (buffer) => {
    var type = buffer.readUInt16LE(36);
    switch (type) {
        case 0:
            return 'SP1';
        case 0x2711:
            return 'SP2';
        case 0x2719:
        case 0x7919:
        case 0x271a:
        case 0x791a:
            return 'Honeywell SP2';
        case 0x2720:
            return 'SPMini';
        case 0x753e:
            return 'SP3';
        case 0x2728:
            return 'SPMini2';
        case 0x2733:
        case 0x273e:
            return 'SPMini OEM';
        case 0x2736:
            return 'SPMiniPlus';
        case 0x2712:
            return 'RM2';
        case 0x2737:
            return 'RM Mini';
        case 0x273d:
            return 'RM Pro Phicomm';
        case 0x2783:
            return 'RM2 Home Plus';
        case 0x277c:
            return 'RM2 Home Plus GDT';
        case 0x272a:
            return 'RM2 Pro Plus';
        case 0x2787:
            return 'RM2 Pro Plus2';
        case 0x278b:
            return 'RM2 Pro Plus BL';
        case 0x278f:
            return 'RM Mini Shate';
        case 0x2714:
            return 'A1';
        case 0x4EB5:
            return 'MP1';
        default:
            if (type >= 0x7530 & type <= 0x7918) return 'SPMini2 OEM';
            else return 'Unknown';
    }
};
BLK.getName = function (value) {
    return Object.keys(BLK.Commands).find(key => Array.isArray(value) ? BLK.Commands[key] === value : BLK.Commands[key].includes(value));
};
BLK.get = function (value) {
    var m = BLK.getName(value);
    if (!m) return null;
    return this[m];
};
BLK.getTrigger = function (msg) {
    var m = BLK.get(msg.command);
    if (m) {
        var n = BLK.getName(msg.command);
        return _blEvnt + n;
    }
    return null;
};
BLK.parse = function (buffer, targets) {
    if (buffer.length < 48) {
        console.log('ERR | Response message is too short (%d bytes)', buffer.length);
        return null;
    }
    var cs = buffer.readUInt16LE(32);
    buffer.writeUInt16LE(0x0, 32);
    if (_cs(buffer) != cs) {
        console.log('ERR | Wrong incoming message format : ', JSON.stringify(buffer));
        return null;
    }
    //header
    /*if(buffer.readUInt8(0) & 2){ //this is public reset
        //hack to workout JS bug!
        var cid = [];
        for(var i=1;i<=8;i++) {
            cid.push(buffer[i]);
        }

        //attach it to device
    }*/
    var command = buffer.readUInt16LE(38);
    var device = _readDeviceType(buffer);
    var srs = _readMac(buffer, 42);
    var msg = BLK.get(command);
    if (!msg) {
        console.log('TODO | Unknown incoming message 0x%s', command.toString(16));
        return null;
    }
    var evt = BLK.getTrigger(msg.Request());
    var target = targets.find(t => t.id === evt);
    var res = msg.Response(buffer, target ? target.target : null);
    res.event = evt;
    res.name = BLK.getName(command);
    res.srs = srs;
    res.kind = device;
    return res;
};
module.exports = BLK;