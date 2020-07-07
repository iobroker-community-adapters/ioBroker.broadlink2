import Vue from "vue";
import { mapActions } from "vuex";
import { runInThisContext } from "vm";

const broadlink = {
  data() {
    return {
      broadlinkDevices: {},
    };
  },

  // sockets: { },

  computed: {
    // broadlinkConfig() {
    //   return this.$store.state.broadlinkConfig;
    // },
    adapterObjects() {
      return this.$store.state.adapterObjects;
    },
    interfaces() {
      return this.$store.state.interfaces;
    },
    // set(value) {
    //   this.$store.commit(
    //     "iobrokerConfig",
    //     JSON.parse(this.myStringify(value))
    //   );
    // },
    // broadlinkConfigChanged() {
    //   return (
    //     this.$store.state.broadlinkConfigCompare !=
    //     JSON.stringify(this.$store.state.broadlinkConfig)
    //   );
    // },
  },

  watch: {
    adapterObjects: {
      handler: function () {
        this.updateBroadlinkDevices();
      },
      deep: true,
    },
  },
  // async created() { },

  // async mounted() {},

  methods: {
    ...mapActions(["loadAdapterObjects", "loadInterfaces"]),
    /* 
    async loadBroadlinkData() {
      await this.loadBroadlinkConfig();
      this.updateBroadlinkDevices();
      // console.log(this.broadlinkDevices);
      const states = this.broadlinkConfig.states;
      let ste = Object.entries(states);
      if (!ste.length) {
        for (const i in this.broadlinkDevices) {
          const a = this.broadlinkDevices[i];
          if (!a.States) continue;
          for (const estats of Object.entries(a.States)) {
            const [name, value] = estats;
            if (value.$name && value.$native && value.$native.state) {
              const name = states[value.$name]
                ? "$" + i + value.$name
                : value.$name;

              this.$set(states, name, value.$native.state);
            }
          }
        }
      }
      const scenes = this.broadlinkConfig.scenes;
      ste = Object.entries(scenes);
      if (!ste.length) {
        for (const i in this.broadlinkDevices) {
          const a = this.broadlinkDevices[i];
          if (!a.Scenes) continue;
          for (const estats of Object.entries(a.Scenes)) {
            const [name, value] = estats;
            if (value.$name && value.$native && value.$native.scene) {
              const nam =
                value.$name.startsWith("Scenes.") >= 0
                  ? value.$name.slice(7)
                  : value.$name;
              const name = states[nam] ? "$" + i + nam : nam;
              let scene = value.$native.scene;
              if (typeof scene === "string")
                scene = scene.split(",").map((i) => i.trim());
              this.$set(scenes, name, scene);
            }
          }
        }
      }
    },
 */
    async updateBroadlinkDevices() {
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
      const bo = Object.assign({}, this.adapterObjects);
      const d = {};
      await this.wait(20);
      for (const e of Object.entries(bo)) {
        const [name, obj] = e;
        if (name.startsWith(this.iobrokerAdapterInstance) < 0) continue;
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
      this.$set(this, "broadlinkDevices", d);
      await this.wait(20);
      return d;
    },
    async loadDevList() {
      //    console.log("beforeMount:", this.$socket);
      // this.loadBroadlinkData();
      // await this.wait(10);
      await this.loadAdapterObjects();
      // await this.wait(10);
      await this.updateBroadlinkDevices();
      await this.wait(10);
      await this.loadInterfaces();
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
        } = dev.$native.host;
        const found =
          dl.find((i) => i.mac == mac) || dl.find((i) => i.ip == address);
        const info = `${type.toUpperCase()}:${devname}, id=${devhex}, netnames=${
          (names && names.join("; ")) || oname
        }`;
        if (found) {
          found.mac = found.mac || mac;
          found.ip = found.ip || address;
          found.info = found.info || info;
        } else
          dl.push({
            name,
            ip: address,
            mac: mac.toLowerCase(),
            info,
          });
      }
      await this.wait(20);
    },
  },
};

export default broadlink;
