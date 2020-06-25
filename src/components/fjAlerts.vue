<template>
  <div v-resize="resize">
    <v-menu
      v-if="items.length"
      dense
      :value="true"
      offset-y
      :position-x="posx"
      :position-y="posy"
      :close-on-content-click="false"
      :close-on-click="false"
      mode="out-in"
      transition="scale-transition"
    >
      <transition name="slide-fade" v-for="(item, index) in items" :key="index">
        <v-alert
          mode="in-out"
          origin="transform-origin: -100% 50%;"
          border="top"
          colored-border
          :color="item.color"
          dense
          :type="item.type"
          :label="item.label"
          elevation="5"
          class="ma-2"
        >
          <template v-slot:append>
            <fjB
              class="ml-2"
              small
              :right="label"
              :icon="!label"
              text
              :label="$t(label)"
              img="mdi-close"
              @click.stop="deleteAlert(index)"
            ></fjB>
          </template>
          <span class="body-2" v-html="item.text"></span>
        </v-alert>
      </transition>
    </v-menu>
    <slot></slot>
  </div>
</template>

<script>
import Vue from "vue";

export default {
  name: "fjAlerts",
  props: {
    selector: {
      type: String,
      default: "",
    },
    offsetX: {
      type: Number,
      default: 0,
    },
    offsetY: {
      type: Number,
      default: 0,
    },
    timeout: {
      type: Number,
      default: 6,
    },
  },

  data() {
    return {
      posx: 0,
      posy: 0,
      idCount: 0,
      items: [],
      label: "",
    };
  },

  methods: {
    addAlert(options) {
      const that = this;
      const wtime = {
        warning: 10,
        error: 20,
        info: 4,
        success: 5,
        primary: 6,
        [undefined]: 3,
      };
      options = options || {};
      if (typeof options === "string") {
        let text = options.trim();
        const m = text.match(
          /^(?:(\d*(?=\|))?\|?(warning|error|info|success|primary)\:)?(.*)$/i
        );
        if (m)
          options = {
            label: "",
            timeout: m[1] ? Number(m[1]) : wtime[m[2]],
            text: m[3],
            type: m[2] || "primary",
          };
        else options = { text, color: "primary lighten-4" };
      }
      if (options.type === "primary") {
        options.type = null;
        if (!options.color) options.color = "primary lighten-2";
      }
      if (!options.text && options.tt) options.text = this.$t(options.tt);
      options = Object.assign(
        {
          timeout: this.timeout,
          id: this.idCount++,
          text: "<>",
        },
        options
      );
      //      options.type = this.random(["error", "warning", "info", "success"]);
      //      options.color = options.color || options.type + " darken-2";
      if (options.label) this.label = options.label;
      if (options.timeout) {
        const id = options.id;
        options.hastimeout = setTimeout((_) => {
          options.hastimeout = null;
          const index = that.items.findIndex((i) => i.id === id);
          //          console.log("will delete", index);
          if (index >= 0) that.items.splice(index, 1);
        }, options.timeout * 1000);
      }
      this.items.push(options);
      return Promise.resolve(null);
    },

    deleteAlert(index) {
      //      console.log("Delete Item:", index, item, event);
      if (this.items[index].hastimeout) {
        clearTimeout(this.items[index].hastimeout);
        this.items[index].hastimeout = null;
      }
      this.items.splice(index, 1);
    },

    random(start, end) {
      if (Array.isArray(start))
        return start[Math.floor(Math.random() * start.length)];
      if (typeof end === "number") return Math.random() * (end - start) + start;
      if (typeof start === "number") return Math.random() * start;
      return Math.random();
    },

    resize() {
      const ref = this.$el;
      //   console.log(this.$refs, this.$refs.refgnbtn.$el);
      this.posx = ref.getBoundingClientRect().left + this.offsetX;
      this.posy = ref.getBoundingClientRect().bottom + this.offsetY;
      //      this.addAlert(`Alert resize: ${this.posx}, ${this.posy}`);
    },
  },

  created() {
    Vue.prototype.$alert = this.addAlert.bind(this);
  },

  beforeDestroy() {
    while (this.items.length > 0) this.deleteAlert(0);
  },

  mounted() {
    this.$nextTick((_) => this.resize());
  },
};
</script>
<style scoped.vue>
::v-deep .slide-fade-enter-active {
  transition: all 0.3s ease;
}
::v-deep .slide-fade-leave-active {
  transition: all 0.6s cubic-bezier(1, 0.5, 0.8, 1);
}
::v-deep .slide-fade-enter, .slide-fade-leave-to
/* .slide-fade-leave-active below version 2.1.8 */ {
  transform: translatex(100px);
  opacity: 0;
}
::v-deep .v-menu__content {
  transition: all 0.3s ease;
}
</style>
