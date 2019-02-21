"use strict";
/**
 * UDP Connector for Broadlink devices
 * Modified version for ioBroker compatibility. Based on https://github.com/momodalo/broadlinkjs/blob/master/index.js
 *
 * @licence MIT
 */
// jshint node:true, esversion:6, strict:true, undef:true, unused:true, bitwise: false
//var util = require('util');
const EventEmitter = require('events'),
    dgram = require('dgram'),
    dns = require('dns'),
    os = require('os'),
    crypto = require('crypto'),
    A = require('./myAdapter').MyAdapter;

/*
const crctab16 = new Uint16Array([
    0X0000, 0X1189, 0X2312, 0X329B, 0X4624, 0X57AD, 0X6536, 0X74BF,
    0X8C48, 0X9DC1, 0XAF5A, 0XBED3, 0XCA6C, 0XDBE5, 0XE97E, 0XF8F7,
    0X1081, 0X0108, 0X3393, 0X221A, 0X56A5, 0X472C, 0X75B7, 0X643E,
    0X9CC9, 0X8D40, 0XBFDB, 0XAE52, 0XDAED, 0XCB64, 0XF9FF, 0XE876,
    0X2102, 0X308B, 0X0210, 0X1399, 0X6726, 0X76AF, 0X4434, 0X55BD,
    0XAD4A, 0XBCC3, 0X8E58, 0X9FD1, 0XEB6E, 0XFAE7, 0XC87C, 0XD9F5,
    0X3183, 0X200A, 0X1291, 0X0318, 0X77A7, 0X662E, 0X54B5, 0X453C,
    0XBDCB, 0XAC42, 0X9ED9, 0X8F50, 0XFBEF, 0XEA66, 0XD8FD, 0XC974,
    0X4204, 0X538D, 0X6116, 0X709F, 0X0420, 0X15A9, 0X2732, 0X36BB,
    0XCE4C, 0XDFC5, 0XED5E, 0XFCD7, 0X8868, 0X99E1, 0XAB7A, 0XBAF3,
    0X5285, 0X430C, 0X7197, 0X601E, 0X14A1, 0X0528, 0X37B3, 0X263A,
    0XDECD, 0XCF44, 0XFDDF, 0XEC56, 0X98E9, 0X8960, 0XBBFB, 0XAA72,
    0X6306, 0X728F, 0X4014, 0X519D, 0X2522, 0X34AB, 0X0630, 0X17B9,
    0XEF4E, 0XFEC7, 0XCC5C, 0XDDD5, 0XA96A, 0XB8E3, 0X8A78, 0X9BF1,
    0X7387, 0X620E, 0X5095, 0X411C, 0X35A3, 0X242A, 0X16B1, 0X0738,
    0XFFCF, 0XEE46, 0XDCDD, 0XCD54, 0XB9EB, 0XA862, 0X9AF9, 0X8B70,
    0X8408, 0X9581, 0XA71A, 0XB693, 0XC22C, 0XD3A5, 0XE13E, 0XF0B7,
    0X0840, 0X19C9, 0X2B52, 0X3ADB, 0X4E64, 0X5FED, 0X6D76, 0X7CFF,
    0X9489, 0X8500, 0XB79B, 0XA612, 0XD2AD, 0XC324, 0XF1BF, 0XE036,
    0X18C1, 0X0948, 0X3BD3, 0X2A5A, 0X5EE5, 0X4F6C, 0X7DF7, 0X6C7E,
    0XA50A, 0XB483, 0X8618, 0X9791, 0XE32E, 0XF2A7, 0XC03C, 0XD1B5,
    0X2942, 0X38CB, 0X0A50, 0X1BD9, 0X6F66, 0X7EEF, 0X4C74, 0X5DFD,
    0XB58B, 0XA402, 0X9699, 0X8710, 0XF3AF, 0XE226, 0XD0BD, 0XC134,
    0X39C3, 0X284A, 0X1AD1, 0X0B58, 0X7FE7, 0X6E6E, 0X5CF5, 0X4D7C,
    0XC60C, 0XD785, 0XE51E, 0XF497, 0X8028, 0X91A1, 0XA33A, 0XB2B3,
    0X4A44, 0X5BCD, 0X6956, 0X78DF, 0X0C60, 0X1DE9, 0X2F72, 0X3EFB,
    0XD68D, 0XC704, 0XF59F, 0XE416, 0X90A9, 0X8120, 0XB3BB, 0XA232,
    0X5AC5, 0X4B4C, 0X79D7, 0X685E, 0X1CE1, 0X0D68, 0X3FF3, 0X2E7A,
    0XE70E, 0XF687, 0XC41C, 0XD595, 0XA12A, 0XB0A3, 0X8238, 0X93B1,
    0X6B46, 0X7ACF, 0X4854, 0X59DD, 0X2D62, 0X3CEB, 0X0E70, 0X1FF9,
    0XF78F, 0XE606, 0XD49D, 0XC514, 0XB1AB, 0XA022, 0X92B9, 0X8330,
    0X7BC7, 0X6A4E, 0X58D5, 0X495C, 0X3DE3, 0X2C6A, 0X1EF1, 0X0F78,
]);

// calculate the 16-bit CRC of data with predetermined length.
function crc16(data) {
    var res = 0x0ffff;

    for (let b of data) {
        res = ((res >> 8) & 0x0ff) ^ crctab16[(res ^ b) & 0xff];
    }

    return (~res) & 0x0ffff;
}

*/

class Device extends EventEmitter {
    constructor(host, mac, devtype, bl) {
        super();
        var self = this;
        this.dummy = undefined;
        this._val = {};
        this.bl = bl;
        this.host = host;
        this.type = "Unknown";
        this.host.name = "unknown_" + mac;
        delete this.host.family;
        delete this.host.size;
        host.mac = mac;
        this.devtype = devtype;
        this.host.devhex = Broadlink.toHex(devtype, 4);

        this.count = Math.random() & 0xffff;
        this.key = new Buffer([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23, 0x76, 0x5c, 0x15, 0x13, 0xac, 0xcf, 0x8b, 0x02]);
        this.iv = new Buffer([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]);
        this.id = new Buffer([0, 0, 0, 0]);
        this.cs = dgram.createSocket({
            type: 'udp4',
            reuseAddr: true
        });
        this.cs.on('close', function () {
            A.I('closed ' + A.O(self.host));
            self.emit('close');
            this.cs = null;
        });
        try {
            this.cs.bind({
                exclusive: true
            });
            this.bound = true;
        } catch (e) {
            A.W(`could not bind socket for ${A.O(this.host)}`);
        }
    }

    close() {
        if (this.tout) {
            //            clearTimeout(self.tout);
            this.tout = null;
        }
        if (this.bound) {
            this.cs.close();
            this.cs.removeAllListeners();
        }
        if (this.bl && this.bl._devices)
            this.bl._devices[this.host.mac] = null;

        this.type = 'closed';
        this.emit('close');
    }


    get val() {
        return this._val;
    }

    getAll() {
        if (A.T(this._val) === 'object')
            this._val.here = false;
        return this.getVal().then(v => {
            return A.T(v) === 'object' ? v : {
                val: v,
                here: true
            };
        });
    }

    getVal() {
        return A.resolve(this._val);
    }

    setVal(obj) {
        return A.resolve(this._val = obj);
    }

    _send(packet) {
        const timeout = 1000;
        const self = this;
        if (!this.cs || this.tout) return Promise.reject('socket not created/bound or closed or waiting!');
        this.cs.removeAllListeners('message');
        return new Promise((res, rej) => {

            function reject(what) {
                if (self.tout) {
                    clearTimeout(self.tout);
                    self.tout = null;
                }
                A.N(rej, what);
            }

            function resume(what) {
                if (self.tout) {
                    clearTimeout(self.tout);
                    self.tout = null;
                }
                A.N(res, what);
            }

            self.cs.send(packet, 0, packet.length, self.host.port, self.host.address, err => {
                if (err)
                    return reject(err);
                else {
                    self.tout = setTimeout(() => reject(`timed out on ${A.O(self.host)}`), timeout);
                    self.cs.on('message', response => {
                        var enc_payload = Buffer.alloc(response.length - 0x38, 0);
                        response.copy(enc_payload, 0, 0x38);

                        var decipher = crypto.createDecipheriv('aes-128-cbc', self.key, self.iv);
                        decipher.setAutoPadding(false);
                        var payload = decipher.update(enc_payload);
                        var p2 = decipher.final();
                        if (p2) {
                            payload = Buffer.concat([payload, p2]);
                        }

                        var command = response[0x26];
                        var err = response[0x22] | (response[0x23] << 8);

                        //            console.log(command.toString(16),': err:',err, ' =',payload);

                        let obj = {
                            command: command,
                            cmdHex: Broadlink.toHex(command),
                            payload: payload,
                        };
                        if (err === 0)
                            return resume(obj);
                        obj.err = err;
                        return reject(A.W(`Got error ${A.O(obj)} from device ${A.O(self.host.name)} with payload ${payload}`, obj));
                    });

                }
            });

        });

    }

    auth() {
        const self = this;
        let payload = Buffer.alloc(0x50, 0);
        payload[0x04] = 0x31;
        payload[0x05] = 0x31;
        payload[0x06] = 0x31;
        payload[0x07] = 0x31;
        payload[0x08] = 0x31;
        payload[0x09] = 0x31;
        payload[0x0a] = 0x31;
        payload[0x0b] = 0x31;
        payload[0x0c] = 0x31;
        payload[0x0d] = 0x31;
        payload[0x0e] = 0x31;
        payload[0x0f] = 0x31;
        payload[0x10] = 0x31;
        payload[0x11] = 0x31;
        payload[0x12] = 0x31;
        payload[0x1e] = 0x01;
        payload[0x2d] = 0x01;
        payload[0x30] = 'T'.charCodeAt(0);
        payload[0x31] = 'e'.charCodeAt(0);
        payload[0x32] = 's'.charCodeAt(0);
        payload[0x33] = 't'.charCodeAt(0);
        payload[0x34] = ' '.charCodeAt(0);
        payload[0x35] = ' '.charCodeAt(0);
        payload[0x36] = '1'.charCodeAt(0);

        return this.sendPacket(0x65, payload).then(what => {
            const command = what.command;
            const payload = what.payload;
            if (command === 0xe9) {
                self.key = Buffer.alloc(0x10, 0);
                payload.copy(self.key, 0, 0x04, 0x14);

                self.id = Buffer.alloc(0x04, 0);
                payload.copy(self.id, 0, 0x00, 0x04);
                //                            A.I(`I emit deviceReady for ${A.O(self.host)}`);
                A.N(self.emit.bind(self),"deviceReady",self);
//                self.emit("deviceReady", self);
            } else
                return A.reject(A.W('auth did not get 0xe9 package back: ' + A.O(what)));
            return A.resolve(self);
        }).catch(e => A.W('catch auth error!: ' + A.O(e)));
    }

    sendPacket(command, payload) {
        this.count = (this.count + 1) & 0xffff;
        var packet = Buffer.alloc(0x38, 0);
        packet[0x00] = 0x5a;
        packet[0x01] = 0xa5;
        packet[0x02] = 0xaa;
        packet[0x03] = 0x55;
        packet[0x04] = 0x5a;
        packet[0x05] = 0xa5;
        packet[0x06] = 0xaa;
        packet[0x07] = 0x55;
        packet[0x24] = 0x2a;
        packet[0x25] = 0x27;
        packet[0x26] = command;
        packet[0x28] = this.count & 0xff;
        packet[0x29] = this.count >> 8;
        packet[0x2a] = this.host.mac[0];
        packet[0x2b] = this.host.mac[1];
        packet[0x2c] = this.host.mac[2];
        packet[0x2d] = this.host.mac[3];
        packet[0x2e] = this.host.mac[4];
        packet[0x2f] = this.host.mac[5];
        packet[0x30] = this.id[0];
        packet[0x31] = this.id[1];
        packet[0x32] = this.id[2];
        packet[0x33] = this.id[3];

        var checksum = 0xbeaf,
            i;
        for (i = 0; i < payload.length; i++) {
            checksum += payload[i];
            checksum = checksum & 0xffff;
        }

        var cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
        payload = cipher.update(payload);
        //	var p2 = cipher.final();

        packet[0x34] = checksum & 0xff;
        packet[0x35] = checksum >> 8;

        packet = Buffer.concat([packet, payload]);

        checksum = 0xbeaf;
        for (i = 0; i < packet.length; i++) {
            checksum += packet[i];
            checksum = checksum & 0xffff;
        }
        packet[0x20] = checksum & 0xff;
        packet[0x21] = checksum >> 8;

        return A.retry(3, this._send.bind(this), packet);
    }

}


class MP1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "MP";
    }
    getVal() {
        //"""Returns the power state of the smart plug."""
        const ret = this._val;
        if (A.T(ret) === 'object')
            ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0x00] = 0x0a;
        packet[0x02] = 0xa5;
        packet[0x03] = 0xa5;
        packet[0x04] = 0x5a;
        packet[0x05] = 0x5a;
        packet[0x06] = 0xae;
        packet[0x07] = 0xc0;
        packet[0x08] = 0x01;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let state = res.payload[0x0e];
                ret.here = true;
                ret.sw1 = Boolean(state & 1);
                ret.sw2 = Boolean(state & 2);
                ret.sw3 = Boolean(state & 4);
                ret.sw4 = Boolean(state & 8);
                //                ret.nightlight = !!(payload[0x4] & 2);
                return ret;
            } else return A.reject(ret);
        }, e => {
            A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
            return ret;
        }); //.catch(e => A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(self._val)}`, e));
    }

    setVal(state, sw) {
        //"""Sets the power state of the smart plug."""
        const vret = this._val;
        let st = state;
        if (!sw || isNaN(Number(sw)) || sw < 1 || sw > 4)
            return A.resolve(A.W(`call of setVal on ${this.host.name} with wrong argument 2: ${sw}`));
        //        let nl = false;
        A.I(`setVal on '${this.constructor.name}' to ${A.O(state)}`);
        //        if (A.T(state) === 'object' && state.nightlight !== undefined)
        //            nl = !!state.nightlight;
        if (A.T(state) === 'object' && state.val !== undefined)
            st = !!state.val;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.constructor.name}' to ${A.O(state)}: error wrong argument type!`);
        let sid_mask = 1 << (sw - 1);
        let packet = Buffer.alloc(16, 0);
        packet[0x00] = 0x0d;
        packet[0x02] = 0xa5;
        packet[0x03] = 0xa5;
        packet[0x04] = 0x5a;
        packet[0x05] = 0x5a;
        packet[0x06] = 0xb2 + (st ? (sid_mask << 1) : sid_mask);
        packet[0x07] = 0xc0;
        packet[0x08] = 0x02;
        packet[0x0a] = 0x03;
        packet[0x0d] = sid_mask;
        packet[0x0e] = st ? sid_mask : 0;
        return this.sendPacket(0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(vret['sw' + sw] = st) : A.reject(vret));
    }
}

class SP1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "SP1";
        this._val = undefined;
    }
    setVal(state) {
        let st = state;
        if (typeof state === 'number' || typeof state === 'boolean')
            state = {
                val: !!state
            };
        if (typeof state === 'object')
            st = !!state.val;
        var packet = Buffer.alloc(4, 4);
        packet[0] = st ? 1 : 0;
        return this.sendPacket(0x66, packet).then(ret => ret.err || !!ret.payload ? A.reject(this._val) : (this._val = st));
    }

}

class SP2 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "SP2";
    }
    getVal() {
        //"""Returns the power state of the smart plug."""
        const ret = this._val;
        if (A.T(ret) === 'object')
            ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 1;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.here = true;
                ret.val = !!(payload[0x4] & 1);
                //                ret.nightlight = !!(payload[0x4] & 2);
                return A.resolve(ret);
            } else return A.reject(ret);
        }, e => {
            A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
            return ret;
        }); //.catch(e => A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(self._val)}`, e));
    }

    setVal(state) {
        //"""Sets the power state of the smart plug."""
        const self = this;
        let st = state;
        //        let nl = false;
        A.I(`setVal on '${this.constructor.name}' to ${A.O(state)}`);
        //        if (A.T(state) === 'object' && state.nightlight !== undefined)
        //            nl = !!state.nightlight;
        if (A.T(state) === 'object' && state.val !== undefined)
            st = !!state.val;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.constructor.name}' to ${A.O(state)}: error wrong argument type!`);
        let packet = Buffer.alloc(16, 0);
        packet[0] = 2;
        //        packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
        packet[4] = st ? 1 : 0;
        return this.sendPacket(0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(self._val.val = st) : A.reject(self._val));
    }
}

class SP3P extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = 'SP3P';
        this._val = {};
    }

    setVal(state) {
        //"""Sets the power state of the smart plug."""
        const self = this;
        let st = state;
        let nl = false;
        A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
        if (A.T(state) === 'object' && state.nightlight !== undefined)
            nl = !!state.nightlight;
        if (A.T(state) === 'object' && state.val !== undefined)
            st = !!state.val;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.constructor.name}' to ${A.O(state)}: error wrong argument type!`);
        let packet = Buffer.alloc(16, 0);
        packet[0] = 2;
        packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
        return this.sendPacket(0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(self._val.val = st) : A.reject(self._val));
    }

    getVal() {
        //"""Returns the power state of the smart plug."""
        const ret = this._val;
        if (A.T(ret) === 'object')
            ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 1;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.here = true;
                ret.val = !!(payload[0x4] & 1);
                ret.nightlight = !!(payload[0x4] & 2);
                return ret;
            } else return A.reject(ret);
        }, e => {
            A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
            return ret;
        }); //.catch(e => A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(self._val)}`, e));
    }
    getAll() {
        const self = this;
        const ret = this._val;
        //        A.I(`getAll on SP3P called! val = ${A.O(ret)}`);
        return this.getVal().then(val => self.getEnergy(Object.assign(ret, val)))
            .then(energy => {
                if (energy !== undefined)
                    ret.energy = energy;
                self._val = ret;
                return ret;
            }, e => {
                A.I(`getAll on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
                return ret;
            }); //.catch(e => A.I(`getAll on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(self._val)}`,e));
    }

    getEnergy() {
        //"""Returns the power state of the smart plug."""
        //        A.I(`calling get_energy on ${A.O(this.host)}`);
        const packet = Buffer.alloc(16, 0);
        packet[0] = 8;
        packet[2] = 254;
        packet[3] = 1;
        packet[4] = 5;
        packet[5] = 1;
        packet[9] = 45;
        return this.sendPacket(0x6a, packet).then(ret => {
            //            A.I(`payload get energy: ${A.O(ret)}`);
            if (ret && ret.payload && ret.payload[0] === 8)
                return A.resolve(parseFloat(ret.payload[7].toString(16) + ret.payload[6].toString(16) + ret.payload[5].toString(16)) / 100.0);
            return A.reject();
        }); // .catch(err => A.resolve(A.W(`got err in get energy: ${A.O(err)}`, undefined)));
    }
}
/*

class T1S {
    constructor(ip, port) {
        this._ip = ip;
        this._port = port;
        this._c = null;
    }

    auth(id) {
        const self = this;
        let eid = (id + 1) * 65535 + 65535;
        let buf = Buffer.alloc(4, 0);
        buf[3] = eid % 256;
        eid = eid >> 8;
        buf[2] = eid % 256;
        eid = eid >> 8;
        buf[1] = eid % 256;
        eid = eid >> 8;
        buf[0] = eid % 256;
        if (!this._c) {
            return new Promise((res, rej) => {
                var to = setTimeout(() => rej('timeout'), 2000);
                this._c = new net.Socket();
                this._c.connect(this._port, this._ip, function () {
                    console.log('Connected');
                    clearTimeout(to);
                    return A.N(res, 'connected');
                });

                this._c.on('error', function (err) {
                    console.error('Connection error: ' + err);
                    console.error(new Error().stack);
                    self.close();
                });

                this._c.on('data', function (data) {
                    console.log('Received: ' + data);
                });

                this._c.on('close', function () {
                    console.log('Connection closed');
                    self.close();
                });
            }).then(() => self.write(buf));
        } else A.resolve();
    }
    write(buf) {
        if (this._c) {
            A.I('T1S write:' + A.F(buf));
            return A.c2p(this._c.write.bind(this._c))(buf);
        }
    }

    close() {
        if (this._c) {
            this._c.removeAllListeners();
            this._c.destroy();
            this._c = null;
        }
    }
}
//    let t1s = new T1S('59.110.30.249', 25565);


class T1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "T1";
    }
    // --- start of other test
        sendT1packet(data) {
            //        if (!data)
            //            data = Buffer.alloc(4, 0);
            //        else 
            if (Array.isArray(data))
                data = Buffer.from(data);
            const payload = Buffer.alloc(data.length + 2, 0);
            data.copy(payload, 0, 0);
            let cc = crc16(data);
            payload[data.length] = cc & 0xff;
            payload[data.length + 1] = (cc >> 8) & 0xff;
            A.I(`Send to T1 ${A.O(payload)}`)
            return this.sendPacket(0x6a, payload).then(res => {
                if (res && res.payload && !res.err) {
                    let pl = res.payload;
                    let size = pl[0];
                    A.I(`Got payload with size ${size}: ${pl}`);
                    return pl;
                }
                return A.reject(res);
            });
        }
    // --- end of other test
    sendT1packet(command, data) {
        if (!data)
            data = Buffer.alloc(4, 0);
        else if (Array.isArray(data))
            data = Buffer.from(data);
        const payload = Buffer.alloc(8, 0);
        payload[0] = command;
        payload[1] = payload[2] = 1;
        data.copy(payload, 3, 0);
        let cc = 0;
        for (let i = 0; i < 7; i++)
            cc += payload[i];

        cc = (cc & 0xff) ^ 0xa5;
        payload[7] = cc;
        A.I(`sent payload to T1:` + A.F(payload));
        return this.sendPacket(0x6a, payload).then(res => {
            if (res && res.payload && !res.err) {
                let pl = res.payload;
                let size = pl[0];
                A.I(`Got payload with size ${size}: ${pl}`);
                return pl;
            }
            return A.reject(res);
        });
    }

    getAll() {
        const ret = this._val;
        ret.here = false;
        //        return this.sendT1packet(0xA0).then(x => {
        const buf = Buffer.alloc(4, 0);
        buf[0] = buf[1] = buf[2] = 1;
        return this.sendT1packet(0xA0,buf).then(x => {
            ret.payload = x;
            ret.here = true;
        });
    }
}
*/
class A1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "A1";
        this._val = {};
    }
    getVal() {
        //        const self = this;
        const ret = this._val;
        ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 1;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.temperature = (payload[0x4] * 10 + payload[0x5]) / 10.0;
                ret.humidity = (payload[0x6] * 10 + payload[0x7]) / 10.0;
                ret.light = payload[0x8]; // "0:finster;1:dunkel;2:normal;3:hell"
                ret.air_quality = payload[0x0a]; // "0:sehr gut;1:gut;2:normal;3:schlecht"
                ret.noise = payload[0xc]; // "0:ruhig;1:normal;2:laut;3:sehr laut"
                ret.here = true;
                return ret;
            }
            return A.reject(res);
        });
    }
}

class RM extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "RM";
    }
    getVal() {
        //"""Returns the power state of the smart plug."""
        //        const self = this;
        const ret = this._val;
        if (A.T(ret) === 'object')
            ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 1;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.here = true;
                ret.temperature = (payload[0x4] * 10 + payload[0x5]) / 10.0;
                return A.resolve(ret);
            } else return A.reject(ret);
        }); //.catch(e => A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`, e));
    }

    checkData() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 4;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let data = Buffer.alloc(res.payload.length - 4, 0);
                res.payload.copy(data, 0, 4);
                return data;
            }
            return A.reject(res);
        });
    }

    setVal(data) {
        var packet = new Buffer([0x02, 0x00, 0x00, 0x00]);
        packet = Buffer.concat([packet, data]);
        return this.sendPacket(0x6a, packet); //.then(x => A.I(`setVal/sendData for ${this.host.name} returned ${A.O(x)}`, x));
    }

    enterLearning() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 3;
        return this.sendPacket(0x6a, packet); //.then(x => A.I(`enterLearning for ${this.host.name} returned ${A.O(x)}`, x));
    }

}

class RMP extends RM {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "RMP";
    }

    enterRFSweep() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 0x19;
        return this.sendPacket(0x6a, packet); //.then(x => A.I(`enterRFSweep for ${this.host.name} returned ${A.O(x)}`, x));
    }

    checkRFData() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 0x1a;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let data = res.payload[4] === 1;
                return data;
            }
            return A.reject(res);
        });
    }

    checkRFData2() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 0x1b;
        return this.sendPacket(0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let data = res.payload[4] === 1;
                return data;
            }
            return A.reject(res);
        });
    }

    cancelRFSweep() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 0x1e;
        return this.sendPacket(0x6a, packet); // .then(x => A.I(`CancelRFSwwep for ${this.host.name} returned ${A.O(x)}`, x));
    }

}


class Broadlink extends EventEmitter {
    constructor() {
        super();
        this._devices = {};
        this._cs = null;
    }

    static toHex(n, len) {
        len = Math.abs(len) || 2;
        let st = '0'.repeat(len);
        st = n < 0 ? '-0x' + st : '0x' + st;
        let s = n.toString(16);
        return st.slice(0, -s.length) + s;
    }


    genDevice(devtype, host, mac) {
        const devlist = [{
            0x0000: 'SP1',
            name: 'sp1',
            class: SP1
        }, {
            class: SP2,
            name: 'sp2',
            range: {
                min: 0x7530,
                max: 0x7918,
                name: "OEM branded SPMini2"
            },
            0x2711: 'SP2',
            0x2719: 'SP2?',
            0x7919: 'SP2?',
            0x271a: 'SP2?',
            0x791a: 'Honeywell SP2',
            0x2720: 'SPMini',
            0x753e: 'SP3',
            0x2728: 'SPMini2',
            0x2733: 'SPmini2?',
            0x273e: 'OEM branded SPMini',
            0x2736: 'SPMiniPlus',
        }, {
            name: 'sp3p',
            class: SP3P,
            isPlus: true,
            0x947A: 'SP3SPower',
        }, {
            name: 't1',
//            class: T1,
            isPlus: true,
//            0x4ead: 'T1 Floureon',
        }, {
            name: 'rm',
            class: RM,
            0x2712: 'RM2',
            0x2737: 'RM Mini',
            0x273d: 'RM Pro Phicomm',
            0x2783: 'RM2 Home Plus',
            0x277c: 'RM2 Home Plus GDT',
            0x278f: 'RM Mini Shate',
            0x2797: 'RM Pro (OEM)',
            0x27C2: 'RM Mini'
        }, {
            name: 'rm',
            class: RMP,
            isPlus: true,
            0x272a: 'RM2 Pro Plus',
            0x2787: 'RM2 Pro Plus2',
            0x278b: 'RM2 Pro Plus BL',
            0x279d: 'RM3 Pro Plus',
            0x27a9: 'RM3 Pro Plus', // addition for new RM3 mini
        }, {
            name: 'a1',
            class: A1,
            0x2714: 'A1'
        }, {
            name: 'mp1',
            class: MP1,
            0x4EB5: 'MP1'
        }];

        host.devtype = devtype;
        host.type = 'unknown';
        host.name = 'unknown_' + host.mac;
        let dev = null;
        for (let typ of devlist)
            if (typ[devtype] || (typ.range && devtype >= typ.range.min && devtype <= typ.range.max)) {
                dev = new typ.class(host, mac, devtype, this);
                //                dev[typ.name](typ.isPlus);
                host.type = typ.name;
                host.devname = typ.range ? typ.range.name : typ[devtype];
                return dev;
            }
        return dev;
    }

    send(packet, ip) {
        if (!this._cs) return Promise.reject('socket not created/bound or closed');
        this._cs.setBroadcast(true);
        return new Promise((res, rej) => this._cs.send(packet, 0, packet.length, 80, ip, (err, obj) => {
            if (err)
                rej(err);
            else res(obj);
        }));

    }


    discover(what, ms) {
        const self = this;
        let interfaces = os.networkInterfaces(),
            addresses = [],
            address;
        ms = ms || 5000;

        for (var k in interfaces) {
            if (interfaces.hasOwnProperty(k)) {
                for (var k2 in interfaces[k]) {
                    if (interfaces[k].hasOwnProperty(k2)) {
                        address = interfaces[k][k2];
                        if (address.family === 'IPv4' && !address.internal) {
                            addresses.push(address.address);
                        }
                    }
                }
            }
        }
        this.address = addresses[0].split('.');

        return new Promise((res, rej) => {

            if (!self._cs)
                self._cs = dgram.createSocket({
                    type: 'udp4',
                    reuseAddr: true
                }, (m, r) => A.N((msg, rinfo) => {
                    var host = rinfo;
                    var mac = Buffer.alloc(6, 0);


                    //mac = msg[0x3a:0x40];
                    msg.copy(mac, 0, 0x34, 0x40);
                    var devtype = msg[0x34] | msg[0x35] << 8;
                    if (!self._devices) {
                        self._devices = {};
                    }
                    mac = Array.prototype.map.call(new Uint8Array(mac), x => x.toString(16)).join(':');
                    //            console.log(mac);
                    if (!self._devices[mac] || self._devices[mac].dummy) {
                        var dev = self.genDevice(devtype, host, mac);
                        self._devices[mac] = dev;
                        dev.once("deviceReady", function () {
                            return A.c2p(dns.reverse)(dev.host.address)
                                .then(x => A.T(x, []) ? x[0].toString().trim() : x.toString().trim(), () => dev.host.name)
                                .then(x => dev.host.name = dev.host.type.slice(0, 2).toUpperCase() + ':' + x)
                                .then(() => self.emit("deviceReady", dev));
                        });
                        A.retry(3, dev.auth.bind(dev));
                    }
                }, m, r));


            if (what && what.mac)
                self._devices[what.mac] = undefined;

            self._cs.on('close', arg => self.emit('close', (self._bound = self._cs = null, rej(arg))));

            if (!self._bound) {
                try {
                    self._cs.bind({
                        exclusive: false
                    }, A.N(() => {
                        self._cs.setMulticastTTL(20);
                        var port = self._cs.address().port;
                        var now = new Date();
                        //		var starttime = now.getTime();

                        var timezone = now.getTimezoneOffset() / -3600;
                        var packet = Buffer.alloc(0x30, 0);
                        var year = now.getYear();

                        if (timezone < 0) {
                            packet[0x08] = 0xff + timezone - 1;
                            packet[0x09] = 0xff;
                            packet[0x0a] = 0xff;
                            packet[0x0b] = 0xff;
                        } else {
                            packet[0x08] = timezone;
                            packet[0x09] = 0;
                            packet[0x0a] = 0;
                            packet[0x0b] = 0;
                        }
                        packet[0x0c] = year & 0xff;
                        packet[0x0d] = year >> 8;
                        packet[0x0e] = now.getMinutes();
                        packet[0x0f] = now.getHours();
                        var subyear = year % 100;
                        packet[0x10] = subyear;
                        packet[0x11] = now.getDay();
                        packet[0x12] = now.getDate();
                        packet[0x13] = now.getMonth();
                        packet[0x18] = parseInt(address[0]);
                        packet[0x19] = parseInt(address[1]);
                        packet[0x1a] = parseInt(address[2]);
                        packet[0x1b] = parseInt(address[3]);
                        packet[0x1c] = port & 0xff;
                        packet[0x1d] = port >> 8;
                        packet[0x26] = 6;
                        var checksum = 0xbeaf;

                        for (var i = 0; i < packet.length; i++) {
                            checksum += packet[i];
                        }
                        checksum = checksum & 0xffff;
                        packet[0x20] = checksum & 0xff;
                        packet[0x21] = checksum >> 8;
                        return A.repeat(3, () => what && what.address ? self.send(packet, what.address) : self.send(packet, '255.255.255.255').then(() => self.send(packet, '224.0.0.251')),null,100)
                            .catch(e => A.I('error when sending scan messages: ' + e))
                            .then(() => A.wait(ms))
                            .then(() => {
                                self._cs.removeAllListeners();
                                self._cs.close();
                                self._bound = self._cs = null;
                                //                        A.I("stop listening!");
                                return res(Promise.resolve());
                            });
                        /*                
                                    if (self._ip)
                                        self._cs.send(packet, 0, packet.length, 80, self._ip);
                                    if (what && what.address)
                                        self._cs.send(packet, 0, packet.length, 80, what.address);
                                    self._cs.send(packet, 0, packet.length, 80, '255.255.255.255');
                                    self._cs.send(packet, 0, packet.length, 80, '224.0.0.251');
                        */
                    }));
                    self._bound = true;
                } catch (e) {
                    self._cs = self._bound = null;
                    return rej(e);
                }
            }
        });
    }


    close() {
        if (this.bound) {
            this._cs.close();
            this._cs.removeAllListeners();
            this._bound = this._cs = null;
        }
        if (A.ownKeys(this._devices).length > 0)
            for (let m of A.ownKeys(this._devices)) {
                //                console.log(m);
                let dev = this._devices[m];
                if (dev) dev.close();
            }
        this._bound = this._cs = this._devices = null;
    }

}

if (Buffer.alloc === undefined) {
    Buffer.alloc = function (size /* , fill */ ) {
        var buf = new Buffer(size);
        for (var i = 0; i < size; i++)
            buf[i] = 0;
        return buf;
    };
}

module.exports = Broadlink;