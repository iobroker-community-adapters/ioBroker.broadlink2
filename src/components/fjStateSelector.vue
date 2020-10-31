

<template>
  <div>
    {{ items.map((i) => i.$id) }}
    <br />
    {{ active.map((i) => i.$id) }}
    <br />
    <!--     {{ tree.map((i) => i.$id + "=" + i.id) }} <br />
    -->
    {{ open.map((i) => i.name + "=" + i.id) }} <br />
    <v-btn small @click.stop="smenu = !smenu">
      {{ smenu ? "Listview" : "Treeview" }}</v-btn
    >
    <v-text-field
      dense
      label="filter"
      v-model="search"
      style="width: 550px;"
      clearable
      filled
    />
    <v-card
      class="px-2 py-1"
      outlined
      style="max-width: 600px; max-height: 500px; overflow-y: auto;"
    >
      <v-treeview
        v-if="smenu"
        v-model="tree"
        :items="treeView"
        :active.sync="active"
        :open.sync="open"
        dense
        :search="search"
        :filter="customFilter"
        activatable
        hoverable
        return-object
      >
        <template v-slot:prepend="{ item }">
          <fjAvatar :icon="item.icon" size="28" tile />
        </template>
        <template v-slot:label="{ item }">
          {{ item.name }}
          <template v-if="item && item.nname && !item.name.endsWith(item.nname)"
            >({{ item.nname }})</template
          >
        </template>
        <template v-slot:append="{ item }">
          <template v-if="item.isState && customFilter(item, search)"
            >{{ item.cname }} = {{ item.value }}</template
          >
        </template>
      </v-treeview>
      <v-virtual-scroll v-else :items="filtered" :item-height="48" height="490">
        <template v-slot="{ item }">
          <v-list-item @click="selectVs(item)">
            <v-list-item-avatar>
              <fjAvatar :icon="item.icon" size="28" tile />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title
                >{{ item.cname }} = {{ item.value }}</v-list-item-title
              >
              <v-list-item-subtitle v-text="item.id" />
            </v-list-item-content> </v-list-item
        ></template>
      </v-virtual-scroll>
    </v-card>
  </div>
</template>

<script>
export default {
  name: "fjStateSelector",

  data() {
    return {
      myStates: [],
      tree: [],
      active: [],
      treeView: [],
      search: "",
      open: [],
      mitems: [],
      smenu: true,
      dispTree: true,
      // items: [],
    };
  },
  props: {
    value: {
      type: Array,
      default: () => [],
    },
    label: {
      type: String,
      default: () => "Select State",
    },
  },
  created() {
    this.mitems = this.value;
  },
  async mounted() {
    await this.wait(2000);
    this.genTree();
  },

  computed: {
    items: {
      get() {
        return this.mitems;
      },
      set(value) {
        console.log("Set items", this.mitems, value);
        this.$set(this, "mitems", [value]);
        // this.mitems.push(value);
        this.$emit("input", this.mitems);
      },
    },
    language() {
      return this.$app.iobrokerLang;
    },

    filtered() {
      const sts = this.myStates;
      const res = sts.filter((i) => this.customFilter(i, this.search));
      return res;
    },
  },

  methods: {
    selectVs(item) {
      console.log("selectVs", item);
    },

    getName(id) {
      const lang = this.language;
      const obj = this.$app.iobrokerObjects[id];
      const nam = obj && obj.common && obj.common.name;
      // if (id=="hm-rpc.0.NEQ0119725") debugger;
      if (!nam) return id;
      if (typeof nam === "string") return nam;
      if (typeof nam !== "object") return null;
      if (nam[lang]) return nam[lang];
      return nam["en"];
    },

    async getAState(item) {
      const v = await this.$app.getState(item.id).catch((_) => {
        val: NaN;
      });
      item.value = v && typeof v === "object" ? v.val : undefined;
    },

    genTree(filter) {
      const sts = this.$store.state.sstate;
      const tree = this.tree;
      const res = [];
      const stList = [];
      filter = filter ? filter : "";
      for (const sst of Object.entries(sts)) {
        const [name, id] = sst;
        // if (name.indexOf("MOTION") > -1 || id.indexOf("MOTION") > -1) debugger;
        const idarr = Array.isArray(id) ? id : [id];
        for (const ida of idarr) {
          if (ida && !ida.startsWith(filter)) continue;
          const ids = ida.split(".");
          if (ids.length >= 2 && !isNaN(parseInt(ids[1])))
            ids.splice(0, 2, ids[0] + "." + ids[1]);
          let arr = res;
          let sub;
          let idn = "";
          let idnn = "";
          for (const si of ids) {
            if (!arr) arr = sub.children;
            if (!arr) arr = sub.children = [];
            idn += idn ? "." + si : si;
            const obj = this.$app.iobrokerObjects[ida];
            const common = obj && obj.common;
            const nname = this.getName(idn).split(".").slice(-1)[0];
            idnn += idnn ? "." + nname : nname;
            const issub = arr.find((i) => i.name === si);
            if (!issub) {
              const n = {
                type: obj && obj.type,
                role: common && common.role,

                name: si,
                id: idn,
                $id: ida,
                cname: name,
                $name: this.getName(ida),
                nname,
                idnn,
                isState: idn === ida,
              };
              n.icon = this.getIcon(ida);
              sub = n;
              if (n.isState) {
                stList.push(n);
                this.getAState(n);
              }
              arr.push(n);
            } else sub = issub;
            arr = sub.children;
          }
        }
      }
      this.$set(this, "myStates", stList);
      this.$set(this, "treeView", res);
      return res;
    },

    getIcon(idf) {
      const icons = this.$store.state.icons;
      const ids = idf.split(".");
      const host = this.$app.devMode ? this.$app.iobrokerHostPath : "";
      let icon;
      while (ids.length) {
        if (icons[ids.join(".")]) {
          icon = icons[ids.join(".")];
          break;
        }
        idf = ids.pop();
      }
      if (!icon) {
        if (idf === "scene") idf = "scenes";
        else if (idf === "system") return "mdi-cog";
        icon = icons[idf];
      }
      icon = icon ? host + icon : "mdi-heart-box";
      return icon;
    },

    customFilter(item, queryText /* , itemText */) {
      function find(text) {
        for (const items of Object.entries(item)) {
          const item = items[1];
          if (items[0] === "value") continue;
          const test = typeof item === "string" ? item.toLowerCase() : "";
          if (test.indexOf(text) > -1) return true;
        }
        return false;
      }

      if (
        !item ||
        !queryText ||
        typeof item.id !== "string" ||
        typeof item.name !== "string"
      )
        return true;
      const lctext = queryText.toLowerCase().trim();
      function msplit(text, char) {
        if (typeof text !== "string") return [];
        const arr = text.split(char).map((i) => i.trim());
        if (!arr.length) return [];
        if (arr.length === 1) return arr[0] ? [arr[0]] : [];
        const ret = [];
        let first = "";
        if (char === " ") char = "";
        for (const ii of arr) {
          if (ii) ret.push(first + ii);
          first = char;
        }
        // if (item.name.startsWith("A1:"))
        //   console.log("msplit:", "'" + char + "'", text, lctext, arr, ret);
        return ret;
      }
      let strs = msplit(lctext, " ");
      let tmp = [];
      for (const i in strs) tmp.push(msplit(strs[i], "+"));
      strs = [].concat.apply([], tmp);
      // strs = strs.reduce((prev, curr) => prev.concat(curr));
      // strs = strs.reduce((prev, curr) => prev.concat(curr));
      tmp = [];
      for (const j in strs) tmp.push(msplit(strs[j], "-"));
      strs = [].concat.apply([], tmp);
      // strs = strs.reduce((prev, curr) => prev.concat(curr));
      // strs = strs.reduce((prev, curr) => prev.concat(curr));
      //      if (lctext.indexOf(" ")) strs = lctext.split(" ").filter((i) => !!i);
      // if (item.name.startsWith("A1:")) console.log("split:", strs);
      let found = false,
        first = true,
        sign;
      for (const text of strs) {
        if (typeof text !== "string") continue;
        let ltext = text;
        if (ltext.startsWith("+")) {
          ltext = ltext.slice(1);
          sign = "+";
        } else if (ltext.startsWith("-")) {
          ltext = ltext.slice(1);
          sign = "-";
        }
        const fnd = find(ltext);
        if (sign === "-" && fnd) return false;
        else if (sign === "+" && !fnd) return false;
        else found = found || fnd;
        // if (item.name.startsWith("A1:"))
        //   console.log("Find:", sign, fnd, found, ltext, strs);
        first = false;
      }
      return found;
    },

    remove(item) {
      console.log("clicked remove with", item, this.value);
      const val = this.value;
      let index;
      for (index = 0; index < val.length; index++)
        if (val[index].name === item.name) break;
      if (index < val.length) val.splice(index, 1);
    },
  },

  watch: {
    "$store.state.sstate"(newV) {
      this.$nextTick(() => {
        this.genTree();
        this.$forceupdate();
      });
    },

    active(newV) {
      // console.log(newV);
      if (newV.length && !newV[0].isState) newV.splice(0, 1);
    },

    open(newV, oldV) {
      while (newV.length) {
        let i;
        const fv = newV[0].id;
        for (i = 0; i < newV.length; i++) {
          if (newV.length > i + 1 && !newV[i + 1].id.startsWith(fv)) break;
        }
        if (i + 1 < newV.length) newV.splice(0, i + 1);
        else break;
      }
      // console.log(newV, oldV);
    },
  },
};
</script>
<style></style>
