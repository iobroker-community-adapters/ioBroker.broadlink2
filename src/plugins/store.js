import Vue from "vue";
import Vuex, { Store } from "vuex";
import { states, objects } from "../../fjadapter";

Vue.use(Vuex);

const devMode = process.env.NODE_ENV !== "production";
const inst = window.location.search.slice(1) || "0";
let aname = window.location.pathname.split("/");
aname = aname[aname.length - 2] || process.env.VUE_APP_ADAPTERNAME;
// if (aname === "" && process.env.VUE_APP_ADAPTERNAME)
// aname = process.env.VUE_APP_ADAPTERNAME;
// console.log("env", process.env);
// console.log("search", window.location.search);
// console.log("pathname", window.location.pathname);
// console.log("istab", !window.location.search);

const mylang = (navigator.language || navigator.userLanguage).slice(0, 2);

export default new Vuex.Store({
  state: {
    iobrokerConfigOrig: "",
    iobrokerHost: "",
    iobrokerHostConnection: {},
    iobrokerLang: mylang || "en",
    iobrokerInstance: inst,
    iobrokerConfigFile: {},
    iobrokerConfig: {}, //iopackage.native,
    ioBrokerSystemConfig: null,
    iobrokerAdapter: aname, // iopackage.common.name,
    ioBrokerIsTab: !window.location.search,
    iobrokerPackage: {}, // packagej,
    iobrokerIoPackage: {}, //iopackage,
    iobrokerAdapterNative: {},
    iobrokerAdapterCommon: {}, // iopackage.common,
    ioBrokerCerts: [],
    configTranslated: [],
    socketConnected: false,
    iobrokerReadme: "",
    adapterIcon: "",
    adapterDebugLevel: "debug",
    adapterLog: [],
    adapterStateUpdate: [],
    adapterStates: {},
    adapterLastState: {},
    adapterLastObject: {},
    interfaces: ["0.0.0.0"],
    socketConnected: false,
    adapterObjects: {},
    adapterStatus: 0,
    // broadlinkConfig: {},
    // broadlinkConfigCompare: "",
    devMode,
    sstate: {},
    icons: {},
    instances: [],
    // mstate: {},
  },
  mutations: {
    iobrokerAdapterNative(state, value) {
      state.iobrokerAdapterNative = value;
    },
    adapterObjects(state, value) {
      state.adapterObjects = value;
    },
    adapterLog(state, value) {
      if (state.adapterLog.length >= 100) state.adapterLog.pop();
      state.adapterLog.unshift(value);
    },

    adapterDebugLevel(state, value) {
      state.adapterDebugLevel = value;
    },

    adapterLastObject(state, value) {
      state.adapterLastObject = value;
    },

    adapterStates(state, payload) {
      const [id, obj] = payload;
      state.adapterLastState = payload;
      if (!obj) delete state.adapterStates[id];
      else state.adapterStates[id] = obj;
    },

    addSState(state, value) {
      const [id, obj] = value;
      if (!obj) {
        // delete state!
        console.log("Please code delete state!");
        return;
      }
      const an = obj._id.split(".")[2];
      const ids = id.split(".");
      // if (obj.common && obj.common.icon)
      //   state.icons[id] =
      //     "/adapter/" + id.split(".")[2] + "/" + obj.common.icon;
      if (an && obj.type == "adapter")
        state.icons[an] = "/adapter/" + an + "/" + obj.common.icon;
      if (obj.type === "instance") state.instances.push(ids.slice(2).join("."));

      if (obj.type === "state" && !id.startsWith("system.adapter.")) {
        const n = obj && obj.common && obj.common.name;
        const st = state.sstate;
        if (!n) return;
        //                    var i = {id: id, icon: main.icons['system.adapter.'+split]};
        const stn = st[n];
        if (!stn) st[n] = id;
        else if (Array.isArray(stn)) {
          if (stn.indexOf(id) < 0) stn.push(id);
        } else if (stn !== id) st[n] = [stn, id];
        if (!state.sstate[id]) state.sstate[id] = id;
      }
    },

    interfaces(state, value) {
      state.interfaces = value;
    },

    adapterStateUpdate(state, value) {
      state.adapterStateUpdate = value;
    },

    adapterStatus(state) {
      const sai =
        "system.adapter." +
        state.iobrokerAdapter +
        "." +
        state.iobrokerInstance;
      let alive = state.adapterStates[sai + ".alive"];
      alive = alive && alive.val;
      let connected = state.adapterStates[sai + ".connected"];
      connected = connected && connected.val;
      state.adapterStatus = alive ? (connected ? 2 : 1) : 0;
      return state.adapterStatus;
    },
    // broadlinkConfig(state, value) {
    //   state.broadlinkConfig = value;
    //   state.broadlinkConfigCompare = JSON.stringify(value);
    // },
    iobrokerHost(state, value) {
      state.iobrokerHost = value;
    },
    iobrokerHostConnection(state, value) {
      state.iobrokerHostConnection = value;
    },
    iobrokerLang(state, value) {
      state.iobrokerLang = value;
    },
    iobrokerInstance(state, value) {
      state.iobrokerInstance = value;
    },
    iobrokerConfigFile(state, value) {
      state.iobrokerConfigFile = value;
      state.adapterIcon = value.icon;
    },
    iobrokerConfig(state, value) {
      state.iobrokerConfig = value;
      state.iobrokerConfigOrig = JSON.stringify(value);
    },
    ioBrokerSystemConfig(state, value) {
      state.ioBrokerSystemConfig = value;
    },
    iobrokerAdapter(state, value) {
      state.iobrokerAdapter = value;
    },
    iobrokerPackage(state, value) {
      state.iobrokerPackage = value;
    },
    iobrokerIoPackage(state, value) {
      state.iobrokerIoPackage = value;
    },
    iobrokerAdapterCommon(state, value) {
      state.iobrokerAdapterCommon = value;
    },
    ioBrokerCerts(state, value) {
      state.ioBrokerCerts = value;
    },
    configTranslated(state, value) {
      state.configTranslated = value;
    },
    socketConnected(state, value) {
      state.socketConnected = value;
    },
    iobrokerReadme(state, value) {
      state.iobrokerReadme = value;
    },
  },
  getters: {
    adapterInstance: (state) => {
      return state.iobrokerAdapter + "." + state.iobrokerInstance;
    },
    adapterLastState: (state) => {
      return state.adapterLastState;
    },
  },
  actions: {
    wait(_, time) {
      time = time || 10;
      return new Promise((res) => setTimeout(() => res(), time));
    },

    async SOCKET_connect({ commit, dispatch }) {
      console.log("store socket_connected");
      commit("socketConnected", true);
      await dispatch("wait");
      commit("iobrokerHostConnection", this._vm.$socket.io.opts);
      await dispatch("wait");
      // await dispatch("wait");
      await dispatch("loadAdapterObjects");
      await dispatch("wait");
      dispatch("loadInterfaces");
    },

    SOCKET_disconnect({ commit }) {
      console.log("store socket_disconnected");
      commit("socketConnected", false);
      // this.$socket.open();
    },

    SOCKET_reconnect({ commit }) {
      console.log("store socket_reconnected");
      commit("socketConnected", true);
    },

    SOCKET_log({ commit, getters }, message) {
      if (message.from != getters.adapterInstance) return;
      // console.log("store adapter log:", message);
      commit("adapterLog", message);
    },

    SOCKET_stateChange({ commit, state, getters }, message) {
      const [id, obj] = message;
      const instance = getters.adapterInstance + ".";
      if (
        !id.startsWith(getters.adapterInstance) &&
        !id.startsWith("system.adapter." + getters.adapterInstance)
        // id.indexOf(instance) < 0
      )
        return;
      if (id == "system.adapter." + instance + "logLevel")
        commit("adapterDebugLevel", message.val);
      // state.adapterStates[id] = obj;
      if (!id.startsWith("system.")) {
        // console.log("store stateChange of", id, " with ", obj.val);
        // console.log("store adapter log:", message);
        commit("adapterStateUpdate", message);
      }
      commit("adapterStates", message);
      if (id.startsWith("system.adapter." + getters.adapterInstance))
        commit("adapterStatus");
    },

    SOCKET_onUpdate({ commit, state, getters }, message) {
      const [id, obj] = message;
      if (id.indexOf(getters.adapterInstance + ".") < 0) return;
      console.log("store onUpdate", id, obj);
      // commit("adapterLog", message);
    },

    SOCKET_objectChange({ commit, state, getters }, message) {
      const [id, obj] = message;
      const instance = getters.adapterInstance;
      commit("addSState", message);
      // if (id.indexOf(getters.adapterInstance + ".") < 0) return;
      if (
        !id.startsWith(getters.adapterInstance + ".") &&
        !id.startsWith("system.adapter." + instance)
      )
        return;
      // console.log("store objectChange", id, obj);
      commit("adapterLastObject", message);
    },

    async loadConfigFile({ commit, state, dispatch }) {
      // console.log("action loadConfigFile", this);
      let config = null;
      try {
        config = await fetch("./config.json")
          .then((res) => {
            // console.log("fetcher config.json", res);
            return res.json();
          })
          .catch((err) => (console.log("config.json fetch err", err), null));
      } catch (e) {
        console.log("config.json fetch err", e);
      }
      if (config) {
        commit("iobrokerConfigFile", config);
        dispatch("setAdapterReadme");
        // this.adapterIcon = config.icon;
      }
    },

    async loadInterfaces({ commit, state, dispatch }) {
      const host =
        (state.iobrokerAdapterCommon && state.iobrokerAdapterCommon.host) ||
        null;
      const ghost = await Vue.prototype
        .$socketSendTo("getHostByIp", "192.168.178.111")
        .catch((e) => console.log("error:", e), null);
      // console.log("Ghost", ghost);
      const obj = await Vue.prototype
        .$socketSendTo("sendToHost", host, "getInterfaces", "IPv4")
        .catch((e) => console.log("error:", e), null);
      const ifs = ["0.0.0.0"];
      if (obj && obj.result)
        for (const l of Object.entries(obj.result)) {
          const [name, list] = l;
          // console.log(name, list);
          for (const i of list)
            if (!i.internal && i.family === "IPv4") ifs.push(i.address);
        }
      // console.log("interfaces:", ifs);
      commit("interfaces", ifs);
    },

    async loadAdapterObjects({ commit, state, dispatch }, params) {
      const alist = `${state.iobrokerAdapter}.${state.iobrokerInstance}.`;
      const emit = Vue.prototype.$socketEmit;
      const options = {
        startKey: alist,
        endkey: alist + "\u9999",
      };
      let obj =
        (await emit("subscribeStates", alist + "*").catch(
          (e) => console.log("SubscribeStates error:", e),
          null
        )) || {};
      obj =
        (await emit("subscribeObjects", alist + "*").catch(
          (e) => console.log("SubscribeObjects error:", e),
          null
        )) || {};
      obj =
        (await emit("getObjects").catch(
          (e) => console.log("getForeignObjects error:", e),
          null
        )) || {};
      // console.log(obj);
      if (obj) {
        commit("adapterObjects", obj);
        for (const oitem of Object.entries(obj))
          if (oitem[0].startsWith(alist)) commit("addSState", oitem);
        for (const oitem of Object.entries(obj))
          if (!oitem[0].startsWith(alist)) commit("addSState", oitem);
      }
      await dispatch("wait");
      const states =
        (await emit("getStates").catch(
          (e) => console.log("getStates error:", e),
          null
        )) || {};
      for (const s of Object.entries(states)) {
        const [id, obj] = s;
        if (id.startsWith(alist) && obj) commit("adapterStates", s);
      }
      // console.log("Returned States", state.adapterStates);
      return obj;
    },

    setAdapterReadme({ commit, state }, params) {
      let { lang, common } = params || {};
      //      console.log("setAdapterReadme", lang, common);
      // debugger;
      lang = lang || state.iobrokerLang;
      common = common || state.iobrokerAdapterCommon;
      //  console.log("setAdapterReadme", lang, common);
      if (!lang || !common || !common.readme) {
        if (common && common.readme) commit("iobrokerReadme", common.readme);
        return common.readme;
      }
      let rm = common.readme;
      const crm = state.iobrokerConfigFile.readme;
      if (crm && crm[lang]) rm = rm.replace("README.md", crm[lang]);
      else
        rm = `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(
          rm
        )}`;
      commit("iobrokerReadme", rm);
      return rm;
    },
  },
  modules: {},
});
