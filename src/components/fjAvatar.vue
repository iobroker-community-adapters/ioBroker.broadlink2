<template>
  <v-avatar left v-if="icon" :size="size" v-bind="avprops">
    <v-img v-if="icon.indexOf('.') >= 0" :src="icon"></v-img>
    <v-icon v-else>{{ icon }}</v-icon>
  </v-avatar>
</template>

<script>
/**
 * Original from https://gist.github.com/eolant/ba0f8a5c9135d1a146e1db575276177d
 * Vuetify Confirm Dialog component
 *
 */

export default {
  name: "fjAvatar",

  data: () => ({
    avprops: {},
  }),
  props: {
    icon: {
      type: String,
      required: true,
      default: () => "",
    },
    size: {
      type: String,
      default: () => "24",
    },
  },
  created() {
    const atts = this.$attrs;
    const av = {};
    for (const att of Object.entries(atts)) {
      const [name, obj] = att;
      if (["left", "right", "tile"].indexOf(name) >= 0) {
        av[name] = obj;
        delete atts[name];
      }
    }
    this.avprops = av;
  }
};
</script>
