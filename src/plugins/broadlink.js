import Vue from "vue";
import { mapActions } from "vuex";

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
    // broadlinkObjects() {
    //   return this.$store.state.broadlinkObjects;
    // },
    // broadlinkConfigChanged() {
    //   return (
    //     this.$store.state.broadlinkConfigCompare !=
    //     JSON.stringify(this.$store.state.broadlinkConfig)
    //   );
    // },
  },

  watch: {
    // broadlinkObjects: {
    //   handler: function () {
    //     this.updateBroadlinkDevices();
    //   },
    //   deep: true,
    // },
    /*
        async iobrokerLang(newv) {
          const readme = await this.setAdapterReadme({
            lang: newv,
          });
        },
        async iobrokerAdapterCommon(newv) {
          const readme = await this.setAdapterReadme({
            common: newv,
          });
        },
     */
  },
  // async created() { },

  beforeMount() {
    //    console.log("beforeMount:", this.$socket);
    // this.loadBroadlinkData();
  },

  async mounted() {},

  methods: {
    // ...mapActions(["loadBroadlinkObjects", "loadBroadlinkConfig"]),
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
    updateBroadlinkDevices() {
      function collect(obj) {
        const { _id, common, native } = obj;
        const no = obj ? { $id: _id, $native: native } : {};
        if (common && common.name) no.$name = common.name;
        return no;
      }
      const bo = Object.assign({}, this.$store.state.broadlinkObjects);
      const a = [];
      for (const e of Object.entries(bo)) {
        const [name, obj] = e;
        let ni = name.split(".");
        const ai = parseInt(ni[1]);
        if (!a[ai]) a[ai] = {};
        const d = a[ai];
        ni = ni.slice(2);
        const bn = ni[0];
        const bo = collect(obj);
        if (ni.length === 1) d[bn] = bo;
        else {
          if (!d[bn]) d[bn] = bo;
          let o = bo;
          for (let i = ni.length - 1; i >= 1; i--) o = { [ni[i]]: o };
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
      this.$set(this, "broadlinkDevices", a);
      return a;
    },
  },
};

export default broadlink;
