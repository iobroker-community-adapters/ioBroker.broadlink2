// import Vue from "vue";
import { mapActions, mapGetters } from "vuex";

const broadlink = {
  // data() {
  //   return {
  //     broadlinkDevices: {},
  //   };
  // },

  // sockets: { },

  computed: {
    adapterObjects() {
      return this.$store.state.adapterObjects;
    },

    adapterStates() {
      return this.$store.state.adapterStates;
    },

    adapterStateUpdate() {
      return this.$store.state.adapterStateUpdate;
    },

    interfaces() {
      return this.$store.state.interfaces;
    },

    broadlinkDevices() {
      function collect(obj) {
        const { _id, common, native } = obj;
        const no = obj
          ? {
              $id: _id,
              $native: native,
            }
          : {};
        if (common && common.name) no.$name = common.name;
        return no;
      }

      const bo = Object.assign({}, this.$store.state.adapterObjects);
      const d = {};
      const ai = this.iobrokerAdapterInstance;
      for (const e of Object.entries(bo)) {
        const [name, obj] = e;
        if (name.startsWith(ai) < 0) continue;
        let ni = name.split(".");
        ni = ni.slice(2);
        const bn = ni[0];
        const bo = collect(obj);
        if (ni.length === 1) d[bn] = bo;
        else {
          if (!d[bn]) d[bn] = bo;
          let o = bo;
          for (let i = ni.length - 1; i >= 1; i--)
            o = {
              [ni[i]]: o,
            };
          let oo = d[bn];
          for (let j = 1; j < ni.length; j++) {
            const n = ni[j];
            if (!oo[n] || j == ni.length - 1) {
              let nn = j == ni.length - 1 && bo.$name ? bo.$name : n;
              if (nn.startsWith(oo.$name + "."))
                nn = nn.slice(oo.$name.length + 1);
              oo[nn] = j == ni.length - 1 ? collect(obj) : {};
            }
            oo = oo[n];
          }
        }
      }
      return d;
    },
  },

  watch: {
    // adapterObjects: {
    //   handler: function () {
    //     this.updateBroadlinkDevices();
    //   },
    //   deep: true,
    // },
    adapterStateUpdate(newV, oldV) {
      const [id, state] = newV;
      if (id.endsWith("._NewDeviceScan")) {
        this.$alert(`info:Device Scan ${state.val ? "Started" : "Stopped"}`);
      } else if (id.endsWith("._notReachable")) {
        const name = id.split(".")[2];
        const config = this.$store.state.iobrokerConfig;
        const devlist = (config && config.devList) || [];
        const item = devlist.find((i) => i.name == name);
        if (item) {
          this.$set(item, "active", !state.val);
          // console.log(`Set Reachable of ${id} to ${!state.val}`);
        }
      }
    },

    broadlinkDevices: {
      handler: function () {
        this.loadDevList();
      },
      deep: true,
    },
  },
  // async created() { },

  // async mounted() {},

  methods: {
    // ...mapActions(["loadAdapterObjects", "loadInterfaces"]),


    async loadDevList() {
      const that = this;
      //    console.log("beforeMount:", this.$socket);
      async function isDeviceHere(name) {
        const id = that.iobrokerAdapterInstance + "." + name + "._notReachable";
        let state = that.adapterStates[id];
        if (!state) state = that.getState(id);
        // console.log(id, state);
        return state && !state.val;
      }
      await this.wait(100);
      const config = this.$store.state.iobrokerConfig;
      if (!Array.isArray(config.devList) || !config.devList.length)
        this.$set(config, "devList", []);
      const dl = config.devList;
      for (const i of dl)
        if (i.mac.match(/[A-Z]/)) this.$set(i, "mac", i.mac.toLowerCase());
      for (const devo of Object.entries(this.broadlinkDevices)) {
        const [name, dev] = devo;
        if (!dev.$native || !dev.$native.host) continue;
        const {
          address,
          mac,
          devname,
          devhex,
          oname,
          names,
          type,
          fware,
          cloud,
        } = dev.$native.host;
        const found =
          dl.find((i) => i.mac == mac) || dl.find((i) => i.ip == address);
        const info = `${type.toUpperCase()}:${devname}, id=${devhex}, netnames=${
          (names && names.join("; ")) || oname
        }${fware ? ", v" + fware.toString() : ""}${cloud ? ", cloud" : ""}`;
        const active = await isDeviceHere(name);
        if (found) {
          found.mac = found.mac || mac;
          found.ip = found.ip || address;
          found.info = found.info || info;
          found.active = active;
        } else
          dl.push({
            name,
            ip: address,
            mac: mac.toLowerCase(),
            info,
            active,
          });
      }
      await this.wait(20);
    },
  },
};

export default broadlink;
