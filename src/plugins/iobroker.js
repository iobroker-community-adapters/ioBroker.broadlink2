import Vue from "vue";
import { mapActions } from "vuex";
// import packagej from "../../package.json";
// import iopackage from "../../io-package.json";
//import { runInThisContext } from "vm";

// var path = location.pathname;
// var parts = path.split("/");
// parts.splice(-3);
// var instance = window.location.search;

// const devMode = process.env.NODE_ENV !== "production";
// const inst = window.location.search.slice(1) || "0";
// var aname = window.location.pathname.split("/");
// aname = aname[aname.length - 2];
// if (aname === "" && process.env.VUE_APP_ADAPTERNAME)
//   aname = process.env.VUE_APP_ADAPTERNAME;

function getTimeInterval(oldTime, hoursToShow) {
  hoursToShow = hoursToShow || 0;
  if (oldTime < 946681200000) oldTime = oldTime * 1000;

  var result = "";

  var newTime = new Date();

  if (!oldTime) return "";
  if (typeof oldTime === "string") {
    oldTime = new Date(oldTime);
  } else {
    if (typeof oldTime === "number") {
      oldTime = new Date(oldTime);
    }
  }

  var seconds = (newTime.getTime() - oldTime.getTime()) / 1000;

  if (hoursToShow && seconds / 3600 > hoursToShow) return "";
  //  seconds = Math.floor(seconds / 5) * 5;

  if (seconds < 5) {
    result = translate("just now");
  } else if (seconds <= 60) {
    result = translate("${1} seconds ago", Math.floor(seconds));
  } else if (seconds <= 3600) {
    result = translate(
      "for ${1} min ${2} seconds.",
      Math.floor(seconds / 60),
      Math.floor(seconds % 60)
    );
  } else if (seconds <= 3600 * 24) {
    // between 1 und 24 hours
    var hrs = Math.floor(seconds / 3600);
    if (hrs === 1 || hrs === 21) {
      result = translate("for1Hour", hrs, Math.floor(seconds / 60) % 60);
    } else if (hrs >= 2 && hrs <= 4) {
      result = translate("for2-4Hours", hrs, Math.floor(seconds / 60) % 60);
    } else {
      result = translate("forHours", hrs, Math.floor(seconds / 60) % 60);
    }
  } else if (seconds > 3600 * 24 && seconds <= 3600 * 48) {
    result = translate("yesterday");
  } else if (seconds > 3600 * 48) {
    // over 2 days
    result = translate("for ${1} hours", Math.floor(seconds / 3600));
  }

  return result;
}

//console.log(process.env, inst, aname);
Vue.filter("ago", (value, arg) => {
  return getTimeInterval(value, arg);
});

//console.log(process.env);
const mylang = (navigator.language || navigator.userLanguage).slice(0, 2);
const myCache = {};

const iobroker = {
  /*   data() {
    return {
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
    };
  },
 */
  sockets: {
    connect() {
      this.socketConnected = true;
      this.iobrokerHostConnection = this.$socket.io.opts;
      if (!this.ioBrokerSystemConfig) this.loadSystemConfig();
      // this.$alert("socket connected...");
    },

    disconnected() {
      this.socketConnected = true;
      // this.$alert("Socket disconnected. try to reconnect...");
      this.$socket.open();
    },
  },

  computed: {
    iobrokerConfigOrig: {
      get() {
        return this.$store.state.iobrokerConfigOrig;
      },
      // set(value) {
      //   this.$store.commit("iobrokerConfigOrig", value);
      // },
    },
    iobrokerHost: {
      get() {
        return this.$store.state.iobrokerHost;
      },
      set(value) {
        this.$store.commit("iobrokerHost", value);
      },
    },
    iobrokerHostConnection: {
      get() {
        return this.$store.state.iobrokerHostConnection;
      },
      set(value) {
        this.$store.commit("iobrokerHostConnection", value);
      },
    },
    iobrokerLang: {
      get() {
        return this.$store.state.iobrokerLang;
      },
      set(value) {
        this.$store.commit("iobrokerLang", value);
        this.$vuetify.lang.current = value.startsWith("zh") ? "zhHans" : value;
      },
    },
    iobrokerInstance: {
      get() {
        return this.$store.state.iobrokerInstance;
      },
      set(value) {
        this.$store.commit("iobrokerInstance", value);
      },
    },
    iobrokerConfigFile: {
      get() {
        return this.$store.state.iobrokerConfigFile;
      },
      set(value) {
        this.$store.commit("iobrokerConfigFile", value);
      },
    },
    iobrokerConfig: {
      get() {
        return this.$store.state.iobrokerConfig;
      },
      set(value) {
        this.$store.commit(
          "iobrokerConfig",
          JSON.parse(this.myStringify(value))
        );
      },
    },
    ioBrokerSystemConfig: {
      get() {
        return this.$store.state.ioBrokerSystemConfig;
      },
      set(value) {
        this.$store.commit("ioBrokerSystemConfig", value);
      },
    },
    iobrokerAdapter: {
      get() {
        return this.$store.state.iobrokerAdapter;
      },
      set(value) {
        this.$store.commit("iobrokerAdapter", value);
      },
    },
    iobrokerPackage: {
      get() {
        return this.$store.state.iobrokerPackage;
      },
      set(value) {
        this.$store.commit("iobrokerPackage", value);
      },
    },
    iobrokerIoPackage: {
      get() {
        return this.$store.state.iobrokerIoPackage;
      },
      set(value) {
        this.$store.commit("iobrokerIoPackage", value);
      },
    },
    iobrokerAdapterCommon: {
      get() {
        return this.$store.state.iobrokerAdapterCommon;
      },
      set(value) {
        this.$store.commit("iobrokerAdapterCommon", value);
      },
    },
    ioBrokerCerts: {
      get() {
        return this.$store.state.ioBrokerCerts;
      },
      set(value) {
        this.$store.commit("ioBrokerCerts", value);
      },
    },
    configTranslated: {
      get() {
        return this.$store.state.configTranslated;
      },
      set(value) {
        this.$store.commit("configTranslated", value);
      },
    },
    socketConnected: {
      get() {
        return this.$store.state.socketConnected;
      },
      set(value) {
        this.$store.commit("socketConnected", value);
      },
    },
    iobrokerReadme: {
      get() {
        return this.$store.state.iobrokerReadme;
      },
      set(value) {
        this.$store.commit("iobrokerReadme", value);
      },
    },
    adapterIcon: {
      get() {
        return this.$store.state.adapterIcon;
      },
    },
    devMode: {
      get() {
        return this.$store.state.devMode;
      },
      set(value) {
        this.$store.commit("devMode", value);
      },
    },
    ioBrokerCompareConfig() {
      return this.myStringify(this.iobrokerConfig);
    },

    iobrokerConfigChanged() {
      return this.iobrokerConfigOrig != this.ioBrokerCompareConfig;
    },

    iobrokerAdapterInstance() {
      return this.iobrokerAdapter + "." + this.iobrokerInstance;
      //      return this.iobrokerInstance;
    },
  },

  watch: {
    iobrokerConfigFile: {
      handler: function () {
        this.translateConfig(this.iobrokerConfigFile);
      },
      deep: true,
    },
    async iobrokerLang(newv) {
      const readme = await this.setAdapterReadme({
        lang: newv,
      });
    },
    async iobrokerAdapterCommon(newv) {
      const readme = await this.setAdapterReadme({ common: newv });
    },
  },
  async created() {
    //    this.iobrokerInstance = window.location.search.slice(1) || "0";
    this.$i18n.locale = this.iobrokerLang;
    await this.loadConfigFile();
  },

  beforeMount() {
    this.iobrokerHostConnection = this.$socket.io.opts;
    if (this.$socket.connected && !this.ioBrokerSystemConfig)
      this.loadSystemConfig();
    //    console.log("beforeMount:", this.$socket);
  },

  async mounted() {
    //    console.log("Mounted:", this.$socket);
    //      console.log(this.$socket, this)
    const id = "system.adapter." + this.iobrokerAdapterInstance;
    const res = await this.$socketEmit("getObject", id);
    if (res) {
      this.iobrokerConfig = res.native;
      if (res.common) this.iobrokerAdapterCommon = res.common;
      //      this.$alert("new config received");
      await this.wait(10);
      this.$forceUpdate();
    } else console.log(`No Adapterconfig received for ${id}!`);

    await this.wait(5);
    this.setAdapterReadme(this.iobrokerLang, this.iobrokerAdapterCommon);

    /*     return this.loadSystemConfig()
          .then(() => this.wait(10))
          .then(() => (this.iobrokerHostConnection = this.$socket.io.opts))
          .then(() => this.loadIoBroker());
     */
  },

  methods: {
    ...mapActions(["loadConfigFile", "setAdapterReadme"]),
    translateConfig(conf) {
      const that = this;

      function transl(o) {
        const n = {};
        if (o._translated) Object.assign(n, o);
        else
          for (const [name, value] of Object.entries(o))
            switch (name) {
              case "label":
              case "text":
              case "html":
              case "tooltip":
              case "placeholder":
              case "hint":
                if (Array.isArray(value))
                  n[name] = value
                    .map((s) => (s.startsWith("!") ? s.slice(1) : that.$t(s)))
                    .join(" ");
                else
                  n[name] = value.startsWith("!")
                    ? value.slice(1)
                    : that.$t(value);
                break;
              case "items":
                n[name] = Array.isArray(value)
                  ? value.map((i) => transl(i))
                  : value;
                break;
              default:
                n[name] = value;
                break;
            }
        n._translated = true;
        return n;
      }

      const ict = conf && conf.configTool;
      if (!ict) return [];
      const iopackage = this.iobrokerAdapterCommon;
      const trans = conf && conf.translation;
      const oldV = this.copyObject(ict && ict.length ? ict : []);

      // this.adapterIcon = iopackage && iopackage.icon;
      // this.copyObject(
      //      );
      // console.log(
      //   "new config to translate:",
      //   oldV,
      //   this.iobrokerHostConnection.hostname,
      //   this.iobrokerConfig.port
      // );
      //      console.log(this.$i18n);
      if (trans) {
        const om = this.copyObject(this.$i18n.messages);
        const nm = this.$i18n.loadLocaleMessages(trans, om);
        for (const lang of Object.keys(nm))
          this.$i18n.setLocaleMessage(lang, nm[lang]);
      }
      //      console.log("Port", this.$t("Port"));
      this.$set(this, "configTranslated", []);
      for (const i of oldV) {
        if (this.devMode || !i.devOnly) this.configTranslated.push(transl(i));
      }
      //      console.log("TRanslatedConfig:", this.configTranslated);
      return this.configTranslated;
    },

    async sendTo(_adapter_instance, command, message) {
      return this.$socketSendTo(
        "sendTo",
        _adapter_instance || this.iobrokerAdapterInstance,
        command,
        message
      );
    },

    async sendToHost(host, command, message) {
      return this.$socketSendTo(
        "sendToHost",
        host || this.iobrokerAdapterCommon.host,
        command,
        message
      );
    },

    async getInterfaces(onlyNames) {
      const result = await this.sendToHost(null, "getInterfaces", null);
      if (result && result.result) {
        if (onlyNames) return Object.keys(result.result);
        else return Object.entries(result.result);
      } else return [];
    },

    async getHost(ahost) {
      ahost = ahost || this.iobrokerAdapterCommon.host;
      const host = await this.$socketEmit("getHostByIp", ahost).then(
        (res) => (this.iobrokerHost = res),
        (e) => null
      );
      return host;
    },

    getLocalTime(time) {
      const d = new Date(time || Date.now());
      const diff = d.getTimezoneOffset();
      return new Date(d.getTime() - diff * 60 * 1000).toISOString();
    },

    iobrokerConfigD() {
      const conf = this.copyObject(this.iobrokerConfig);
      conf._adapter_info_ = {
        time: this.getLocalTime(),
        instance: this.iobrokerAdapterInstance,
        version: this.iobrokerAdapterCommon.version,
        host: this.iobrokerAdapterCommon.host,
      };
      return conf;
    },

    async saveAdapterConfig(common) {
      const native = this.copyObject(this.iobrokerConfig);
      const id = "system.adapter." + this.iobrokerAdapterInstance;
      const oldObj =
        (await this.$socketEmit("getObject", id).catch((e) => null)) || {};
      if (!oldObj.native) return false;
      for (var a of Object.getOwnPropertyNames(native))
        if (a && a != "_adapter_info_") oldObj.native[a] = native[a];

      if (common)
        for (var b in Object.getOwnPropertyNames(common))
          oldObj.common[b] = common[b];

      /* 
      if (this.configTool.length) {
        oldObj.configTool = [...this.configTool];
      }
 */

      //      console.log("Save ", id, oldObj);
      await this.$socketEmit("setObject", id, oldObj).then(
        () => this.$alert(this.$t("config saved")),
        (e) => this.$alert(`error:${this.$t("Save config error")} ${e}`)
      );

      this.iobrokerConfig = native;
      await this.wait(10);
      return true;
    },

    async saveAndClose(event) {
      await this.saveAdapterConfig(null);
      await this.closeAdapterConfig(event);
    },

    async closeAdapterConfig(event) {
      function close() {
        if (typeof parent !== "undefined" && parent) {
          try {
            if (
              parent.$iframeDialog &&
              typeof parent.$iframeDialog.close === "function"
            ) {
              parent.$iframeDialog.close();
            } else {
              parent.postMessage("close", "*");
            }
          } catch (e) {
            parent.postMessage("close", "*");
          }
        }
      }
      if (event.altKey && event.shiftKey) {
        this.$copyText(JSON.stringify(this.$missing, null, 2));
        return this.$alert(this.$t("Missing words saved to clipboard!"));
      }
      const res = this.iobrokerConfigChanged
        ? await this.$confirm(
            `okColor=error darken-2|${this.$t("Really exit without saving?")}`
          )
        : true;
      if (res)
        if (this.devMode) this.$alert("would close now " + res);
        else close();
      return res;
    },

    async getObject(id) {
      return await this.$socketEmit("getObject", id).then(
        (res) => res,
        (e) => (console.log("getObject err:", id, e), null)
      );
    },

    async getState(id) {
      return this.$socketEmit("getState", id).then(
        (res) => res,
        (e) => (console.log(e), null)
      );
    },

    async getEnums(_enum) {
      return this.$socketEmit("getObjectView", "system", "enum", {
        startkey: "enum." + _enum,
        endkey: "enum." + _enum + ".\u9999",
      }).then(
        (res) => {
          var _res = {};
          for (var i = 0; i < res.rows.length; i++) {
            if (res.rows[i].id === "enum." + _enum) continue;
            _res[res.rows[i].id] = res.rows[i].value;
          }
          return _res;
        },
        (e) => (console.log(e), [])
      );
    },

    async getGroups() {
      return this.$socketEmit("getObjectView", "system", "group", {
        startkey: "system.group.",
        endkey: "system.group.\u9999",
      }).then(
        (res) => {
          var _res = {};
          for (var i = 0; i < res.rows.length; i++) {
            _res[res.rows[i].id] = res.rows[i].value;
          }
          return _res;
        },
        (e) => (console.log(e), [])
      );
    },

    async getUsers() {
      return this.$socketEmit("getObjectView", "system", "user", {
        startkey: "system.user.",
        endkey: "system.user.\u9999",
      }).then(
        (res) => {
          var _res = {};
          for (var i = 0; i < res.rows.length; i++) {
            _res[res.rows[i].id] = res.rows[i].value;
          }
          return _res;
        },
        (e) => (console.log(e), [])
      );
    },

    async getAdapterInstances(adapter) {
      adapter = adapter || this.iobrokerAdapter;

      return this.$socketEmit("getObjectView", "system", "instance", {
        startkey: "system.adapter." + adapter,
        endkey: "system.adapter." + adapter + ".\u9999",
      }).then(
        (doc) => {
          var res = [];
          for (var i = 0; i < doc.rows.length; i++) res.push(doc.rows[i].value);
          return res;
        },
        (e) => (console.log(e), [])
      );
    },

    async getExtendableInstances(adapter) {
      adapter = adapter || this.iobrokerAdapter;

      return this.$socketEmit("getObjectView", "system", "instance", null).then(
        (doc) => {
          var res = [];
          for (var i = 0; i < doc.rows.length; i++)
            if (doc.rows[i].value.common.webExtendable) {
              res.push(doc.rows[i].value);
            }
          return res;
        },
        (e) => (console.log(e), [])
      );
    },

    async loadSystemConfig() {
      const that = this;

      async function loadSystemConfigInner() {
        let res = await that
          .$socketEmit({
            event: "system.config",
            timeout: 1000,
          })
          .then(
            (x) => x,
            (e) => null
          );
        if (res && res.common) {
          that.ioBrokerSystemConfig = res;
          that.iobrokerLang = res.common.language || that.iobrokerLang;
          that.$i18n.locale = that.iobrokerLang;
        } else return Promise.reject(null);

        res = await that
          .$socketEmit({
            event: "system.certificates",
            timeout: 1000,
          })
          .then(
            (x) => x,
            (e) => null
          );
        if (res && res.native && res.native.certificates) {
          that.ioBrokerCerts = [];
          for (var c in res.native.certificates) {
            if (
              !res.native.certificates.hasOwnProperty(c) ||
              !res.native.certificates[c]
            )
              continue;

            // If it is filename, it could be everything
            if (
              res.native.certificates[c].length < 700 &&
              (res.native.certificates[c].indexOf("/") !== -1 ||
                res.native.certificates[c].indexOf("\\") !== -1)
            ) {
              var __cert = {
                name: c,
                type: "",
              };
              if (c.toLowerCase().indexOf("private") !== -1) {
                __cert.type = "private";
              } else if (
                res.native.certificates[c].toLowerCase().indexOf("private") !==
                -1
              ) {
                __cert.type = "private";
              } else if (c.toLowerCase().indexOf("public") !== -1) {
                __cert.type = "public";
              } else if (
                res.native.certificates[c].toLowerCase().indexOf("public") !==
                -1
              ) {
                __cert.type = "public";
              }
              that.ioBrokerCerts.push(__cert);
              continue;
            }

            var _cert = {
              name: c,
              type:
                res.native.certificates[c].substring(
                  0,
                  "-----BEGIN RSA PRIVATE KEY".length
                ) === "-----BEGIN RSA PRIVATE KEY" ||
                res.native.certificates[c].substring(
                  0,
                  "-----BEGIN PRIVATE KEY".length
                ) === "-----BEGIN PRIVATE KEY"
                  ? "private"
                  : "public",
            };
            if (_cert.type === "public") {
              var m = res.native.certificates[c].split(
                "-----END CERTIFICATE-----"
              );
              var count = 0;
              for (var _m = 0; _m < m.length; _m++) {
                if (m[_m].replace(/\r\n|\r|\n/, "").trim()) count++;
              }
              if (count > 1) _cert.type = "chained";
            }

            that.ioBrokerCerts.push(_cert);
          }
        }
        return that.ioBrokerSystemConfig;
      }

      let counter = 10;
      // console.log("Will try to load systemconfig now ...");
      while (counter)
        try {
          counter--;
          const res = await loadSystemConfigInner();
          return res;
        } catch (e) {
          //          console.log("Retry load SystemConfig ", counter, e);
        }
      console.log("Could not load System config after 10 trials!");
      return null;
    },
  },
};

export default iobroker;
