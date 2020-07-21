/* eslint-disable no-await-in-loop */
"use strict";
/**
 * UDP Connector for Broadlink devices
 * Modified version for ioBroker compatibility. Based on https://github.com/momodalo/broadlinkjs/blob/master/index.js
 *
 * @licence MIT
 */
// jshint node:true, esversion:6, strict:true, undef:true, unused:true, bitwise: false
//var util = require('util');
const EventEmitter = require("events"),
  dgram = require("dgram"),
  dns = require("dns"),
  os = require("os"),
  crypto = require("crypto"),
  A = require("./fjadapter");

class Udp extends EventEmitter {
  constructor(port, address) {
    super();
    this.retry = 3;
    this.cs = null;
    this.address = address;
    this.port = port;
    this._bound = false;
    this._ready = this.createSocket().catch(A.nothing);
  }

  async createSocket() {
    const that = this;
    this._bound = false;
    const cs = dgram.createSocket({
      type: "udp4",
      reuseAddr: true,
    });
    this.cs = cs;
    // this.address = cs.address();
    cs.on("error", (err) => {
      A.I(`UDP Socket error ${err}`);
      that.renew();
    });
    // cs.on('listening', );
    cs.on("message", (msg, rinfo) => {
      // A.I(`Message received on ${that.address}:${that.port} = '${msg.length}', ${A.O(rinfo)}`);
      that.emit("message", msg, rinfo);
    });
    that._bound = await new Promise((res, rej) => {
      try {
        const pa = {
          exclusive: false,
        };
        if (that.port) pa.port = that.port;
        if (that.port !== undefined && that.address) pa.address = that.address;
        // A.I(`Try to bind ${A.O(cs)} to ${that.address}:${that.port}`);
        cs.bind(pa, () => {
          const addr = cs.address();
          that.retry = 3;
          that.port = addr.port;
          that.address = addr.address;
          that._bound = true;
          A.D(`UDP listening on ${that.address}:${that.port}`);
          res(true);
        });
      } catch (e) {
        A.W(`could not bind socket ${e} for ${that.address}:${that.port}`);
        rej(false);
      }
    });
    return that.bound;
  }

  toString() {
    return `Udp(${this.address}:${this.port}=${this._bound})`;
  }

  close() {
    if (this.cs && this.bound) {
      this.cs.removeAllListeners();
      this.cs.close();
      this.cs = null;
      this._bound = false;
    }
  }

  send(...args) {
    const that = this;
    // A.I(`Send ${args} via ${this.address}:${this.port}`);
    if (this.cs && this._bound)
      return new Promise((res, rej) =>
        that.cs.send(...args, (err, obj) => {
          if (err) {
            A.I(`Send error ${err} on ${that}`);
            return rej(err);
          }
          res(obj);
        })
      );
    return Promise.resolve(null);
  }

  async renew(n) {
    if (n) this.retry = n;
    if (this._bound) this.close();
    this.cs = null;
    while (this.retry > 0) {
      this.retry--;
      if (await this.createSocket()) break;
    }
  }

  get socket() {
    return this.cs;
  }

  get bound() {
    return this.cs && this._bound;
  }
}

const authMinutes = 5;

function msMinutes(x) {
  const m = x < 0 ? authMinutes + x : x | authMinutes;
  return m * 60 * 1000;
}

class Device extends EventEmitter {
  constructor(host, mac, devtype, bl) {
    super();
    // var self = this;
    this._val = {};
    this.reAuth = Date.now() - msMinutes(-3);
    // this.s = new A.Sequence();
    this.bl = bl;
    this.host = host;
    // this.type = "Unknown";
    // this.typ = "UK";
    delete this.host.family;
    delete this.host.size;
    host.mac = mac;
    this.devtype = devtype;
    this.host.devhex = Broadlink.toHex(devtype, 4);
    this.host.name = this.host.devhex + "_" + mac;
    this._cmdByte = 0;
    this.count = Math.random() & 0xffff;
    this.key = new Buffer([
      0x09,
      0x76,
      0x28,
      0x34,
      0x3f,
      0xe9,
      0x9e,
      0x23,
      0x76,
      0x5c,
      0x15,
      0x13,
      0xac,
      0xcf,
      0x8b,
      0x02,
    ]);
    this.id = new Buffer([0, 0, 0, 0]);
    this.iv = new Buffer([
      0x56,
      0x2e,
      0x17,
      0x99,
      0x6d,
      0x09,
      0x3d,
      0x28,
      0xdd,
      0xb3,
      0xba,
      0x69,
      0x5a,
      0x2e,
      0x6f,
      0x58,
    ]);
    this.udp = new Udp();
    /*
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
                        exclusive: false
                    });
                    this.bound = true;
                } catch (e) {
                    A.W(`could not bind socket for ${A.O(this.host)}`);
                }
        */
  }

  get type() {
    const name = this.constructor.name;
    return name == "Device" ? "Unknown" : this.udp ? name : "closed";
  }

  get typ() {
    return this.type.slice(0, 2);
  }

  static get errors() {
    return {
      0xffff: "Authentication failed",
      0xfffe: "You have been logged out",
      0xfffd: "The device is offline",
      0xfffc: "Command not supported",
      0xfffb: "The device storage is full",
      0xfffa: "Structure is abnormal",
      0xfff9: "Control key is expired",
      0xfff8: "Send error",
      0xfff7: "Write error",
      0xfff6: "Read error",
      0xfff5: "SSID could not be found in AP configuration",
    };
  }

  get bound() {
    return this.udp && this.udp.bound;
  }
  get doReAuth() {
    if (this.learning || !this.udp || this.inReAuth) return false;
    return (
      (this.type.startsWith("RM4") || this.type.startsWith("LB")) &&
      Date.now() - this.reAuth > msMinutes()
    );
  }

  checkError(res, index) {
    let err = "";
    // if (!res) err = "No result delivered! No err check possible!";
    if (!res || !res.response) {
      return null;
    }
    // return "No result delivered! No err check possible!";
    const pl = res.response;
    if (pl && pl.length > index + 1) {
      const e = pl[index] + (pl[index + 1] << 8);
      // const e = 0xfffb;
      // A.I(`${this.host.name}: e=${e.toString(16)}, f=${f.toString(16)}, res=${A.O(res)}`);
      if (e) {
        err = Device.errors[e]
          ? Device.errors[e]
          : `Unknown error ${e.toString(16)} in response!`;
        A.Df(
          "Dev %s returned err `%s` Check response from %s: %s, res=%s, host=%s",
          this.toString(),
          err,
          "0x" + index.toString(16),
          res.response.slice(index).toString("hex"),
          A.O(res),
          A.O(this.host)
        );
        if (this.host.devtype == 0x5f36 && e == 0xfffb) {
          // A.I(`This.device had  0xfffb: The device storage error!`);
          err = "";
        } else A.D(`host=${A.O(this.host)}, e=${e.toString(16)}`);
        if (e == 0xfff9) {
          // A.I(`This.device had  0xfff9: please re-auth!`);
          this.reAuth = Date.now() - msMinutes();
        }
      }
    }
    if (!!err && res) res.err = err;
    if (err) A.D(`Error '${err}' in device.checkError for ${this}`);
    return err;
  }

  toString() {
    return `${this.type}, ${this.name}, ${this.host.mac}, ${this.host.address}${
      this.host.oname ? ", " + this.host.oname : ""
    }${this.host.fware ? ", fw=" + this.host.fware : ""}${
      this.host.cloud ? "cloud=true" : ""
    }`;
  }

  close() {
    if (this.tout) {
      //            clearTimeout(self.tout);
      this.tout = null;
    }
    if (this.udp) {
      this.udp.close();
      // this.cs.removeAllListeners();
      this.udp = null;
    }
    if (this.bl && this.bl._devices) this.bl._devices[this.host.mac] = null;

    // this.type = 'closed';
    this.emit("close");
  }

  get dummy() {
    return !this.bound || this.type === "Unknown" || this.type === "closed";
  }

  get val() {
    return this._val;
  }

  async checkOff(fun, ...args) {
    if (this.dummy)
      return {
        here: false,
        err: "closed",
      };
    if (!fun || typeof fun != "function")
      return {
        err: "no function",
      };
    try {
      const res = await fun.bind(this)(...args);
      if (res) return res;
    } catch (e) {
      try {
        await A.wait(10);
        return fun.bind(this)(...args);
      } catch (er) {
        A.D(`Error '${er}' when reading device ${this}`);
        return {
          err: er,
        };
      }
    }
    // return Promise.resolve(fun ? fun.bind(this)(...args) : undefined);
  }

  async getAll() {
    if (A.T(this._val) === "object") this._val.here = false;
    let v = await this.checkOff(this.getVal);
    if (v === null || v === undefined)
      v = {
        here: false,
      };
    else if (A.T(v) !== "object")
      v = {
        val: v,
        here: true,
      };
    return v;
  }

  async getVal() {
    await A.wait(0);
    return this._val;
  }

  async setVal(obj) {
    await A.wait(0);
    return (this._val = obj);
  }

  async _send(packet) {
    const cmd = packet[this._cmdByte];
    //    const cmd = packet[0];
    const timeout = this.timeout || 1000;
    const self = this;
    self.sent = new A.HrTime();
    let count = 4;
    while (!this.bound && count--) {
      await A.wait(2);
      if (this._ready)
        await this._ready.then(
          () => true,
          () => false
        );
      if (!this.bound && !count) {
        // debugger;
        const msg = `socket not created/bound/closed ${this}, ${this.udp}!`;
        A.W(msg);
        throw new Error(msg);
      }
    }
    count = 4;
    while (self.tout) {
      if (!count--) {
        const msg = `${this} still waiting for previous command ${this.tout}!`;
        A.W(msg);
        return Promise.reject(null);
      }
      await A.wait(20 + (4 - count) * 100);
    }
    this.udp.removeAllListeners("message");
    // await this.s.catch(e => A.Dr(e, 'Something went wrong in previous send: %O', e));
    return new Promise((res, rej) => {
      function reject(what) {
        if (self.tout) {
          clearTimeout(self.tout);
        }
        self.tout = null;
        self.udp.removeAllListeners("message");
        rej(what);
      }

      function resume(what) {
        // self.udp.removeAllListeners("message");
        res(what);
      }

      self.udp.once("message", async (response) => {
        if (self.tout) {
          clearTimeout(self.tout);
        }
        self.tout = null;
        // await A.nextTick();
        // A.D(`Send took ${self.sent.text}s for ${self} `);
        self.lastResponse = Date.now();
        const enc_payload = Buffer.alloc(response.length - 0x38, 0);
        response.copy(enc_payload, 0, 0x38);

        const decipher = crypto.createDecipheriv(
          "aes-128-cbc",
          self.key,
          self.iv
        );
        decipher.setAutoPadding(false);
        let payload = decipher.update(enc_payload);
        var p2 = decipher.final();
        if (p2) {
          payload = Buffer.concat([payload, p2]);
        }

        const command = response[0x26];
        let err = response[0x22] | (response[0x23] << 8);
        // if (err == 0xfff9) this.reAuth = Date.now() - msMinutes();

        // if (Device.errors[err]) {
        //     err = Device.errors[err];
        // }
        const obj = {
          cmd,
          command: command,
          // err,
          response,
          cmdHex: Broadlink.toHex(command),
          payload: payload,
        };
        //                A.If('message received, err=%s: %O',Broadlink.toHex(err), obj);
        if (command === 7) {
          A.If(
            "message command=7 received, err=%s: %O",
            Broadlink.toHex(err),
            obj
          );
          return resume(obj);
        }
        //                A.If('received message from %s:%O',self.name,obj);
        // if (!err)
        return resume(obj);
        // obj.err = err;
        //                A.Wf(`Got error %O from device %s`, obj,self.host.name)
        // return reject(obj);
      });

      self.tout = setTimeout(
        () =>
          reject({
            here: false,
            err: `timed out on send`,
            name: self.host.name,
          }),
        timeout
      );

      return self.udp
        .send(packet, 0, packet.length, self.host.port, self.host.address)
        .then(
          (r) => r,
          (r) => r
        )
        .then((r) =>
          r
            ? r
            : reject({
                here: false,
                err: `send udp packet error`,
                name: self.host.name,
              })
        );
    });
  }

  async auth() {
    const self = this;
    this.key = new Buffer([
      0x09,
      0x76,
      0x28,
      0x34,
      0x3f,
      0xe9,
      0x9e,
      0x23,
      0x76,
      0x5c,
      0x15,
      0x13,
      0xac,
      0xcf,
      0x8b,
      0x02,
    ]);
    this.id = new Buffer([0, 0, 0, 0]);
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
    payload[0x30] = "T".charCodeAt(0);
    payload[0x31] = "e".charCodeAt(0);
    payload[0x32] = "s".charCodeAt(0);
    payload[0x33] = "t".charCodeAt(0);
    payload[0x34] = " ".charCodeAt(0);
    payload[0x35] = " ".charCodeAt(0);
    payload[0x36] = "1".charCodeAt(0);

    const what = await this.sendPacket(0x65, payload);
    self.reAuth = Date.now() - msMinutes(-1);
    if (this.checkError(what, 0x22)) return Promise.reject(what);
    const command = what.command;
    payload = what.payload;
    if (command === 0xe9) {
      //                A.If('auth payload: %O', payload);
      self.key = Buffer.alloc(0x10, 0);
      payload.copy(self.key, 0, 0x04, 0x14);

      self.id = Buffer.alloc(0x04, 0);
      payload.copy(self.id, 0, 0x00, 0x04);
      //                            A.I(`I emit deviceReady for ${A.O(self.host)}`);
      self.reAuth = Date.now();
      A.N(self.emit.bind(self), "deviceReady", self);
      //                self.emit("deviceReady", self);
    } else {
      if (!what.err) what.err = 0xe9;
      return Promise.reject(what);
    }
    return self;
    // .catch(e => A.Df('catch auth error %s! on %s with mac %s', e, self.host.name, self.host.address));
  }

  async sendPacket(command, payload, timeout) {
    const that = this;
    const cmd = payload && Number(payload[0]);
    if (this.doReAuth) {
      that.inReAuth = true;
      that.reAuth = Date.now() - msMinutes(-2);
      A.wait(2000).then(async () => {
        // A.D(`Need to re-auth ${that}!`);
        const res = await A.retry(3, that.auth.bind(that), 100).catch((err) =>
          A.W(`Failed to authenticate device ${that} with err ${err}`)
        );
        A.D(
          `Reauth result of ${that} is: ${res} ${
            (Date.now() - that.reAuth) / 1000.0
          } seconds`
        );
      });
      that.inReAuth = false;
    }

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
    packet[0x24] = this.devtype & 0xff;
    packet[0x25] = this.devtype >> 8;
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

    var cipher = crypto.createCipheriv("aes-128-cbc", this.key, this.iv);
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
    let err = null;
    if (timeout < 0)
      return this._send(packet, command).catch((e) => {
        err = "SendPacketSingleErr " + A.O(e);
        return null;
      });
    let n = 3;
    while (n--) {
      // eslint-disable-next-line no-await-in-loop
      // eslint-disable-next-line no-loop-func
      let res = null;
      try {
        res = await this._send(packet, command);
      } catch (e) {
        A.Df("send Error on device %s: %O", this.toString(), e);
        // if (e && e.err) {
        //   const err = e.err;
        //   if (
        //     Device.errors[err] ||
        //     Object.entries(Device.errors).filter((i) => i[1] == err).length
        //   ) {
        //     A.I(`Unrecoverable Send packet error ${A.O(e)} on ${that}`);
        //     return null;
        //   }
        // }
        res = e;
      }
      if (res && !res.err) return res;
      if (res) err = res.err;
      // if (n == 2)
      //     await this.udp.renew(3);
      await A.wait(20 + 150 * (3 - n));
    }
    A.D(
      `sendPacket error: command ${"0x" + command.toString(16)}/${
        "0x" + cmd.toString(16)
      } error after 3 trials!: ${err} for ${that}`
    );
    // if (this.errorcount>10) await this.auth().catch(x => A.W(`Re-Auth failed with ${x} for ${this}`));
    return null;
    // return A.retry(3, this._send.bind(this), packet);
  }
  /* 
  def set_name(self, name):
  packet = bytearray(4)
  packet += name.encode('utf-8')
  packet += bytearray(0x50 - len(packet))
  packet[0x43] = self.cloud
  response = self.send_packet(0x6a, packet)
  check_error(response[0x22:0x24])
  self.name = name

def set_lock(self, state):
  packet = bytearray(4)
  packet += self.name.encode('utf-8')
  packet += bytearray(0x50 - len(packet))
  packet[0x43] = state
  response = self.send_packet(0x6a, packet)
  check_error(response[0x22:0x24])
  self.cloud = bool(state)
 */
  async get_firmware() {
    //        const self = this;
    var packet = Buffer.alloc(16, 0);
    packet[0] = 0x68;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let payload = res.payload;
      const fw = payload[0x4] + (payload[0x5] << 8);
      this.host.fware = fw;
      // A.Df("Device has firmware %s: %O", fw.toString(), this.host);
      return fw;
    }
    return NaN;
  }
}

class MP1 extends Device {
  // constructor(host, mac, devtype, bl) {
  //   super(host, mac, devtype, bl);
  //   // this.type = "MP";
  // }
  async getVal() {
    //"""Returns the power state of the smart plug."""
    const ret = this._val;
    if (A.T(ret) === "object") ret.here = false;
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
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    if (this.checkError(res, 0x22));

    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let state = res.payload[0x0e];
      ret.here = true;
      ret.sw1 = Boolean(state & 1);
      ret.sw2 = Boolean(state & 2);
      ret.sw3 = Boolean(state & 4);
      ret.sw4 = Boolean(state & 8);
      //                ret.nightlight = !!(payload[0x4] & 2);
    }
    return ret;
  }

  async setVal(state, sw) {
    //"""Sets the power state of the smart plug."""
    const vret = this._val;
    let st = state;
    if (!sw || isNaN(Number(sw)) || sw < 1 || sw > 4)
      return A.resolve(
        A.W(`call of setVal on ${this.host.name} with wrong argument 2: ${sw}`)
      );
    //        let nl = false;
    A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
    //        if (A.T(state) === 'object' && state.nightlight !== undefined)
    //            nl = !!state.nightlight;
    if (A.T(state) === "object" && state.state !== undefined)
      st = !!state.state;
    else if (typeof state === "boolean" || typeof state === "number")
      st = !!state;
    else
      return A.reject(
        `setVal on '${this.host.name}' to ${A.O(
          state
        )}: error wrong argument type!`
      );
    let sid_mask = 1 << (sw - 1);
    let packet = Buffer.alloc(16, 0);
    packet[0x00] = 0x0d;
    packet[0x02] = 0xa5;
    packet[0x03] = 0xa5;
    packet[0x04] = 0x5a;
    packet[0x05] = 0x5a;
    packet[0x06] = 0xb2 + (st ? sid_mask << 1 : sid_mask);
    packet[0x07] = 0xc0;
    packet[0x08] = 0x02;
    packet[0x0a] = 0x03;
    packet[0x0d] = sid_mask;
    packet[0x0e] = st ? sid_mask : 0;
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(ret, 0x22);
    if (!ret || ret.err || !ret.payload) return vret;
    return (vret["sw" + sw] = st);
  }
}

class SP1 extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "SP1";
    this._val = undefined;
  }
  async setVal(state) {
    let st = state;
    if (typeof state === "number" || typeof state === "boolean")
      state = {
        val: !!state,
      };
    if (typeof state === "object") st = !!state.state;
    var packet = Buffer.alloc(4, 4);
    packet[0] = st ? 1 : 0;
    const ret = await this.checkOff(this.sendPacket, 0x66, packet);
    this.checkError(ret, 0x22);
    // console.log("setVal SP1", ret);
    if (!ret || ret.err || !ret.payload) return this._val;
    return (this._val = st);
  }
}

class SP2 extends Device {
  // eslint-disable-next-line no-useless-constructor
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "SP2";
  }
  async getVal() {
    //"""Returns the power state of the smart plug."""
    const ret = this._val;
    if (A.T(ret) === "object") ret.here = false;
    var packet = Buffer.alloc(16, 0);
    //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
    packet[0] = 1;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let payload = res.payload;
      ret.here = true;
      ret.state = !!(payload[0x4] & 1);
      //                ret.nightlight = !!(payload[0x4] & 2);
    }
    return ret;
    // eslint-disable-next-line no-unused-vars
  }

  async setVal(state) {
    //"""Sets the power state of the smart plug."""
    const self = this;
    let st = state;
    //        let nl = false;
    A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
    //        if (A.T(state) === 'object' && state.nightlight !== undefined)
    //            nl = !!state.nightlight;
    if (A.T(state) === "object" && state.state !== undefined)
      st = !!state.state;
    else if (typeof state === "boolean" || typeof state === "number")
      st = !!state;
    else
      return A.reject(
        `setVal on '${this.host.name}' to ${A.O(
          state
        )}: error wrong argument type!`
      );
    let packet = Buffer.alloc(16, 0);
    packet[0] = 2;
    //        packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
    packet[4] = st ? 1 : 0;
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(ret, 0x22);
    // console.log("setVal SP2", ret);
    if (!ret || ret.err || !ret.payload) return self._val;
    return A.resolve((self._val.state = st));
  }
}

class SP3P extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = 'SP3P';
    this._val = {};
  }

  async setVal(state) {
    //"""Sets the power state of the smart plug."""
    const self = this;
    let st = state;
    let nl = false;
    A.I(`setVal on '${this.host.name}' to ${A.O(state)}`);
    if (A.T(state) === "object" && state.nightlight !== undefined)
      nl = !!state.nightlight;
    if (A.T(state) === "object" && state.state !== undefined)
      st = !!state.state;
    else if (typeof state === "boolean" || typeof state === "number")
      st = !!state;
    else
      return A.reject(
        `setVal on '${this.host.name}' to ${A.O(
          state
        )}: error wrong argument type!`
      );
    let packet = Buffer.alloc(16, 0);
    packet[0] = 2;
    packet[4] = (st ? 1 : 0) + (nl ? 2 : 0);
    const x = await this.getAll().catch(() => null);
    if (x) {
      self._val.energy = x.energy;
      self._val.nightlight = x.nightlight;
      self._val.state = x.state;
    }
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(ret, 0x22);
    // console.log("setVal SP3P", ret);
    if (!ret || ret.err || !ret.payload) return self._val;
    self._val.state = st;
    self._val.here = true;
    return self._val;
  }

  async getVal() {
    //"""Returns the power state of the smart plug."""
    const ret = this._val;
    if (A.T(ret) === "object") ret.here = false;
    var packet = Buffer.alloc(16, 0);
    //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
    packet[0] = 1;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let payload = res.payload;
      ret.here = true;
      ret.state = !!(payload[0x4] & 1);
      ret.nightlight = !!(payload[0x4] & 2);
    }
    return ret;
    // eslint-disable-next-line no-unused-vars
  }
  async getAll() {
    const self = this;
    const ret = this._val;
    //        A.I(`getAll on SP3P called! val = ${A.O(ret)}`);
    const val = await this.getVal();
    Object.assign(ret, val);
    const energy = await self.getEnergy();
    if (energy !== undefined && energy !== null) ret.energy = energy;
    self._val = ret;
    return ret;
  }

  async getEnergy() {
    //"""Returns the power state of the smart plug."""
    //        A.I(`calling get_energy on ${A.O(this.host)}`);
    const packet = Buffer.alloc(16, 0);
    packet[0] = 8;
    packet[2] = 254;
    packet[3] = 1;
    packet[4] = 5;
    packet[5] = 1;
    packet[9] = 45;
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(ret, 0x22);
    //            A.I(`payload get energy: ${A.O(ret)}`);
    if (ret && ret.payload && ret.payload[0] === 8)
      return (
        parseFloat(
          ret.payload[7].toString(16) +
            ret.payload[6].toString(16) +
            ret.payload[5].toString(16)
        ) / 100.0
      );
    return this._val && this._val.energy;
  }
}

class A1 extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "A1";
    this._val = {};
  }
  async getVal() {
    //        const self = this;
    const ret = this._val;
    ret.here = false;
    var packet = Buffer.alloc(16, 0);
    //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
    packet[0] = 1;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let payload = res.payload;
      ret.temperature = (payload[0x4] * 10 + payload[0x5]) / 10.0;
      ret.humidity = (payload[0x6] * 10 + payload[0x7]) / 10.0;
      ret.light = payload[0x8]; // "0:finster;1:dunkel;2:normal;3:hell"
      ret.air_quality = payload[0x0a]; // "0:sehr gut;1:gut;2:normal;3:schlecht"
      ret.noise = payload[0xc]; // "0:ruhig;1:normal;2:laut;3:sehr laut"
      ret.here = true;
    }
    return ret;
  }
}

class S1 extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "S1";
    this._val = {};
    this._sensorTypes = {
      0x31: "DoorSensor", // 49 as hex
      0x91: "KeyFob", // 145 as hex, as serial on fob corpse
      0x21: "MotionSensor", // 33 as hex
    };
  }
  async getVal() {
    function getSensor(pl, num) {
      const val = {};
      const buf = pl.slice(6 + num * 83, 5 + (num + 1) * 83);
      //            val.payload = buf;
      //            val.status = Number(buf[0]);
      //            val.order = Number(buf[1]);
      //            val.type = Number(buf[3]);
      let name = buf.slice(4, 26);
      let serial =
        buf[26] + buf[27] * 256 + buf[28] * 65536 + buf[29] * 16777216;
      while (!name[name.length - 1]) name = name.slice(0, [name.length - 1]);
      name = name.toString("utf8") + " " + serial.toString(16);
      name = name.replace(/\s+/g, "_");
      val[name] = Number(buf[0]);
      return val;
    }
    //        const self = this;
    const ret = this._val;
    ret.here = false;
    var packet = Buffer.alloc(16, 0);
    //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
    packet[0] = 6;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      //                A.If('S1 %s returned len &d %O', self.host.name, res.payload.length, res.payload);
      let number = Number(res.payload[0x4]);
      for (let i = 0; i < number; i++) {
        //                    Object.assign(ret,getSensor(res.payload,i));
        Object.assign(ret, getSensor(res.payload, i));
      }
    }
    return ret;
  }
}
class RM extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "RM";
    this._request_header = Buffer.from([]);
    this._code_sending_header = Buffer.from([]);
  }
  async _readSensor(type, offset, divider) {
    const ret = this._val;
    if (A.T(ret) === "object") ret.here = false;
    var packet = Buffer.concat([this._request_header, Buffer.from([type])]);
    //        A.I(`getVal on '${this.constructor.name}' called! on ${A.O(this.host)}`);
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    if (res && res.payload && !res.err) {
      const off = this._request_header.length + offset;
      const payload = res.payload;
      // A.I(`_readSensor '${this.constructor.name}':${type},${offset},${divider} returned ${A.O(res)}`);
      ret.here = true;
      // A.I(`Payload receifed ${payload.toString('hex')} on ${this}`);
      return payload[off] + payload[off + 1] / divider;
    } else return undefined;
  }
  async getVal() {
    const ret = this._val;
    const res = await this._readSensor(0x01, 4, 10.0);
    if (res !== undefined) ret.temperature = res;
    return ret;
  }

  async checkData() {
    var packet = Buffer.concat([this._request_header, Buffer.from([0x04])]);
    //        A.I(`send checkData on '${this.constructor.name}'`);
    const res = await this.checkOff(this.sendPacket, 0x6a, packet, -1000);
    //        this.checkError(res, 0x22);
    //             A.I(`checkData on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      let data = res.payload.slice(this._request_header.length + 4);
      A.If(
        "checkData command %s:%s, %s, %d",
        "04",
        this,
        data.toString("hex"),
        data.length
      );
      if (data && data.length <= 14) {
        let s = 0;
        for (let i = 0; i < data.length; i++) s += data[i];
        if (!s) return null;
      }
      return data;
    }
    return null;
  }

  async learn(msg) {
    const self = this;
    if (msg)
      msg(
        `Start learning with ${this.host.name}: Please press button on remote in next 30 seconds!`
      );
    this.learning = true;
    //        A.If('Should learn on %s', this.host.name);
    const res = {};
    // let first = true;
    // while (first && await self.checkData()) {
    //   await A.wait(50);
    //   first = false;
    // }
    await this.checkData().catch(() => null);
    await self.enterLearning();
    for (let i = 30; i > 0; i--) {
      await A.wait(1000);
      const r = await self.checkData();
      if (r) {
        const data = r.toString("hex");
        // A.I("Received from device: " + data);
        res.data = data;
        break;
      }
      if (msg) msg(`Please press button on remote in next ${i - 1} seconds!`);
    }
    if (msg)
      msg(
        res.data
          ? `Learning finished and packet received!`
          : `Timeout: No data received when learning!`
      );
    self.learning = false;
    return res;
  }

  async sendVal(data) {
    const self = this;
    const packet = Buffer.concat([
      this._code_sending_header,
      Buffer.from([0x02, 0x00, 0x00, 0x00]),
      data,
    ]);
    const ret = await self.checkOff(self.sendPacket, 0x6a, packet, -1000); //.then(x => A.I(`setVal/sendData for ${this.host.name} returned ${A.O(x)}`, x));
    return this.checkError(ret, 0x22);
  }

  async enterLearning() {
    A.If("enterLearning command %s:%s", "03", this);
    var packet = Buffer.concat([this._request_header, Buffer.from([0x03])]);
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet); //.then(x => A.I(`enterLearning for ${this.host.name} returned ${A.O(x)}`, x));
    return this.checkError(ret, 0x22);
  }
}

class RMP extends RM {
  // eslint-disable-next-line no-useless-constructor
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "RMP";
  }

  async enterRFSweep(start) {
    const command = start ? 0x19 : 0x1e;
    const packet = Buffer.concat([
      this._request_header,
      Buffer.from([command]),
    ]);
    A.If("enterRFSwwep command %s:%s", command.toString(16), this);
    // var packet = Buffer.alloc(16, 0);
    // packet[0] = start ? 0x19 : 0x1e;
    const ret = await this.checkOff(this.sendPacket, 0x6a, packet); //.then(x => A.I(`enterRFSweep for ${this.host.name} returned ${A.O(x)}`, x));
    return this.checkError(ret, 0x22);
  }

  async checkRFData(check2) {
    const command = check2 ? 0x1b : 0x1a;
    // check2=true = fund_rf_packet, false= check_frequency
    A.If("CheckRFData command %s:%s", command.toString(16), this);
    const packet = Buffer.concat([
      this._request_header,
      Buffer.from([command]),
    ]);
    // var packet = Buffer.alloc(16, 0);
    // packet[0] = check2 ? 0x1b : 0x1a;
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    this.checkError(res, 0x22);
    if (res && res.payload && !res.err) {
      if (res.payload[this._request_header.length + 4] === 1) return true;
    }
    return null;
  }

  async learnRf(msg) {
    // const self = this;
    if (msg)
      msg(
        `Start RF-sweep with ${this.host.name}: Please press button on RF remote until frequency found!`
      );
    //        A.Df('Start learning with %s on %s', rf, self.host.name);
    this.learning = true;
    const l = {};
    let f = false;
    await this.checkData().catch(() => null);
    await this.enterRFSweep(true);
    for (let i = 30; i > 0; i--) {
      await A.wait(1000);
      f = await this.checkRFData(false);
      //            const r = await self.checkData();
      if (f) break;
      if (msg)
        msg(`Continue to press button on RF remote for maximal ${i} seconds!`);
    }
    if (!f) {
      if (msg) msg(`Could not find frequency, will stop learning!`);
      await this.enterRFSweep(false);
      this.learning = false;
      return l;
    }
    if (msg) msg(`found Frequency 1 of 2, you can release button now!`);
    await A.wait(1000);
    if (msg)
      msg(`To complete learning single press button you want to lear now!`);
    await this.checkRFData(true);
    for (let i = 10; i > 0; i--) {
      await A.wait(1000);
      const data = await this.checkData();
      if (data) {
        l.data = data.toString("hex");
        break;
      }
      if (msg)
        msg(
          `Please single press button you want to learn in next ${
            i - 1
          } seconds!`
        );
    }
    if (msg)
      msg(
        l.data
          ? `Found learned button!`
          : `Could not learn button, will exit learning now!`
      );

    this.learning = false;
    // console.log(l);
    return l;
  }
}

class RM4 extends RM {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    this._cmdByte = 2;
    // this.type = "RM4";
    this._request_header = Buffer.from([0x04, 0x00]);
    this._code_sending_header = Buffer.from([0xd0, 0x00]);
  }
  async getVal() {
    const ret = this._val;
    const res = await this._readSensor(0x24, 4, 10.0);
    if (res !== undefined) ret.temperature = res;
    return ret;
  }
  async getHumidity() {
    const ret = this._val;
    const res = await this._readSensor(0x24, 6, 100.0);
    if (res !== undefined) ret.humidity = res;
    // delete ret.val;
    return ret;
  }
  async getAll() {
    const ret = await this.getVal();
    const h = await this.getHumidity();
    ret.humidity = h.humidity;
    return ret;
  }
}

class RM4P extends RMP {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "RM4P";
    this._request_header = Buffer.from([0x04, 0x00]);
    this._code_sending_header = Buffer.from([0xd0, 0x00]);
  }
  async getVal() {
    const ret = this._val;
    const res = await this._readSensor(0x24, 4, 10.0);
    if (res !== undefined) ret.temperature = res;
    return ret;
  }
  async getHumidity() {
    const ret = this._val;
    const res = await this._readSensor(0x24, 6, 100.0);
    if (res !== undefined) ret.humidity = res;
    // delete ret.val;
    return ret;
  }
  async getAll() {
    const ret = await this.getVal();
    const h = await this.getHumidity();
    ret.humidity = h.humidity;
    return ret;
  }
}

class T1 extends Device {
  // eslint-disable-next-line no-useless-constructor
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "T1";
  }
  // --- start of other test
  async sendT1packet(cmd, data) {
    function crc16(buffer) {
      var crc = 0xffff;
      var odd;

      for (var i = 0; i < buffer.length; i++) {
        crc = crc ^ buffer[i];

        for (var j = 0; j < 8; j++) {
          odd = crc & 0x0001;
          crc = crc >> 1;
          if (odd) {
            crc = crc ^ 0xa001;
          }
        }
      }
      return crc;
    }

    //        if (!data)
    //            data = Buffer.alloc(4, 0);
    //        else
    if (Array.isArray(data)) data = Buffer.from(data);
    //        A.If('sendT1packet: from id:%O key:%O = %O', this.id,this.key, data);
    const payload = Buffer.alloc(data.length + 4, 0);
    data.copy(payload, 2, 0);
    payload[0] = data.length + 2;

    let cc = crc16(data);
    payload[data.length + 2] = cc & 0xff;
    payload[data.length + 3] = (cc >> 8) & 0xff;
    //        A.If('sendT1packet: %O', payload);
    const res = await this.sendPacket(cmd, payload);
    // this.checkError(res, 0x22);
    //            A.If('sendT1packet got back from cmd %O',res);
    if (res && res.payload && !res.err) {
      //                let pl = res.payload;
      //                let size = pl[0];
      //                A.If('Got payload with size %n: %O', size, pl);
      return res.payload;
    }
    return null;
  }

  setTime(date) {
    if (!date) date = new Date();
    let dow = date.getDay();
    dow = dow ? dow : 7;
    return this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x10,
      0x00,
      0x08,
      0x00,
      0x02,
      0x04,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      dow,
    ]);
  }
  setMode(auto, loop, sensor) {
    auto = auto !== undefined ? auto : this._val.autoMode;
    loop = loop !== undefined ? loop : this._val.loopMode;
    sensor = sensor !== undefined ? sensor : this._val.sensor;
    let mode = loop * 16 + auto;
    sensor = sensor ? sensor : 0;
    A.Df(
      "setMode for %s = auto:%d loop:%d mode:%O, sensor:%O",
      this.name,
      auto,
      loop,
      mode,
      sensor
    );
    return this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x06,
      0x00,
      0x02,
      mode,
      sensor,
    ]);
  }

  /*   def set_temp(self, temp):
    self.send_request(bytearray([0x01,0x06,0x00,0x01,0x00,int(temp * 2)]) )
    */
  setTemp(temp) {
    A.Df("setTemp for %s = temp:%d", this.name, temp);
    return this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x06,
      0x00,
      0x01,
      0x00,
      parseInt(temp * 2.0),
    ]);
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
    A.Df("setPower for %s = power:%d remote:%d", this.name, power, remote);
    return this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x06,
      0x00,
      0x00,
      remote,
      power,
    ]);
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
    if (item && v && v[item] !== undefined) this._val[item] = val;
    A.Df("setAdvanced for %s = power:%d remote:%d", this.name, item, val);
    return this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x10,
      0x00,
      0x02,
      0x00,
      0x05,
      0x0a,
      v.loopMode,
      v.sensor,
      v.osv,
      v.dif,
      v.svh,
      v.svl,
      (parseInt(v.roomTempAdj * 2) >> 8) & 0xff,
      parseInt(v.roomTempAdj * 2) & 0xff,
      v.fre,
      v.poweron,
    ]);
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
    A.Df("Should set schedule item %s for %s to %O", id, val);
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

  async getAll() {
    const ret = this._val;
    ret.here = false;

    function getSched(x, start, end) {
      let r = [];
      let i = start;
      while (i < end) {
        r.push({
          startHour: Number(x[2 * i + 23]),
          startMinute: Number(x[2 * i + 24]),
          temp: Number(x[i + 39]) / 2.0,
        });
        ++i;
      }
      return r;
    }
    //        return this.sendT1packet(0xA0).then(x => {
    const x = await this.checkOff(this.sendT1packet, 0x6a, [
      0x01,
      0x03,
      0x00,
      0x00,
      0x00,
      0x16,
    ]);
    if (x) {
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
      if (ret.roomTempAdj > 32767) ret.roomTempAdj = 32767 - ret.roomTempAdj;
      ret.fre = Number(x[15]);
      ret.poweron = Number(x[16]);
      ret.unknown = Number(x[17]);
      ret.externalTemp = Number(x[18]) / 2.0;
      ret.time =
        Number(x[19]) +
        ":" +
        Number(x[20]) +
        ":" +
        Number(x[21]) +
        " @" +
        Number(x[22]);
      ret.poweron = Number(x[16]);
      ret.unknown = Number(x[17]);
      ret.weekday = getSched(x, 0, 6);
      ret.weekend = getSched(x, 6, 8);
    }
    return ret;
  }
}

class LB1 extends Device {
  constructor(host, mac, devtype, bl) {
    super(host, mac, devtype, bl);
    // this.type = "LB1";
    LB1.colorMode = {
      "lovely color": 0,
      flashlight: 1,
      lightning: 2,
      "color fading": 3,
      "color breathing": 4,
      "multicolor breathing": 5,
      "color jumping": 6,
      "multicolor jumping": 7,
    };
    LB1.colorModeArr = Object.keys(LB1.colorMode);
  }
  async _sendCommand(command, type = true /* set = true, query = false */) {
    // packet = bytearray(16+(int(len(command)/16) + 1)*16)
    const packet = Buffer.alloc(
      16 + (parseInt(command.length / 16) + 1) * 16,
      0
    );
    packet[0x02] = 0xa5;
    packet[0x03] = 0xa5;
    packet[0x04] = 0x5a;
    packet[0x05] = 0x5a;
    packet[0x08] = type ? 0x02 : 0x01; // # 0x01 => query, # 0x02 => set
    packet[0x09] = 0x0b;
    packet[0x0a] = command.length;
    for (let c = 0; c < command.length; c++)
      packet[0x0e + c] = command[c].charCodeAt(0);
    let checksum = 0xbeaf;
    for (let i = 0; i < packet.length; i++) {
      checksum += packet[i];
      checksum = checksum & 0xffff;
    }

    packet[0x00] = (0x0c + command.length) & 0xff;
    packet[0x06] = checksum & 0xff; // # Checksum 1 position
    packet[0x07] = checksum >> 8; // # Checksum 2 position
    // A.I(`Send Command: ${packet.toString('hex')}`);
    const res = await this.checkOff(this.sendPacket, 0x6a, packet);
    const ret = {
      payload: res,
    };
    const e = this.checkError(ret, 0x36);
    if (e && res) res.err = e;
    return res;
  }

  retVal(res) {
    let ret = this._val;
    let payload = res.payload;
    const len = payload[0xa] + payload[0xb] * 256;
    if (len > 0) payload = payload.slice(0xe, len + 0xe);
    else payload = "";
    payload = payload.toString();
    try {
      payload = JSON.parse(payload);
      ret.here = true;
      ret = Object.assign(ret, payload);
      ret.bulb_colormode = LB1.colorModeArr[ret.bulb_colormode];
      ret.bulb_scenes = JSON.parse(ret.bulb_scenes);
      ret.pwr = !!ret.pwr;
    } catch (e) {
      ret.here = false;
    }
    // console.log(ret);
    return ret;
  }

  async getVal() {
    //"""Returns the power state of the smart plug."""
    let ret = this._val;
    if (A.T(ret) === "object") ret.here = false;
    const res = await this._sendCommand("{}", false);
    //            A.I(`getVal on '${this.constructor.name}' returned ${A.O(res)}`);
    if (res && res.payload && !res.err) {
      //                ret.nightlight = !!(payload[0x4] & 2);
      this.retVal(res);
    }
    return ret;
    // eslint-disable-next-line no-unused-vars
  }

  getAll() {
    return this.getVal();
  }
  async setItem(item, value) {
    switch (item) {
      case "pwr":
        value = !value ? 0 : 1;
        break;
      // default:
      //     value = value.toString();
    }
    const cmd = JSON.stringify({
      [item]: value,
    });
    // A.I(`About to send to LB1: ${cmd}`);
    const res = await this._sendCommand(cmd, true);
    if (res && !res.err && res.payload) {
      this.retVal(res);
      // A.I(`SendCmdRes was ${A.O(res)}: ${""+res.payload}`);
      return res;
    }
    // A.W(`Error when sending to LB-Device! ${res}`);
    return null;
  }
}

class IP {
  constructor(ip) {
    if (typeof ip === "object") Object.assign(this, ip);
    else if (typeof ip === "string") {
      if (!this.cidrToAll(ip)) this.address = ip;
    }
    if (!this.addrToArr()) this.address = undefined;
    return this;
  }

  toString() {
    return this.cidr;
  }

  _addrToArr(address) {
    address = address || this.address;
    const spl = address.split(".").map((i) => parseInt(i.trim()));
    if (spl.filter((i) => isNaN(i)).length) return undefined;
    if (spl.length != 4) return undefined;
    this.addrs = spl;
    return spl;
  }

  addrToArr(address) {
    const spl = this._addrToArr(address);
    if (spl) this.addrs = spl;
    return spl;
  }

  broadcast(address) {
    address = address || this.address;
    const arr = [...this._addrToArr(address)];
    if (!arr || !this.netmaskBits) return undefined;
    const b = 31 - this.netmaskBits;
    for (let i = 0; i <= b; i++) {
      const ai = 3 - parseInt(i / 8);
      const ii = i % 8;
      arr[ai] |= 1 << ii;
    }
    return arr.join(".");
  }

  cidrToAll(cidr) {
    cidr = cidr || this.cidr;
    const spl = cidr.split("/").map((i) => i.trim());
    if (spl.length != 2) return undefined;
    this.netmaskBits = parseInt(spl[1]);
    if (!this.address) this.address = spl[0];
    if (this.addrToArr())
      this.cidr = this.addrs.join(".") + "/" + this.netmaskBits;
    this.bcaddr = this.broadcast();
  }
}
class Broadlink extends EventEmitter {
  constructor(add, aif) {
    super();
    this._interface = aif;
    this._devices = {};
    this._cs = null;
    this._ls = null;
    this._ipif = [];
    this._devlist = {
      SP1: {
        0x0000: "SP1",
        // name: "sp1",
        class: SP1,
      },
      SP2: {
        class: SP2,
        // name: "sp2",
        range: [
          {
            min: 0x7530,
            max: 0x7918,
            name: "OEM branded SPMini2",
          },
        ],
        0x2711: "SP2",
        0x2719: "SP2?",
        0x7919: "SP2?",
        0x271a: "SP2?",
        0x791a: "Honeywell SP2",
        0x2720: "SPMini",
        0x753e: "SP3",
        0x2728: "SPMini2",
        0x2733: "SPmini2?",
        0x273e: "OEM branded SPMini",
        0x2736: "SPMiniPlus",
      },
      SP3P: {
        class: SP3P,
        // name: "sp3p",
        0x947a: "SP3SPower",
      },
      T1: {
        class: T1,
        // name: "t1",
        0x4ead: "T1 Floureon",
      },
      RM: {
        class: RM,
        // name: "rm",
        0x2712: "RM2",
        0x2737: "RM Mini",
        0x273d: "RM Pro Phicomm",
        0x2783: "RM2 Home Plus",
        0x277c: "RM2 Home Plus GDT",
        0x278f: "RM Mini Shate",
        0x2797: "RM Pro (OEM)",
        0x27c2: "RM Mini 3",
      },
      RMP: {
        class: RMP,
        // name: "rmp",
        0x272a: "RM2 Pro Plus",
        0x2787: "RM2 Pro Plus2",
        0x278b: "RM2 Pro Plus BL",
        0x279d: "RM3 Pro Plus",
        0x27a9: "RM3 Pro Plus", // addition for new RM3 mini
      },
      RM4: {
        class: RM4,
        // name: "rm4",
        0x51da: "RM4 Mini",
        0x5f36: "RM Mini 3",
        0x610e: "RM4 Mini",
        0x610f: "RM4c",
        0x62bc: "RM4 Mini",
        0x62be: "RM4c",
      },
      RM4P: {
        class: RM4P,
        // name: "rm4p",
        0x61a2: "RM4 Pro",
        0x6026: "RM4 Pro",
      },
      A1: {
        class: A1,
        // name: "a1",
        0x2714: "A1",
      },
      MP1: {
        class: MP1,
        // name: "mp1",
        0x4eb5: "MP1",
      },
      LB1: {
        class: LB1,
        // name: "lb1",
        0x60c7: "SmartBulb LB1",
        0x60c8: "SmartBulb LB1",
      },
      S1: {
        class: S1,
        // name: "s1",
        0x2722: "S1",
      },
    };

    this.getInterfaces();
    A.If(
      "interface to be used: %O:",
      this._ipif.map((i) => i.toString())
    );
    if (!add) return;
    for (let k of add) {
      if (Array.isArray(k) && k.length === 2) {
        let cl = k[1].toUpperCase();
        let dt = Number(k[0]);
        for (const c of Object.keys(this._devlist))
          if (this._devlist[c][dt]) delete this._devlist[c][dt];
        if (this._devlist[cl]) this._devlist[cl][dt] = cl.toLowerCase();
      }
    }
  }

  static toHex(n, len) {
    len = Math.abs(len) || 2;
    let st = "0".repeat(len);
    st = n < 0 ? "-0x" + st : "0x" + st;
    let s = n.toString(16);
    return st.slice(0, -s.length) + s;
  }

  get list() {
    return this._devices;
  }

  getInterfaces() {
    let interfaces = os.networkInterfaces(),
      address;
    this._ipif = [];
    for (let k in interfaces) {
      if (interfaces.hasOwnProperty(k)) {
        for (let k2 in interfaces[k]) {
          if (interfaces[k].hasOwnProperty(k2)) {
            address = interfaces[k][k2];
            if (address.family === "IPv4" && !address.internal) {
              const ipif = new IP(address.cidr);
              // delete ipif.family;
              // delete ipif.internal;
              // A.If("interface to be used: %s:", ipif);
              this._ipif.push(ipif);
            }
          }
        }
      }
    }
    //        this.address = addresses[0].split('.');
    //      this.lastaddr = addresses[addresses.length-1];
    this._afound = this._ipif.map((i) => i.address);
    this._addresses = this._ipif.map((i) => i.bcaddr);
    this._addresses.push("255.255.255.255");
    this._addresses.push("224.0.0.251");
    return this._ipif;
  }

  addressOnInterface(address) {
    for (const ip of this._ipif) {
      const res = ip.broadcast(address);
      // A.If(`CHeck ${address}=${res} on ${ip.bcaddr}`);
      if (res == ip.bcaddr) return true;
    }
    return false;
  }

  async start15001() {
    const self = this;
    if (this._ls) await this._ls.renew();
    else {
      this._ls = new Udp(15001);
      this._ls.on("message", function (message, rinfo) {
        let host = self.parsePublic(message, rinfo);
        //            A.Df(`15001 Message from: %O`, host);
        //            self.emit("15001", host);
        if (!self._devices[host.mac] || self._devices[host.mac].dummy)
          self.discover(host);
      });
      await Promise.resolve(this._ls._ready);
    }
    return true;
  }

  parsePublic(msg, rinfo) {
    const self = this;
    function genDevice(devtype, host, mac) {
      //        A.Df('got device type %s @host:%O', devtype.toString(16), host);
      host.devtype = devtype;
      // eslint-disable-next-line no-console
      // console.log("Found", devtype, host, mac);
      host.type = "unknown";
      host.name = "unknown_" + devtype.toString(16) + "_" + host.mac;
      let dev = null;
      for (let c of Object.entries(self._devlist)) {
        const [cl, typ] = c;
        if (
          typ[devtype] ||
          (typ.range &&
            typ.range.find((i) => devtype >= i.min && devtype <= i.max))
        ) {
          dev = new typ.class(host, mac, devtype, self);
          host.type = dev.type;
          host.devname = typ[devtype]
            ? typ[devtype]
            : typ.range.find((i) => devtype >= i.min && devtype <= i.max).name;
          return dev;
        }
      }
      host.devname = "UKN";
      //        A.If('Unknown...%O, %s, %s',host, mac, devtype);
      return new Device(host, mac, devtype, self);
    }
    const host = Object.assign({}, rinfo);
    let mac = Buffer.alloc(6, 0);
    //                    self._cs.setMulticastInterface(this.lastaddr);
    // delete host.family;
    delete host.size;
    //        host.command = Number(msg[0x26]) + Number(msg[0x27]) * 256;
    if (msg.length >= 0x40) {
      //            mac = msg[0x3a:0x40];
      msg.copy(mac, 0, 0x3a, 0x40);
      host.devtype = Number(msg[0x34]) + Number(msg[0x35]) * 256;
      host.oname = msg.subarray(0x40);
      host.oname = host.oname.subarray(0, host.oname.indexOf(0)).toString();
      host.cloud = parseInt(msg.subarray(-1)[0]);
    } else {
      msg.copy(mac, 0, 0x2a, 0x30);
    }

    host.maco = mac;
    // A.I(`Found host ${A.O(host)}`);
    mac = Array.prototype.map
      .call(new Uint8Array(mac), (x) => x.toString(16))
      .reverse();
    host.mac = mac = mac.map((x) => (x.length < 2 ? "0" + x : x)).join(":");
    // A.If("parsePublic %O, %O", Object.keys(self._devices), host);
    //        A.Df('parsePublic found %O with %O',host,msg);
    //            console.log(mac);
    if ((!self._devices[mac] || self._devices[mac].dummy) && host.devtype) {
      //            A.If('new device found: host=%O',host);
      var dev = genDevice(host.devtype, host, mac);
      self._devices[mac] = dev;
      dev.once("deviceReady", async function () {
        await A.wait(10);
        await dev.get_firmware();
        let x = await A.c2p(dns.reverse)(dev.host.address).catch(
          () => dev.host.name
        );

        if (Array.isArray(x)) {
          dev.host.names = x.map((i) => i.split(".")[0]);
          x = x.slice(-1)[0].split(".")[0];
        } else dev.host.names = [x];
        // A.I(`Got the following for ${dev.host.address}: ${A.O(x)}`);
        x = Array.isArray(x)
          ? x[0].toString().trim().split(".")[0]
          : x.toString().trim();
        dev.host.name = dev.host.type.slice(0, 2).toUpperCase() + ":" + x;
        dev.name = dev.host.name;
        self._devices[dev.name] = dev;
        self.emit("deviceReady", dev);
      });
      A.retry(3, dev.auth.bind(dev), 100).catch((err) => {
        A.W(`Failed to authenticate device ${dev} with err ${err}`);
        if (dev.host.cloud)
          A.Wf(
            "Warning: Device discovered which operates in cloud mode and could not be authenticated!\nDelete device from mobile app, reset device and bring it into WiFi network again but do not assign it any name, room or function, close app immediately!\nDevice: %O",
            dev.host
          );
      });
    }
    return host;
  }

  getDev(name) {
    return this._devices && this._devices[name.trim()];
  }

  async discover(what, ms) {
    const self = this;
    ms = ms || 5000;

    if (self._cs) await self._cs.close();

    let address = "0.0.0.0";
    this.getInterfaces();
    //  address = typeof what == "object" && what.address ? what.address : address;
    if (this._interface && this.addressOnInterface(this._interface))
      address = this._interface;

    // else if (self._afound.length == 1) address = self._afound[0];
    self._cs = new Udp(
      0,
      this._afound.indexOf(address) >= 0 ? address : undefined
    );
    self._cs.on("message", (m, r) => self.parsePublic(m, r));
    await Promise.resolve(self._cs._ready);
    self._cs.socket.setMulticastTTL(20);
    let { port } = self._cs;
    address = address.split(".").map((i) => parseInt(i));
    const now = new Date();
    //		var starttime = now.getTime();
    let timezone = now.getTimezoneOffset() / -60;
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
    packet[0x18] = address[0];
    packet[0x19] = address[1];
    packet[0x1a] = address[2];
    packet[0x1b] = address[3];
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

    const addr = what && what.address ? [what.address] : this._addresses;

    A.If("discover  %O from %s:%s", addr, address.join("."), port);

    if (addr.length > 1) this._cs.socket.setBroadcast(true);

    for (let i = 0; i < 5; i++) {
      for (const a of addr) {
        // A.I(`Send packet ${packet.slice(8,0x28).toString('hex')} to ${a}:80 from ${address.join(".")}:${port}`);
        await self._cs.send(packet, 80, a);
        await A.wait(50);
      }
      await A.wait(50);
    }
    let n = 5 * addr.length * 50 + 50;
    if (n > ms) n = ms;
    return A.wait(ms - n);
    //        return true;
  }
  /* 
  getAll(mac) {
    if (!this._devices[mac])
      return A.resolve({
        here: false,
      });
    return this._devices[mac].getAll();
  }

  valMac(mac) {
    if (!this._devices[mac])
      return A.resolve({
        here: false,
      });
    return this._devices[mac].val;
  }
 */
  close() {
    if (this._ls) this._ls.close();

    if (this._cs) this._cs.close();

    if (A.ownKeys(this._devices).length > 0)
      for (let m of A.ownKeys(this._devices)) {
        //                console.log(m);
        let dev = this._devices[m];
        if (dev) dev.close();
      }
    this._ls = this._cs = this._devices = null;
  }
}

if (Buffer.alloc === undefined) {
  Buffer.alloc = function (size /* , fill */) {
    var buf = new Buffer(size);
    for (var i = 0; i < size; i++) buf[i] = 0;
    return buf;
  };
}

module.exports = Broadlink;
