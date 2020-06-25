<template>
  <v-dialog
    v-model="dialog"
    :max-width="options.width"
    :style="{ zIndex: options.zIndex }"
    @keydown.esc="agree(false)"
  >
    <v-card>
      <v-toolbar dark :color="options.color" dense flat>
        <v-toolbar-title class="white--text" v-text="options.title" />
      </v-toolbar>
      <v-card-text
        v-show="!!options.message"
        class="pa-4"
        v-html="$t(options.message)"
      />
      <v-card-actions class="pt-0">
        <v-spacer></v-spacer>
        <v-btn :color="options.okColor" text @click.native="agree(true)">
          <v-icon v-if="options.okIcon" left v-text="options.okIcon" />
          <span>{{ options.okText }}</span>
        </v-btn>
        <v-btn :color="options.cancelColor" text @click.native="agree(false)">
          <span>{{ options.cancelText }}</span>
          <v-icon v-if="options.cancelIcon" right v-text="options.cancelIcon" />
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
/**
 * Original from https://gist.github.com/eolant/ba0f8a5c9135d1a146e1db575276177d
 * Vuetify Confirm Dialog component
 *
 */

import Vue from "vue";

export default {
  data: () => ({
    dialog: false,
    resolve: null,
    options: {},
  }),
  props: {
    defaults: {
      type: Object,
      default: () => ({}),
    },
  },
  methods: {
    open(message, options) {
      const defaults = {
        color: "primary",
        cancelColor: "grey darken-2",
        okColor: "success darken-2",
        okText: this.$t("Yes"),
        okIcon: "mdi-check",
        cancelIcon: "mdi-close",
        cancelText: this.$t("No"),
        message: "",
        title: "",
        width: 390,
        zIndex: 200,
      };
      options = options || {};
      if (!options.title && message.indexOf("|") > 0) {
        const pos = message.indexOf("|");
        options.message = message.slice(pos + 1);
        const opts = message
          .slice(0, pos)
          .split(",")
          .map((i) =>
            i
              .trim()
              .split("=")
              .map((j) => j.trim())
          );
        const cmap = Object.keys(defaults).map((i) => i.toLowerCase());
        let keys;
        for (keys of opts) {
          const key = keys[0],
            val = keys[1],
            keypos = cmap.indexOf(key.toLowerCase());
          if (key && keypos >= 0)
            options[Object.keys(defaults)[keypos]] =
              val === undefined ? true : !!Number(val) ? Number(val) : val;
        }
      } else options.message = message;

      if (!options.title) options.title = this.$t("Please confirm:");

      this.title = options.title;
      this.message = options.message;
      const myopts = Object.assign({}, defaults, this.defaults, options);

      this.options = Object.assign({}, this.options, myopts);
      this.dialog = true;
      return new Promise((resolve) => {
        this.resolve = resolve;
      });
    },

    async agree(what) {
      await this.$nextTick();
      this.dialog = false;
      await this.$nextTick();
      // console.log("will resolve $confirm with", !!what);
      this.resolve(!!what);
    },
  },

  created() {
    Vue.prototype.$confirm = this.open.bind(this);
  },
};
</script>
