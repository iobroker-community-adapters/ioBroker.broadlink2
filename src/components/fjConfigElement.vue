<template>
  <v-col v-if="nCols" :cols="nCols" :sm="sm" :md="md" :lg="lg" class="pa-1">
    <fjConfigRuler
      v-for="(item, index) in nRuler"
      v-bind:key="index"
      :ruler="item"
    />
    <fjConfigItem v-if="cToolItem.type" :cToolItem="nToolItem" :cItem="cItem" />
  </v-col>
  <span v-else>
    <fjConfigRuler
      v-for="(item, index) in nRuler"
      v-bind:key="index"
      :ruler="item"
    />
    <fjConfigItem v-if="cToolItem.type" :cToolItem="nToolItem" :cItem="cItem" />
  </span>
</template>

<script>
import Vue from "vue";

import fjConfigItem from "./fjConfigItem";
import fjConfigRuler from "./fjConfigRuler";
import fjConfigTable from "./fjConfigTable";

Vue.component("fjConfigItem", fjConfigItem);
Vue.component("fjConfigRuler", fjConfigRuler);
Vue.component("fjConfigTable", fjConfigTable);

export default {
  name: "fjConfigElement",
  //  mixins: [attrsMixin],
  data() {
    return {
      nToolItem: {},
      nRuler: [],
      nCols: "",
      sm: "",
      md: "",
      lg: "",
    };
  },
  props: {
    cToolItem: {
      type: Object,
      default: () => ({ type: "none" }),
    },
    cItem: {
      type: Object,
      default: () => ({}),
    },
  },
  methods: {
    makeItems() {
      const nitem = this.copyObject(this.cToolItem);
      let { ruler, cols, rcols, sm, md, lg } = nitem;
      delete nitem.ruler;
      delete nitem.cols;
      delete nitem.sm;
      delete nitem.md;
      delete nitem.lg;
      this.sm = sm ? sm : undefined;
      this.md = md ? md : undefined;
      this.nToolItem = nitem;
      if (cols && Number(cols)) {
        this.nCols = cols.toString();
      }
      this.lg = lg ? lg : sm || md ? cols : undefined;
      ruler =
        ruler &&
        ruler.split("|").map((item) => {
          item =
            (item &&
              item
                .trim()
                .split("=")
                .map((i) => i.trim())) ||
            [];
          if (item.length == 1) item.push(1);
          return item;
        });
      this.nRuler = ruler || [];
    },
  },

  watch: {
    cToolItem: {
      deep: true,
      handler: function () {
        this.makeItems();
      },
    },
  },
  //  computed: {},
  created() {
    this.makeItems();
  },
};
</script>

<style></style>
