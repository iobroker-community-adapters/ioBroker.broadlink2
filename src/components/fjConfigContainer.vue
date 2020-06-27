<template>
  <v-container fluid>
    <v-row class="px-2">
      <fjConfigElement
        v-for="(item, index) in items"
        v-bind:key="index"
        :cItem="cItem"
        :cToolItem="item"
      />
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "fjConfigContainer",

  //  mixins: [attrsMixin],
  data() {
    return {
      items: [],
    };
  },
  props: {
    cItem: {
      type: Object,
      default: () => ({}),
    },
    configPage: {
      type: Object,
      default: () => ({ items: [], page: -1 }),
    },
  },
  created() {
    //      console.log(newV);
    this.createItems();
  },

  methods: {
    createItems() {
      const newV = this.copyObject(this.configPage.items);
      this.wait(0).then(() => {
        this.$set(this, "items", []);
        // if (newV)
        //   for (const i in newV) {
        // console.log(
        //   "item for ",
        //   this.configPage.label,
        //   newV[i].type,
        //   newV[i].label
        // );
        //   this.items.splice(i, 1, newV[i]);
        // }
        this.$set(this, "items", newV);
        return this.wait(2).then(() => this.$forceUpdate());
      });
    },
  },

  watch: {
    configPage: {
      handler: function () {
        this.createItems();
      },
      deep: true,
    },
  },
};
</script>

<style></style>
