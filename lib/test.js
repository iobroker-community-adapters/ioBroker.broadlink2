"use strict";

// const net = require('net');
// const dns = require('dns');

const A = require('@frankjoke/myadapter').MyAdapter,
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


const bl = new Broadlink( /* [[0x27145, 'A1']] */ );

A.debug = true;

let devs = [];
//let testdev = null;

bl.on("deviceReady", function (device) {
    if (device && device.host.name.endsWith('.fritz.box'))
        device.host.name = device.host.name.slice(0, -10);
    let h = device.host;
    A.If('found device #%d:%s %s/%s =%s,%s, %O, %O', devs.length, h.name, h.address, h.mac, h.devhex, h.type, device.id, device.key);
    //    if (device.host.mac === '7a:94:c0:a8:b2:79')
    //        testdev = device;
    devs.push(device);
});

async function wait(x, arg) {
    await A.wait(x ? x : 2000);
    return arg;
}

bl.on('15001', (m, r) => A.If('Got 15001 with m:%O and r:%O', m, r));

const t = new A.Hrtime();


function pE(x,y) {
    y = y ? y : pE;
    function get() {
		var oldLimit = Error.stackTraceLimit;
		Error.stackTraceLimit = Infinity;
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error('Test');
        Error.captureStackTrace(err, y);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
		Error.stackTraceLimit = oldLimit;
        return stack.map(site => site.getFileName() ? (site.getFunctionName() || 'anonymous') + ' in ' + site.getFileName() +' @'+site.getLineNumber()+':'+site.getColumnNumber() : '');
    }

    A.If('Promise failed @ %O error: %o', get().join('; '), x);
    return x;
}

main().catch(pE).catch(e => A.Wf('main error was %O', e, bl.close()));

async function main() {
    await bl.start15001();
    A.If('staring main after start 15001: %s', t.text);
    await wait(100);
    await Promise.reject().catch(pE).catch(A.nop);
    A.If('Start Discover:%s', t.text);
    //    await bl.discover('192.168.0.187');
//    await bl.discover('192.168.0.255');
    await bl.discover();
    A.If('after Discover, get all values, %s', t.text);
    await A.seriesOf(devs, dev => dev.getAll ? dev.getAll().then(res => A.Ir(res, '%s returned %O', dev.host.name, res), A.nop) : A.resolve(), 10).catch(e => A.Wf('catch error getAll %O', e));
    let {
        temperature
    } = bl.getDev('A1:EAIR1') ? await bl.getDev('A1:EAIR1').getAll() : {
        temperature: 'N/A'
    };
    A.If('after GetAll temperature from A1: %f', temperature);
    await wait(100);
    let sw = bl.list['2a:27:66:b2:a8:c0'];
    if (sw) {
        A.If('before learn: %s', t.text);
        sw.learn(true).then(result => A.If('Learned: %O', result), e => A.Wf('catch error learn %O', e));
    }
    sw = bl.list['47:75:c0:a8:0:1e'];
    sw = bl.getDev('SP:Gibssi1');
    if (sw) {
        A.I('Found ' + sw.host.name);
        let state = false;
        setInterval(() => {
            sw.setVal(state = !state).then(() => A.wait(2000)).then(() => sw.setVal(state = !state), e => A.Wf('catch error setval %O', e));
        }, 10000);
    }
    await wait(100);
    //    bl.close();
}