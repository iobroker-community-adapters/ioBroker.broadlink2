<template>
  <div>
    <v-autocomplete
      v-model="items"
      :items="myStates"
      filled
      dense
      color="blue-greyy lighten-2"
      :label="label"
      :filter="customFilter"
      item-text="name"
      item-value="name"
      return-object
      multiplex
      style="width: 250px;"
    >
      <template v-slot:selection="data">
        <v-chip
          v-bind="data.attrs"
          :input-value="data.selected"
          close
          dense
          @click="data.select"
          @click:close="remove(data.item)"
        >
          <fjAvatar left :icon="data.item.icon" size="18" />
          {{ data.item.name }}
        </v-chip>
      </template>
      <template v-slot:item="data">
        <template v-if="typeof data.item !== 'object'">
          <v-list-item-content v-text="data.item"></v-list-item-content>
        </template>
        <template v-else>
          <!--           <v-list-item-avatar tile>
            <v-img
              v-if="data.item.icon.indexOf('.') >= 0"
              :src="data.item.icon"
            ></v-img>
            <v-icon v-else>{{ data.item.icon }}</v-icon>
          </v-list-item-avatar>
 -->
          <div class="pr-2">
            <fjAvatar :icon="data.item.icon" size="32" tile left />
          </div>
          <v-list-item-content>
            <v-list-item-title>
              {{ data.item.cname }} = {{ data.item.value }}
            </v-list-item-title>
            <v-list-item-subtitle v-text="data.item.id" />
          </v-list-item-content>
        </template>
      </template>
    </v-autocomplete>
    {{ items }} <br />
    {{ active.map((i) => i.$id + "=" + i.cname) }} <br />
    <!--     {{ tree.map((i) => i.$id + "=" + i.id) }} <br />
    {{ open.map((i) => i.$id + "=" + i.id) }}
 -->
    <v-text-field dense label="filter" v-model="search" style="width: 550px;" />
    <v-treeview
      style="width: 550px;"
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
        <fjAvatar :icon="item.icon" tile />
      </template>
      <template v-slot:append="{ item }">
        <template v-if="item.isState && customFilter(item, search)">
          {{ item.cname }} = {{ item.value }}
        </template>
      </template>
    </v-treeview>
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
      treeView: [
        {
          name: "Test",
          children: [{ name: "Test1" }],
        },
        {
          name: "2Test",
          children: [{ name: "Test2" }],
        },
      ],
      search: "",
      open: [],
      mitems: [],
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
  },

  methods: {
    getName(id) {
      const lang = this.language;
      const obj = this.$app.adapterObjects[id];
      const nam = obj && obj.common && obj.common.name;
      if (!nam) return id;
      if (typeof nam === "string") return nam;
      if (typeof nam !== "object") return null;
      if (nam[lang]) return nam[lang];
      return nam["en"];
    },

    async getAState(item) {
      item.value = (
        await this.$app.getState(item.id).catch((_) => {
          val: NaN;
        })
      ).val;
    },

    genTree(filter) {
      const sts = this.$store.state.sstate;
      const tree = this.tree;
      const res = [];
      const stList = [];
      filter = filter ? filter : "";
      for (const sst of Object.entries(sts)) {
        const [name, id] = sst;
        const idarr = Array.isArray(id) ? id : [id];
        for (const ida of idarr) {
          if (ida && !ida.startsWith(filter)) continue;
          const ids = ida.split(".");
          const idf = ids[0];
          if (ids.length >= 2 && !isNaN(parseInt(ids[1])))
            ids.splice(0, 2, ids[0] + "." + ids[1]);
          let arr = res;
          let sub;
          let idn = "";
          for (const si of ids) {
            if (!arr) arr = sub.children;
            if (!arr) arr = sub.children = [];
            idn += idn ? "." + si : si;
            const issub = arr.find((i) => i.name === si);
            if (!issub) {
              const n = {
                name: si,
                id: idn,
                $id: ida,
                cname: name,
                $name: this.getName(id),
                isState: idn === ida,
              };
              n.icon = this.getIcon(idf);
              this.getAState(n);
              sub = n;
              if (n.isState) stList.push(n);
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
      if (idf === "scene") idf = "scenes";
      else if (idf === "system") return "mdi-cog";
      let icon = icons[idf];
      icon = icon ? this.$app.iobrokerHostPath + icon : "mdi-heart-box";
      return icon;
    },

    customFilter(item, queryText /* , itemText */) {
      if (
        !item ||
        !queryText ||
        typeof item.id !== "string" ||
        typeof item.name !== "string"
      )
        return true;
      const textOne = item.cname.toLowerCase();
      const textTwo = item.id.toLowerCase();
      const lctext = queryText.toLowerCase().trim();
      function find(text) {
        return textOne.indexOf(text) > -1 || textTwo.indexOf(text) > -1;
      }
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

    // configPage: {
    //   handler: function () {
    //     this.createItems();
    //   },
    //   deep: true,
    // },
  },
};
</script>

<style></style>
