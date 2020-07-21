import Vue from "vue";
import store from "./store";
import SocketIO from "socket.io-client";
import VueSocketIO from "vue-socket.io";

const devMode = process.env.NODE_ENV !== "production";
var path = location.pathname;
// console.log(path);
var parts = path.split("/");
parts.splice(-3);

if (path.match(/^\/admin\//)) parts = [];
const server = devMode ? "ws://" + process.env.VUE_APP_IOBROKER : "/";
const options = {
  path: parts.join("/") + "/socket.io" /* , autoConnect: false  */,
}; //Options object to pass into SocketIO

//console.log(server, parts, options);
//const server = "ws://localhost:8181/";
//const server = "ws://buster10.fritz.box:8081/";
//const server = "/";
const socket = SocketIO(server, options);

const socketIo = new VueSocketIO({
  // debug: devMode,
  connection: socket, //options object is Optional
  vuex: {
    store,
    actionPrefix: "SOCKET_",
  },
});

Vue.prototype.$socketEmit = async function socketEmit(event, ...data) {
  let timeout = 5000;
  if (typeof event == "object") {
    timeout = Number(event.timeout || 1000);
    event = event.event || "pong";
  }
  return new Promise((res, rej) => {
    let tout = setTimeout(
      () => rej(new Error(`socketEmit - timeout for ${event}: ${data}`)),
      timeout
    );
    // debugger;
    // console.log("emit:", socket, event, ...data);
    socket.emit(event, ...data, (err, result) => {
      //           console.log(`emit ${event} returned:`, err, result);
      if (tout) clearTimeout(tout);
      if (err) rej(err);
      else res(result);
    });
  });
};

Vue.prototype.$socketSendTo = async function socketSendTo(event, ...data) {
  let timeout = 5000;
  if (typeof event == "object") {
    timeout = Number(event.timeout || 5000);
    event = event.event || "pong";
  }
  // console.log("SendTo:", event, ...data);
  return new Promise((res, rej) => {
    let tout = setTimeout(
      () => rej(new Error(`socketSendTo - timeout for ${event}: ${data}`)),
      timeout
    );
    //          console.log("socketSendTo:", event, ...data);
    socket.emit(event, ...data, (result) => {
      if (tout) clearTimeout(tout);
      // console.log("SocketSendTo:", result);
      //            console.log(`socketSendTo ${event} returned:`, result);
      res(result);
    });
  });
};

export default socketIo;
