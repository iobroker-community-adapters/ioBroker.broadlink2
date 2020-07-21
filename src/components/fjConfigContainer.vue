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
    this.createItems();
  },

  methods: {
    createItems() {
      const newV = this.copyObject(this.configPage.items);
      this.wait(0).then(() => {
        // this.$set(this, "items", []);
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
