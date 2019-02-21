"use strict";

// const net = require('net');
// const dns = require('dns');

const A = require('../myAdapter').MyAdapter,
    Broadlink = require('../broadlink_fj');

const currentDevice = new Broadlink();

A.debug = true;

let devs = [];
let testdev = null;

currentDevice.on("deviceReady", function (device) {
    if (device && device.host.name.endsWith('.fritz.box'))
        device.host.name = device.host.name.slice(0, -10);
    A.I('found device #' + devs.length + ':' + A.O(device.host, 2));
    if (device.host.mac === '7a:94:c0:a8:b2:79')
        testdev = device;
    devs.push(device);
});



    A.I('Start Discover');

    A.wait(100)
//        .then(() => t1s.auth(1000))
//        .then(() => A.wait(10))
//        .then(() => t1s.write(Buffer.from([0xa0, 1, 1, 1, 1, 1, 0, 0])))
//        .then(() => A.wait(10000))
//        .then(() => t1s.close())
    .then(() => currentDevice.discover())
        .then(() => A.I('after discover'))
        .then(() => A.seriesOf(devs, dev => dev.getAll ? dev.getAll().then(res => A.I(`${dev.host.name} returned ${A.O(res)}`)) : A.resolve(), 10))
        .then(() => {
            if (testdev) {
                //            testdev.on('payload', (err, payload) => {
                //                A.I(A.F('got payload: ' + Broadlink.toHex(err,4), payload));
                //            });
                A.I(`testdev: ${testdev.constructor.name}`);
                return testdev.getAll()
                    .then(res => A.I(`getAll returned ${A.O(res)}`))
                    .then(() => testdev.setVal(!testdev.val.val))
                    .then(() => A.wait(2000))
                    .then(() => testdev.getAll())
                    .then(res => A.I(`getAll returned ${A.O(res)}`))
                    .then(() => testdev.setVal(!testdev.val.val))
                    .catch(e => A.W(`getAll returned error ${e}`));
            }
            return true;
        })
        .then(() => A.wait(5000), e => A.W(`test got error ${e}`))
        .then(() => A.I('Waited another 20 secs and close connections now.'))
        .then(() => currentDevice.close())
        .catch(e => A.W(`test got error ${e}`))
        .then(() => A.I('close app now. if it is not closing some connections are open!'));