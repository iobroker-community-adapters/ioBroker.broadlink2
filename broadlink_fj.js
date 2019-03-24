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
    A = require('@frankjoke/myadapter').MyAdapter;

class Device extends EventEmitter {
    constructor(host, mac, devtype, bl) {
        super();
        var self = this;
        this._val = {};
        this.s = new A.Sequence();
        this.bl = bl;
        this.host = host;
        this.type = "Unknown";
        this.typ = "UK";
        delete this.host.family;
        delete this.host.size;
        host.mac = mac;
        this.devtype = devtype;
        this.host.devhex = Broadlink.toHex(devtype, 4);
        this.host.name = this.host.devhex + '_' + mac;

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
                //                A.If('received message from %s:%O',self.name,obj);
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
                //                A.If('auth payload: %O', payload);
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
        packet[0x2a] = this.host.maco[0];
        packet[0x2b] = this.host.maco[1];
        packet[0x2c] = this.host.maco[2];
        packet[0x2d] = this.host.maco[3];
        packet[0x2e] = this.host.maco[4];
        packet[0x2f] = this.host.maco[5];
        packet[0x30] = this.id[0];
        packet[0x31] = this.id[1];
        packet[0x32] = this.id[2];
        packet[0x33] = this.id[3];

        if (payload && payload.length > 0) {
            let npl = Buffer.alloc(parseInt((payload.length + 16) / 16) * 16, 0);
            payload.copy(npl, 0, 0);
            payload = npl;
        }

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
        let pb = new Buffer.alloc(packet.length - 0x26);
        packet.copy(pb, 0, 0x26);
        //        A.If('sendPacket from id %s mac %s command %s, payload: %s, packet: %s, key:%s, iv:%s', this.id.toString('hex'), this.host.maco.toString('hex'), command.toString(16), payload.toString('hex'), pb.toString('hex'), this.key.toString('hex'), this.iv.toString('hex'));
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
        // eslint-disable-next-line no-unused-vars
        }, e => {
//            A.D(`getVal on '${this.host.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
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
            // eslint-disable-next-line no-unused-vars
        }, e => {
            //            A.D(`getVal on '${this.host.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
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
                // eslint-disable-next-line no-unused-vars
            }, e => {
                //                A.D(`getAll on '${this.host.name}' had error ${A.O(e)} and returned ${A.O(ret)}`);
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
        this.sendwait = new A.Sequence();
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

    sendVal(data) {
        var self = this;
        var packet = new Buffer([0x02, 0x00, 0x00, 0x00]);
        packet = Buffer.concat([packet, data]);
        return this.sendwait.addp(() => this.checkOff(self.sendPacket, 0x6a, packet,5000)); //.then(x => A.I(`setVal/sendData for ${this.host.name} returned ${A.O(x)}`, x));
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
        A.Df('Start learning with %s on %s', rf, self.host.name);
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
    // --- start of other test
    sendT1packet(cmd, data) {

        function crc16(buffer) {
            var crc = 0xFFFF;
            var odd;

            for (var i = 0; i < buffer.length; i++) {
                crc = crc ^ buffer[i];

                for (var j = 0; j < 8; j++) {
                    odd = crc & 0x0001;
                    crc = crc >> 1;
                    if (odd) {
                        crc = crc ^ 0xA001;
                    }
                }
            }
            return crc;
        }

        //        if (!data)
        //            data = Buffer.alloc(4, 0);
        //        else 
        if (Array.isArray(data))
            data = Buffer.from(data);
        //        A.If('sendT1packet: from id:%O key:%O = %O', this.id,this.key, data);
        const payload = Buffer.alloc(data.length + 4, 0);
        data.copy(payload, 2, 0);
        payload[0] = data.length + 2;

        let cc = crc16(data);
        payload[data.length + 2] = cc & 0xff;
        payload[data.length + 3] = (cc >> 8) & 0xff;
        //        A.If('sendT1packet: %O', payload);
        return this.sendPacket(cmd, payload).then(res => {
            //            A.If('sendT1packet got back from cmd %O',res);
            if (res && res.payload && !res.err) {
                //                let pl = res.payload;
                //                let size = pl[0];
                //                A.If('Got payload with size %n: %O', size, pl);
                return res.payload;
            }
            return A.reject(res);
        }, e => A.Wf('sendT1Packed error %O', e));
    }

    setTime(date) {
        if (!date)
            date = new Date();
        let dow = date.getDay();
        dow = dow ? dow : 7;
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x10, 0x00, 0x08, 0x00, 0x02, 0x04, date.getHours(), date.getMinutes(), date.getSeconds(), dow]);
    }
    setMode(auto, loop, sensor) {
        auto = auto !== undefined ? auto : this._val.autoMode;
        loop = loop !== undefined ? loop : this._val.loopMode;
        sensor = sensor !== undefined ? sensor : this._val.sensor;
        let mode = loop * 16 + auto;
        sensor = sensor ? sensor : 0;
        A.Df('setMode for %s = auto:%d loop:%d mode:%O, sensor:%O', this.name, auto, loop, mode, sensor);
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x06, 0x00, 0x02, mode, sensor]);
    }

    /*   def set_temp(self, temp):
    self.send_request(bytearray([0x01,0x06,0x00,0x01,0x00,int(temp * 2)]) )
    */
    setTemp(temp) {
        A.Df('setTemp for %s = temp:%d', this.name, temp);
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x06, 0x00, 0x01, 0x00, parseInt(temp * 2.0)]);
    }

    /*
      def set_power(self, power=1, remote_lock=0):
        self.send_request(bytearray([0x01,0x06,0x00,0x00,remote_lock,power]) )
    */
    setPower(power, remote) {
        power = power !== undefined ? power : this._val.power;
        remote = remote !== undefined ? remote : this._val.remoteLock;
        remote = remote ? 1 : 0;
        power = power ? 1 : 0;
        A.Df('setPower for %s = power:%d remote:%d', this.name, power, remote);
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x06, 0x00, 0x00, remote, power]);
    }
    /*
    # Advanced settings
    # Sensor mode (SEN) sensor = 0 for internal sensor, 1 for external sensor, 2 for internal control temperature, external limit temperature. Factory default: 0.
    # Set temperature range for external sensor (OSV) osv = 5..99. Factory default: 42C
    # Deadzone for floor temprature (dIF) dif = 1..9. Factory default: 2C
    # Upper temperature limit for internal sensor (SVH) svh = 5..99. Factory default: 35C
    # Lower temperature limit for internal sensor (SVL) svl = 5..99. Factory default: 5C
    # Actual temperature calibration (AdJ) adj = -0.5. Prescision 0.1C
    # Anti-freezing function (FrE) fre = 0 for anti-freezing function shut down, 1 for anti-freezing function open. Factory default: 0
    # Power on memory (POn) poweron = 0 for power on memory off, 1 for power on memory on. Factory default: 0
    def set_advanced(self, loop_mode, sensor, osv, dif, svh, svl, adj, fre, poweron):
      input_payload = bytearray([0x01,0x10,0x00,0x02,0x00,0x05,0x0a, loop_mode, sensor, osv, dif, svh, svl, (int(adj*2)>>8 & 0xff), (int(adj*2) & 0xff), fre, poweron])
      self.send_request(input_payload)
    */
    setAdvanced(item, val) {
        let v = this._val;
        if (item && v && v[item] !== undefined)
            this._val[item] = val;
        A.Df('setAdvanced for %s = power:%d remote:%d', this.name, item, val);
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x10, 0x00, 0x02, 0x00, 0x05, 0x0a, v.loopMode, v.sensor, v.osv, v.dif, v.svh, v.svl, (parseInt(v.roomTempAdj * 2) >> 8 & 0xff), (parseInt(v.roomTempAdj * 2) & 0xff), v.fre, v.poweron]);
    }

    /*
  # Set timer schedule
  # Format is the same as you get from get_full_status.
  # weekday is a list (ordered) of 6 dicts like:
  # {'start_hour':17, 'start_minute':30, 'temp': 22 }
  # Each one specifies the thermostat temp that will become effective at start_hour:start_minute
  # weekend is similar but only has 2 (e.g. switch on in morning and off in afternoon)
  def set_schedule(self,weekday,weekend):
    # Begin with some magic values ...
    input_payload = bytearray([0x01,0x10,0x00,0x0a,0x00,0x0c,0x18])

    # Now simply append times/temps
    # weekday times
    for i in range(0, 6):
      input_payload.append( weekday[i]['start_hour'] )
      input_payload.append( weekday[i]['start_minute'] )

    # weekend times
    for i in range(0, 2):
      input_payload.append( weekend[i]['start_hour'] )
      input_payload.append( weekend[i]['start_minute'] )

    # weekday temperatures
    for i in range(0, 6):
      input_payload.append( int(weekday[i]['temp'] * 2) )

    # weekend temperatures
    for i in range(0, 2):
      input_payload.append( int(weekend[i]['temp'] * 2) )

    self.send_request(input_payload)

    */
    setSchedule(id, val) {
        A.Df('Should set schedule item %s for %s to %O', id, val);
        let v = this._val;
        let a = [0x01, 0x10, 0x00, 0x0a, 0x00, 0x0c, 0x18];
        let i;
        for (i = 0; i < 6; i++) {
            a.push(v.weekday[i].startHour);
            a.push(v.weekday[i].startMinute);
        }
        for (i = 0; i < 2; i++) {
            a.push(v.weekend[i].startHour);
            a.push(v.weekend[i].startMinute);
        }
        for (i = 0; i < 6; i++) {
            a.push(parseInt(v.weekday[i].temp * 2));
        }
        for (i = 0; i < 2; i++) {
            a.push(parseInt(v.weekend[i].temp * 2));
        }
        return this.checkOff(this.sendT1packet, 0x6a, a);
    }

    getAll() {
        const ret = this._val;
        ret.here = false;

        function getSched(x, start, end) {
            let r = [];
            let i = start;
            while (i < end) {
                r.push({
                    startHour: Number(x[2 * i + 23]),
                    startMinute: Number(x[2 * i + 24]),
                    temp: Number(x[i + 39]) / 2.0
                });
                ++i;
            }
            return r;
        }
        //        return this.sendT1packet(0xA0).then(x => {
        return this.checkOff(this.sendT1packet, 0x6a, [0x01, 0x03, 0x00, 0x00, 0x00, 0x16]).then(x => {
            //            A.If('full status payload: %O',x);
            x.copy(x, 0, 2);
            ret.here = true;
            //            ret.payload = x;
            ret.remoteLock = Boolean(x[3] & 1);
            ret.power = Boolean(x[4] & 1);
            ret.active = Boolean(x[4] & 16);
            ret.tempManual = Boolean(x[4] & 64);
            ret.roomTemp = Number(x[5]) / 2.0;
            ret.thermostatTemp = Number(x[6]) / 2.0;
            ret.autoMode = Number(x[7] & 15);
            ret.loopMode = Number((x[7] >> 4) & 15);
            ret.sensor = Number(x[8]);
            ret.osv = Number(x[9]);
            ret.dif = Number(x[10]);
            ret.svh = Number(x[11]);
            ret.svl = Number(x[12]);
            ret.roomTempAdj = (Number(x[13]) * 256 + Number(x[14])) / 2.0;
            if (ret.roomTempAdj > 32767)
                ret.roomTempAdj = 32767 - ret.roomTempAdj;
            ret.fre = Number(x[15]);
            ret.poweron = Number(x[16]);
            ret.unknown = Number(x[17]);
            ret.externalTemp = Number(x[18]) / 2.0;
            ret.time = Number(x[19]) + ':' + Number(x[20]) + ':' + Number(x[21]) + ' @' + Number(x[22]);
            ret.poweron = Number(x[16]);
            ret.unknown = Number(x[17]);
            ret.weekday = getSched(x, 0, 6);
            ret.weekend = getSched(x, 6, 8);
            return ret;
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
                0x947A: 'SP3SPower',
            },
            T1: {
                class: T1,
                name: 't1',
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
                            const ipif = Object.assign({}, address);
                            delete ipif.family;
                            delete ipif.internal;
                            A.Df('interface to be used: %O:', ipif);
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
        if (!add)
            return;
        for (let k of add) {
            if (Array.isArray(k) && k.length === 2) {
                let cl = k[1].toUpperCase();
                let dt = Number(k[0]);
                if (this._devlist[cl])
                    this._devlist[cl][dt] = cl.toLowerCase();
            }
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
            if (self._ls) {
                self._ls = null;
                self.start15001();
            }
        });
        socket.on("message", function (message, rinfo) {
            let host = self.parsePublic(message, rinfo);
            //            A.Df(`15001 Message from: %O`, host);
            //            self.emit("15001", host);
            if (!self._devices[host.mac] || self._devices[host.mac].dummy)
                self.discover(host);
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
        host.name = 'unknown_' + devtype.toString(16) + '_' + host.mac;
        let dev = null;
        for (let cl of A.ownKeys(this._devlist)) {
            const typ = this._devlist[cl];
            if (typ[devtype] || (typ.range && devtype >= typ.range.min && devtype <= typ.range.max)) {
                dev = new typ.class(host, mac, devtype, this);
                host.type = typ.name;
                host.devname = typ.range ? typ.range.name : typ[devtype];
                return dev;
            }
        }
        host.type = 'unknown';
        host.devname = 'UKN';
        //        A.If('Unknown...%O, %s, %s',host, mac, devtype);
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

    parsePublic(msg, rinfo) {
        const self = this;
        const host = Object.assign(rinfo);
        let mac = Buffer.alloc(6, 0);
        //                    self._cs.setMulticastInterface(this.lastaddr);
        delete host.family;
        delete host.size;
        host.command = Number(msg[0x26]) + Number(msg[0x27]) * 256;
        if (msg.length >= 0x40) {
            //            mac = msg[0x3a:0x40];
            msg.copy(mac, 0, 0x3a, 0x40);
            host.devtype = Number(msg[0x34]) + Number(msg[0x35]) * 256;
        } else {
            msg.copy(mac, 0, 0x2a, 0x30);
        }

        host.maco = mac;
        mac = Array.prototype.map.call(new Uint8Array(mac), x => x.toString(16)).reverse();
        mac = mac.map(x => x.length < 2 ? '0' + x : x).join(':');

        //        mac = Array.prototype.map.call(new Uint8Array(mac), x => x.toString(16)).reverse().join(':');
        host.mac = mac;
        //        A.Df('parsePublic found %O with %O',host,msg);
        //            console.log(mac);
        if ((!self._devices[mac] || self._devices[mac].dummy) && host.devtype) {
            //            A.If('new device found: host=%O',host);
            var dev = self.genDevice(host.devtype, host, mac);
            self._devices[mac] = dev;
            dev.once("deviceReady", function () {
                return A.c2p(dns.reverse)(dev.host.address).catch(() => dev.host.name)
//                    .then(x => A.Ir(x, 'got back %O from %O', x, dev.host))
                    .then(x => Array.isArray(x) ? x[0].toString().trim().split('.')[0] : x.toString().trim(), () => dev.host.name)
                    .then(x => {
                        dev.host.name = dev.host.type.slice(0, 2).toUpperCase() + ':' + x;
                        dev.name = dev.host.name;
                        self._devices[dev.name] = dev;
                    }).then(() => self.emit("deviceReady", dev));
            });
            A.retry(3, dev.auth.bind(dev)).catch(A.nop);
        }
        return host;
    }

    getDev(name) {
        return this._devices && this._devices[name.trim()];
    }

    discover(what, ms) {
        const self = this;
        ms = ms || 5000;

        return new Promise((res, rej) => {

            if (!self._cs)
                self._cs = dgram.createSocket({
                    type: 'udp4',
                    reuseAddr: true
                }, (m, r) => A.N(self.parsePublic.bind(self), m, r));


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
                            addr.push(what.address);
                        else if (typeof what === 'string')
                            addr.push(what);
                        if (!addr.length)
                            addr = addr.concat(this._addresses);
                        A.Df('discover from %O', addr);
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
        const cl = this._ls;
        this._ls = null;
        if (cl)
            cl.close();

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