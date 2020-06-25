import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

const devMode = process.env.NODE_ENV !== "production";
const inst = window.location.search.slice(1) || "0";
let aname = window.location.pathname.split("/");
aname = aname[aname.length - 2];
if (aname === "" && process.env.VUE_APP_ADAPTERNAME)
  aname = process.env.VUE_APP_ADAPTERNAME;

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
    iobrokerPackage: {}, // packagej,
    iobrokerIoPackage: {}, //iopackage,
    iobrokerAdapterCommon: {}, // iopackage.common,
    ioBrokerCerts: [],
    configTranslated: [],
    socketConnected: false,
    iobrokerReadme: "",
    adapterIcon: "",
    devMode,
  },
  mutations: {
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
  actions: {
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
