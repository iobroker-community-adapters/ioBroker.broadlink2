/* eslint-disable */
import Vue from "vue";
import vuetify from "./plugins/vuetify";
import App from "./App.vue";
//import VueChart from "@seregpie/vue-chart";
import i18n from './plugins/i18n'

import fjB from "./components/fjB";
import fjAlerts from "./components/fjAlerts";
import fjConfirm from "./components/fjConfirm"
import fjConfigElement from "./components/fjConfigElement"
import fjConfigContainer from "./components/fjConfigContainer"
import fjFileLoadButton from "./components/fjFileLoadButton"
import fjFileSaveButton from "./components/fjFileSaveButton"

Vue.component("fjB", fjB);
Vue.component("fjAlerts", fjAlerts);
Vue.component("fjConfirm", fjConfirm);
Vue.component("fjConfigElement", fjConfigElement);
Vue.component("fjConfigContainer", fjConfigContainer);
Vue.component("fjFileLoadButton", fjFileLoadButton);
Vue.component("fjFileSaveButton", fjFileSaveButton);

Vue.config.productionTip = false;
//Vue.component(VueChart.name, VueChart);
/*
Vue.directive("t", {
  bind(el, binding, vnode) {
    console.log(binding, vnode.context);
    if (binding.arg == "bottom") {
      el.style.position = "fixed";
      el.style.bottom = "0px";
      el.style.width = "100%";
    } else {
      el.style.position = "sticky";
      el.style.top = "0px";
    }

    if (binding.modifiers.light) {
      el.style.background = "#CCC";
    }
 
    const tr = vnode.context.$t(binding.value);
    console.log(tr);
    el.value = tr;
  }
});
*/



import VueClipboard from "vue-clipboard2";
Vue.use(VueClipboard);

import store from './plugins/store'
import Sockets from "./plugins/sockets";
Vue.use(Sockets, {});
Vue.prototype.$alert = function (...args) {
  console.log(...args);
};

Vue.mixin({
  methods: {
    copyObject(obj) {
      function co(obj, stack) {
        if (Array.isArray(obj))
          return obj.map(i => {
            stack.push(obj);
            if (stack.indexOf(i) < 0)
              i = co(i, stack);
            stack.pop();
            return i;
          });
        else if (typeof obj === "object") {
          const no = {};
          stack.push(obj);
          for (const [name, value] of Object.entries(obj)) {
            if (stack.indexOf(value) < 0)
              no[name] = co(value, stack);
            else console.log("recursive object ", name, value);
          }
          stack.pop()
          return no;
        } else return obj;
      }
      return co(obj, []);
      //      return JSON.parse(this.myStringify(obj));
    },

    myStringify(obj) {
      let res;
      try {
        res = JSON.stringify(obj);
      } catch (e) {
        console.log("MyStringify error:", e);
        res = "{}";
      }
      return res;
    },

    makeFunction(rule, that, ...args) {
      that = that || this;

      if (typeof rule == "function") return rule;
      // else if (Array.isArray(rule)) {
      //   rule = rule.map(i => i.trim());
      else if (typeof rule == "object") {
        if (typeof rule.regexp == "string") {
          const m = rule.regexp.match(/^\/(.*)\/([gimy])?$/);
          const re = m ? new RegExp(...m.slice(1, 3)) : null;
          let f;
          let r = this.$t(rule.message);
          if (re) {
            f = (v) => {
              if (Array.isArray(v))
                v = v.slice(-1)[0];
              return v && !!v.match(re) || r
            };
          } else {
            f = (v) => {
              if (Array.isArray(v))
                v = v.slice(-1)[0];
              // console.log(v);
              return v && v.indexOf(rule.regexp) >= 0 || r;
            }
          }
          return f.bind(that);
        } else if (typeof rule.number == "string") {
          const r = this.$t(rule.number);
          // const m = rule.fixed ? /^[\d\-+]$/ : /^[\d\-+.,e]$/i;
          const min = rule.min !== undefined && !isNaN(Number(rule.min)) ? Number(rule.min) : Number.NEGATIVE_INFINITY;
          const max = rule.max !== undefined && !isNaN(Number(rule.max)) ? Number(rule.max) : Number.POSITIVE_INFINITY;
          const has = Array.isArray(rule.has) ? rule.has : [];  
          const n = rule.fixed ? parseInt : parseFloat;
          // const m = rule.regexp.match(/^\/(.*)\/([gimy])?$/);
          // const re = m ? new RegExp(...m.slice(1, 3)) : null;
          // let ;
          // let r = this.$t(rule.message);
          const f = (v) => {
            if (Array.isArray(v))
              v = v.slice(-1)[0];
            // console.log(v);
            const x = n(v);
            return !isNaN(x) && (x >= min && x <= max || has.indexOf(x) >=0) || r;
          };
          return f.bind(that);
        }
      } else if (typeof rule == "string" && rule.trim()) {
        if (typeof that[rule] == "function") return that[rule].bind(that);
        rule = [...args, rule.trim()];
        try {
          let b = rule[rule.length - 1];
          b = b.startsWith("return ") || b.startsWith("{") ? b : `return ${b};`
          rule[rule.length - 1] = b;
          const f = new Function(...rule);
          return f.bind(that);
        } catch (e) {
          console.log(`makeFunction error ${e} in function generation with: ${rule}`);
        }
      } else console.log("makeFunction - Invalid function content in rule:", rule);
      return null;
    },

    async wait(time, arg) {
      time = Number(time) || 0;
      if (isNaN(time) || time < 0) time = 0;
      return await new Promise((resolve) =>
        setTimeout(() => resolve(arg), time)
      );
    },

    /*     async pSequence(arr, promise, wait) {
          wait = wait || 0;
          if (!Array.isArray(arr) && typeof arr === "object")
            arr = Object.entries(arr).filter((o) => arr.hasOwnProperty(o[0]));
          const res = [];
          for (let i of arr) {
            if (res.length) await this.wait(wait);
            try {
              const r = await promise(i);
              res.push(r);
            } catch (e) {
              res.push(e);
            }
          }
          return res;
        },
        */
  }
});

new Vue({
  vuetify,
  i18n,
  store,

  render: function (h) {
    return h(App);
  }
}).$mount("#app");