"use strict";

// const net = require('net');
// const dns = require('dns');

const A = require('../myAdapter').MyAdapter,
    Broadlink = require('../broadlink_fj');


    const readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
        process.exit();
    } else {
        A.If(`You pressed the "${str}" key:%O`, key);
        if (key.name === 'q')
            bl.close();
            process.exit();

    }
});


const bl = new Broadlink([['A1',0x27145]]);

A.debug = true;

let devs = [];
//let testdev = null;

bl.on("deviceReady", function (device) {
    if (device && device.host.name.endsWith('.fritz.box'))
        device.host.name = device.host.name.slice(0, -10);
    let h = device.host;
    A.If('found device #%d:%s %s/%s =%s,%s', devs.length, h.name, h.address, h.mac, h.devhex, h.type);
    //    if (device.host.mac === '7a:94:c0:a8:b2:79')
    //        testdev = device;
    devs.push(device);
});

async function wait(x, arg) {
    await A.wait(x ? x : 2000);
    return arg;
}

const t = new A.Hrtime();

main().catch(e => A.Wf('main error was %O', e, bl.close()));

async function main() {
    await bl.start15001();
    A.If('staring main after start 15001: %s',t.text);
    await wait(100);
    A.If('Start Discover:%s',t.text);
    await bl.discover('192.168.178.50');
    A.If('after Discover, get all values, %s',t.text);
    await A.seriesOf(devs, dev => dev.getAll ? dev.getAll().then(res => A.Ir(res, '%s returned %O', dev.host.name, res),A.nop) : A.resolve(), 10).catch(e => A.Wf('catch error getAll %O',e));
    let {
        temperature
    } = bl.list['14:27:68:b2:a8:c0'] ? await bl.list['14:27:68:b2:a8:c0'].getAll() : null;
    A.If('after GetAll temperature from A1: %f', temperature);
    await wait(100);
    let sw = bl.list['2a:27:66:b2:a8:c0'];
    if (sw) {
        A.If('before learn: %s',t.text);
        sw.learn().then(result => A.If('Learned: %O',result),e => A.Wf('catch error learn %O',e));
    }
    sw = bl.list['47:75:c0:a8:0:1e'];
    if (sw) {
        A.I('Found SM2');
        let state = sw.val.state;
        setInterval(() => {
            sw.setVal(state = !state).then(() => A.wait(2000)).then(() => sw.setVal(state = !state), e => A.Wf('catch error setval %O',e));
        },20000);
    }
    await wait(100);
//    bl.close();
}