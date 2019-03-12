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
        this._val = {};
        this.s = new A.Sequence();
        this.bl = bl;
        this.host = host;
        this.type = "Unknown";
        delete this.host.family;
        delete this.host.size;
        host.mac = mac;
        this.devtype = devtype;
        this.host.devhex = Broadlink.toHex(devtype, 4);
        this.host.name = this.constructor.name + '_' + this.host.devhex + '_' + mac;

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
            this.bound = false;
        }
        if (this.bl && this.bl._devices)
            this.bl._devices[this.host.mac] = null;

        this.type = 'closed';
        this.emit('close');
    }

    get dummy() {
        return !this.bound || this.type === "Unknown" || this.type === 'closed';
    }

    get val() {
        return this._val;
    }

    checkOff(fun, arg1, arg2, arg3) {
        if (this.dummy)
            return Promise.reject({
                here: false,
                err: 'closed'
            });
        return Promise.resolve(fun ? fun.bind(this)(arg1, arg2, arg3) : undefined);
    }

    getAll() {
        if (A.T(this._val) === 'object')
            this._val.here = false;
        return this.checkOff(this.getVal).then(v => {
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
        const timeout = this.timeout || 1000;
        const self = this;
        if (!this.cs || this.tout) return Promise.reject('socket not created/bound or closed or waiting!');
        this.cs.removeAllListeners('message');
        return this.s.catch(e => A.Dr(e, 'Something went wrong in previous send: %O', e)).then(() => new Promise((res, rej) => {

            function reject(what) {
                if (self.tout) {
                    clearTimeout(self.tout);
                    self.tout = null;
                }
                self.cs.removeAllListeners('message');
                A.N(rej, what);
            }

            function resume(what) {
                if (self.tout) {
                    clearTimeout(self.tout);
                    self.tout = null;
                }
                self.cs.removeAllListeners('message');
                A.N(res, what);
            }

            self.cs.on('message', response => {
                self.lastResponse = Date.now();
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
                let obj = {
                    command: command,
                    cmdHex: Broadlink.toHex(command),
                    payload: payload,
                };
                //                A.If('message received, err=%s: %O',Broadlink.toHex(err), obj);
                if (command === 7) {
                    A.If('message command=7 received, err=%s: %O', Broadlink.toHex(err), obj);
                    return;
                }
                if (err === 0)
                    return resume(obj);
                obj.err = err;
                //                A.Wf(`Got error %O from device %s`, obj,self.host.name)
                return reject(obj);
            });
            self.tout = setTimeout(() => reject({
                here: false,
                err: `timed out on send`,
                name: self.host.name
            }), timeout);
            self.cs.send(packet, 0, packet.length, self.host.port, self.host.address, err => err ? reject(err) : null);
        }));

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
                A.N(self.emit.bind(self), "deviceReady", self);
                //                self.emit("deviceReady", self);
            } else {
                if (!what.err)
                    what.err = 0xe9;
                return A.reject(what);
            }
            return A.resolve(self);
        }); // .catch(e => A.Df('catch auth error %s! on %s with mac %s', e, self.host.name, self.host.address));
    }

    sendPacket(command, payload, timeout) {
        this.timeout = timeout || 700;
        if (this.timeout < 0) {
            this.timeout = -this.timeout;
        }
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

        if (timeout < 0)
            return this._send(packet);
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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
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
            // eslint-disable-next-line no-unused-vars
        }, e => {
            //            A.I(`getVal on '${this.host.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
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
        A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
        //        if (A.T(state) === 'object' && state.nightlight !== undefined)
        //            nl = !!state.nightlight;
        if (A.T(state) === 'object' && state.state !== undefined)
            st = !!state.state;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.host.name}' to ${A.O(state)}: error wrong argument type!`);
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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(vret['sw' + sw] = st) : A.reject(vret));
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
            st = !!state.state;
        var packet = Buffer.alloc(4, 4);
        packet[0] = st ? 1 : 0;
        return this.checkOff(this.sendPacket, 0x66, packet).then(ret => ret.err || !!ret.payload ? A.reject(this._val) : (this._val = st));
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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.here = true;
                ret.state = !!(payload[0x4] & 1);
                //                ret.nightlight = !!(payload[0x4] & 2);
                return A.resolve(ret);
            } else return A.reject(ret);
        }, e => {
            A.D(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
            return ret;
        }); //.catch(e => A.I(`getVal on '${this.constructor.name}' had error ${A.O(e)} and returned ${A.O(self._val)}`, e));
    }

    setVal(state) {
        //"""Sets the power state of the smart plug."""
        const self = this;
        let st = state;
        //        let nl = false;
        A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
        //        if (A.T(state) === 'object' && state.nightlight !== undefined)
        //            nl = !!state.nightlight;
        if (A.T(state) === 'object' && state.state !== undefined)
            st = !!state.state;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.host.name}' to ${A.O(state)}: error wrong argument type!`);
        let packet = Buffer.alloc(16, 0);
        packet[0] = 2;
        //        packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
        packet[4] = st ? 1 : 0;
        return this.checkOff(this.sendPacket, 0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(self._val.state = st) : A.reject(self._val));
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
        if (A.T(state) === 'object' && state.state !== undefined)
            st = !!state.state;
        else if (typeof state === 'boolean' || typeof state === 'number')
            st = !!state;
        else return A.reject(`setVal on '${this.host.name}' to ${A.O(state)}: error wrong argument type!`);
        let packet = Buffer.alloc(16, 0);
        packet[0] = 2;
        packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
        return this.getAll().then(x => (self._val.energy = x.energy, self._val.nightlight = x.nightlight, self._val.state = x.state), () => null)
            .then(() => this.sendPacket(0x6a, packet).then(ret => ret.err || !!ret.payload ? A.resolve(self._val, self._val.state = st, self._val.here = true) : A.reject(self._val)));
    }

    getVal() {
        //"""Returns the power state of the smart plug."""
        const ret = this._val;
        if (A.T(ret) === 'object')
            ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 1;
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let payload = res.payload;
                ret.here = true;
                ret.state = !!(payload[0x4] & 1);
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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(ret => {
            //            A.I(`payload get energy: ${A.O(ret)}`);
            if (ret && ret.payload && ret.payload[0] === 8)
                return A.resolve(parseFloat(ret.payload[7].toString(16) + ret.payload[6].toString(16) + ret.payload[5].toString(16)) / 100.0);
            return A.reject();
        }); // .catch(err => A.resolve(A.W(`got err in get energy: ${A.O(err)}`, undefined)));
    }
}

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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
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

class S1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "S1";
        this._val = {};
        this._sensorTypes = {
            0x31: 'DoorSensor', // 49 as hex
            0x91: 'KeyFob', // 145 as hex, as serial on fob corpse
            0x21: 'MotionSensor' // 33 as hex
        };

    }
    getVal() {

        function getSensor(pl, num) {
            const val = {};
            const buf = pl.slice(6 + num * 83, 5 + (num + 1) * 83);
            //            val.payload = buf;
            //            val.status = Number(buf[0]);
            //            val.order = Number(buf[1]);
            //            val.type = Number(buf[3]);
            let name = buf.slice(4, 26);
            let serial = buf[26] + buf[27] * 256 + buf[28] * 65536 + buf[29] * 16777216;
            while (!name[name.length - 1])
                name = name.slice(0, [name.length - 1]);
            name = name.toString('utf8') + ' ' + serial.toString(16);
            name = name.replace(/\s+/g, '_');
            val[name] = Number(buf[0]);
            return val;
        }
        //        const self = this;
        const ret = this._val;
        ret.here = false;
        var packet = Buffer.alloc(16, 0);
        //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
        packet[0] = 6;
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
            //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                //                A.If('S1 %s returned len &d %O', self.host.name, res.payload.length, res.payload);
                let number = Number(res.payload[0x4]);
                for (let i = 0; i < number; i++) {
                    //                    Object.assign(ret,getSensor(res.payload,i));
                    Object.assign(ret, getSensor(res.payload, i));
                }
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
        return this.checkOff(this.sendPacket, 0x6a, packet).then(res => {
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
        //        A.I(`send checkData on '${this.constructor.name}'`);
        return this.checkOff(this.sendPacket, 0x6a, packet, -1000).then(res => {
            //             A.I(`checkData on '${this.constructor.name}' returned ${A.O(res)}`);
            if (res && res.payload && !res.err) {
                let data = Buffer.alloc(res.payload.length - 4, 0);
                res.payload.copy(data, 0, 4);
                return A.resolve(data);
            }
            return A.reject(res);
        });
    }

    learn() {
        const self = this;
        this.learning = true;
        A.If('Should learn on %s', this.host.name);
        return self.checkData().catch(e => e).then(() => self.enterLearning().then(() => A.retry(15, () => A.wait(2000).then(() => self.checkData())).catch(() => null).then(l => {
            self.learning = false;
            return l ? {
                data: l.toString('hex')
            } : {};
        })));
    }

    setVal(data) {
        var packet = new Buffer([0x02, 0x00, 0x00, 0x00]);
        packet = Buffer.concat([packet, data]);
        return this.checkOff(this.sendPacket, 0x6a, packet); //.then(x => A.I(`setVal/sendData for ${this.host.name} returned ${A.O(x)}`, x));
    }

    enterLearning() {
        var packet = Buffer.alloc(16, 0);
        packet[0] = 3;
        return this.checkOff(this.sendPacket, 0x6a, packet); //.then(x => A.I(`enterLearning for ${this.host.name} returned ${A.O(x)}`, x));
    }

}

class RMP extends RM {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "RMP";
    }

    learn(rf) {
        const self = this;
        A.Df('Start learning with %s on %s',rf,self.host.name);
        this.learning = true;
        const l = {};

        function enterRFSweep() {
            var packet = Buffer.alloc(16, 0);
            packet[0] = 0x19;
            return self.checkOff(self.sendPacket, 0x6a, packet); //.then(x => A.I(`enterRFSweep for ${this.host.name} returned ${A.O(x)}`, x));
        }

        function checkRFData(check2) {
            var packet = Buffer.alloc(16, 0);
            packet[0] = check2 ? 0x1b : 0x1a;
            return self.checkOff(self.sendPacket, 0x6a, packet).then(res => {
                //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
                if (res && res.payload && !res.err) {
                    if (res.payload[4] === 1)
                        return true;
                }
                return A.reject(res);
            });
        }

        function cancelRFSweep() {
            var packet = Buffer.alloc(16, 0);
            packet[0] = 0x1e;
            return self.checkOff(self.sendPacket, 0x6a, packet); // .then(x => A.I(`CancelRFSwwep for ${this.host.name} returned ${A.O(x)}`, x));
        }

        if (!rf)
            return super.learn();

        A.If('Should learn RF-sweep on %s', this.host.name);
        return self.checkData().catch(e => e).then(() => enterRFSweep())
            .then(() => A.retry(30, () => A.wait(1000).then(() => self.checkData().then(ld => ld ? l.data = ld.toString('hex') : ld))).catch(() => null).then(() => {
                self.learning = false;
                return A.wait(100).then(() => checkRFData().then(x => l.rf = x, () => null).then(() => checkRFData(true)).then(x => l.rf2 = x, () => null).then(() => cancelRFSweep()).catch(() => null))
                    .then(() => self.checkData().then(d => d ? l.data = d.toString('hex') : null, () => null))
                    .then(() => l);
            }));
    }

}

class T1 extends Device {
    constructor(host, mac, devtype, bl) {
        super(host, mac, devtype, bl);
        this.type = "T1";
    }
    /*    // --- start of other test
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
                A.I(`Send to T1 ${A.O(payload)}`);
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
    */ // --- end of other test
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
        return this.checkOff(this.sendPacket, 0x6a, payload).then(res => {
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
        return this.checkOff(this.sendT1packet, 0xA0, buf).then(x => {
            ret.payload = x;
            ret.here = true;
        });
    }
}


class Broadlink extends EventEmitter {
    constructor(add) {
        super();
        this._devices = {};
        this._cs = null;
        this._ls = null;
        this._addresses = [];
        this._devlist = {
            SP1: {
                0x0000: 'SP1',
                name: 'sp1',
                class: SP1
            },
            SP2: {
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
            },
            SP3P: {
                class: SP3P,
                name: 'sp3p',
                isPlus: true,
                0x947A: 'SP3SPower',
            },
            T1: {
                class: T1,
                name: 't1',
                isPlus: true,
                0x4ead: 'T1 Floureon',
            },
            RM: {
                class: RM,
                name: 'rm',
                0x2712: 'RM2',
                0x2737: 'RM Mini',
                0x273d: 'RM Pro Phicomm',
                0x2783: 'RM2 Home Plus',
                0x277c: 'RM2 Home Plus GDT',
                0x278f: 'RM Mini Shate',
                0x2797: 'RM Pro (OEM)',
                0x27C2: 'RM Mini 3'
            },
            RMP: {
                class: RMP,
                name: 'rmp',
                isPlus: true,
                0x272a: 'RM2 Pro Plus',
                0x2787: 'RM2 Pro Plus2',
                0x278b: 'RM2 Pro Plus BL',
                0x279d: 'RM3 Pro Plus',
                0x27a9: 'RM3 Pro Plus', // addition for new RM3 mini
            },
            A1: {
                class: A1,
                name: 'a1',
                0x2714: 'A1'
            },
            MP1: {
                class: MP1,
                name: 'mp1',
                0x4EB5: 'MP1'
            },
            S1C: {
                class: S1,
                name: 's1',
                0x2722: 'S1'
            }
        };

        let interfaces = os.networkInterfaces(),
            address;
        for (let k in interfaces) {
            if (interfaces.hasOwnProperty(k)) {
                for (let k2 in interfaces[k]) {
                    if (interfaces[k].hasOwnProperty(k2)) {
                        address = interfaces[k][k2];
                        if (address.family === 'IPv4' && !address.internal) {
                            A.Df('list interfaces: %O:', address);
                            this._addresses.push(address.address);
                        }
                    }
                }
            }
        }
        //        this.address = addresses[0].split('.');
        //      this.lastaddr = addresses[addresses.length-1];
        for (let a in this._addresses) {
            let al = this._addresses[a].split('.');
            al[3] = 255;
            this._addresses[a] = al.join('.');
        }
        this._addresses.push('255.255.255.255');
        this._addresses.push('224.0.0.251');

        for (let k of add) {
            if (Array.isArray(k) && k.length === 2 && this._devlist[k[0]])
                this._devlist[k[0]][Number(k[1])] = k[0].toLowerCase();
        }

    }

    static toHex(n, len) {
        len = Math.abs(len) || 2;
        let st = '0'.repeat(len);
        st = n < 0 ? '-0x' + st : '0x' + st;
        let s = n.toString(16);
        return st.slice(0, -s.length) + s;
    }

    get list() {
        return this._devices;
    }

    start15001() {
        const self = this;
        if (this._ls)
            return A.resolve();
        const PORT = 15001;
        //        const MULTICAST_ADDR = "255.255.255.255";
        const socket = dgram.createSocket({
            type: "udp4",
            reuseAddr: true
        });
        socket.on("close", function () {
            self._ls = null;
        });
        socket.on("message", function (message, rinfo) {
            A.Df(`Message from: ${rinfo.address}:${rinfo.port} - %O`, message);
            self.emit("15001", message, rinfo);
        });
        return new Promise((res, rej) => {
            try {
                socket.bind(PORT, function () {
                    //                    socket.addMembership(MULTICAST_ADDR);
                    //                    for (let i=0; i<self.addresses.length-2; i++)
                    //                    socket.addMembership(self.addresses[i]);
                    const address = socket.address();
                    A.If(`UDP socket listening on ${address.address}:${address.port}`);
                });
                this._ls = socket;
                A.N(res, true);
            } catch (e) {
                return A.N(rej, e);
            }
        });

    }

    send15001(buffer, addr, port) {
        const message = Buffer.from(`Message from process ${process.pid}`);
        if (!this._ls)
            return A.resolve();
        return new Promise((res, rej) => {
            const toout = setTimeout(() => A.N(rej, 'timeout'), 1000);
            this._ls.send(message, 0, message.length, port, addr, function () {
                clearTimeout(toout);
                return A.N(res, true);
            });
        });
    }


    genDevice(devtype, host, mac) {
        //        A.Df('got device type %s @host:%O', devtype.toString(16), host);
        host.devtype = devtype;
        host.type = 'unknown';
        host.name = 'unknown_' + host.mac;
        let dev = null;
        for (let cl of A.ownKeys(this._devlist)) {
            const typ = this._devlist[cl];
            if (typ[devtype] || (typ.range && devtype >= typ.range.min && devtype <= typ.range.max)) {
                dev = new typ.class(host, mac, devtype, this);
                //                dev[typ.name](typ.isPlus);
                host.type = typ.name;
                host.devname = typ.range ? typ.range.name : typ[devtype];
                return dev;
            }
        }
        return new Device(host, mac, devtype, this);
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
        ms = ms || 5000;

        return new Promise((res, rej) => {

            if (!self._cs)
                self._cs = dgram.createSocket({
                    type: 'udp4',
                    reuseAddr: true
                }, (m, r) => A.N((msg, rinfo) => {
                    var host = rinfo;
                    var mac = Buffer.alloc(6, 0);
                    //                    self._cs.setMulticastInterface(this.lastaddr);

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
                                .then(x => Array.isArray(x) ? x[0].toString().trim().split('.')[0] : x.toString().trim(), () => dev.host.name)
                                .then(x => dev.host.name = dev.host.type.slice(0, 2).toUpperCase() + ':' + x)
                                .then(() => self.emit("deviceReady", dev));
                        });
                        A.retry(3, dev.auth.bind(dev)).catch(A.nop);
                    }
                }, m, r));


            self._cs.on('close', arg => self.emit('close', (self._bound = self._cs = null, rej(arg))));

            if (!self._bound) {
                try {
                    self._cs.bind({
                        exclusive: false
                    }, A.N(() => {
                        self._cs.setMulticastTTL(20);
                        let port = self._cs.address().port;
                        let address = self._cs.address().address;
                        let now = new Date();
                        //		var starttime = now.getTime();

                        let timezone = now.getTimezoneOffset() / -3600;
                        let packet = Buffer.alloc(0x30, 0);
                        let year = now.getYear();

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
                        let subyear = year % 100;
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
                        let checksum = 0xbeaf;

                        for (let i = 0; i < packet.length; i++) {
                            checksum += packet[i];
                        }
                        checksum = checksum & 0xffff;
                        packet[0x20] = checksum & 0xff;
                        packet[0x21] = checksum >> 8;
                        let addr = [];
                        if (Array.isArray(what))
                            addr = addr.concat(what.map(x => x.address));
                        else if (what && what.address)
                            addr.push(addr);
                        if (!addr.length)
                            addr = addr.concat(this._addresses);
                        A.Df('discover from %O , what: %O', addr, what && what.length);
                        return A.repeat(5, () => A.seriesOf(addr, a => self.send(packet, a), 10), null, 500)
                            .catch(e => A.I('error when sending scan messages: ' + e))
                            .then(() => A.wait(ms))
                            .then(() => {
                                self._cs.removeAllListeners();
                                self._cs.close();
                                self._bound = self._cs = null;
                                //                        A.I("stop listening!");
                                return res(Promise.resolve());
                            });
                    }));
                    self._bound = true;
                } catch (e) {
                    self._cs = self._bound = null;
                    return rej(e);
                }
            }
        });
    }

    getAll(mac) {
        if (!this._devices[mac])
            return A.resolve({
                here: false
            });
        return this._devices[mac].getAll();
    }

    valMac(mac) {
        if (!this._devices[mac])
            return A.resolve({
                here: false
            });
        return this._devices[mac].val;
    }

    close() {
        if (this._ls)
            this._ls.close();
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