<template>
  <v-col v-if="type == 'hr' || type == 'line'" cols="12">
    <v-divider :class="'py-' + value"></v-divider>
  </v-col>
  <v-col v-else-if="type == 'horizontal'" :class="'py-' + value" cols="12">
    <v-spacer></v-spacer>
  </v-col>
  <v-divider v-else-if="type == 'vertical'" :class="'px-' + value" vertical />
  <v-spacer v-else />
</template>

<script>
export default {
  name: "fjConfigRuler",

  //  mixins: [attrsMixin],
  data() {
    return {};
  },
  props: {
    ruler: {
      type: Array,
      default: () => [],
    },
  },
  //  methods: {},
  computed: {
    type() {
      return this.ruler[0];
    },
    value() {
      return this.ruler[1];
    },
  },
};
</script>

<style></style>
