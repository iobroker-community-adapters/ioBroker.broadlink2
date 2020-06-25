<template>
  <v-btn
    :id="myUid"
    v-if="label || bAttrs.icon != undefined"
    v-bind="bAttrs"
    @click.stop="click"
  >
    <v-icon
      v-if="!!img && (bAttrs.left && !bAttrs.right)"
      v-bind="bAttrs"
      v-text="img"
    />
    <span v-if="label">{{ label }}</span>
    <v-icon
      v-if="!!img && (bAttrs.right || !bAttrs.left)"
      v-bind="bAttrs"
      v-text="img"
      :right="bAttrs.icon == undefined"
    />
    <slot></slot>
    <v-tooltip v-if="tooltip" :activator="activator" v-bind="ttAttrs"
      ><span>{{ tooltip }}</span></v-tooltip
    >
  </v-btn>
  <span v-else-if="img">
    <v-icon :id="myUid" v-bind="bAttrs" v-text="img" @click.stop="click" />
    <v-tooltip v-if="tooltip" :activator="activator" v-bind="ttAttrs">
      <span>{{ tooltip }}</span></v-tooltip
    >
    <slot></slot>
  </span>
  <span v-else>
    <v-icon :id="myUid" v-bind="bAttrs" @click.stop="click">
      <slot></slot>
    </v-icon>
    <v-tooltip v-if="tooltip" :activator="activator" v-bind="ttAttrs">
      <span>{{ tooltip }}</span></v-tooltip
    >
  </span>
</template>

<script>
export default {
  name: "fjB",
  inheritAttrs: false,

  //  mixins: [attrsMixin],
  data() {
    //    return { my_attrs: "top,bottom,left,right" };
    return {
      myUid: "tooltipa_" + this._uid,
    };
  },
  props: {
    img: {
      type: String,
      default: "",
    },
    label: {
      type: String,
      default: "",
    },
    tooltip: {
      type: String,
      default: "",
    },
    ttAttr: {
      type: Object,
      default: () => ({ bottom: true }),
    },
    bAttr: {
      type: Object,
      default: () => ({ dense: true }),
    },
    /*     disabled: {
      type: Boolean,
      default: false
    },
    */
  },
  methods: {
    click(event) {
      //      this.$alert(`event = ${event}`);
      this.$emit("click", event);
    },
  },
  computed: {
    ttAttrs() {
      const tt = this.ttAttr;
      if (!tt.top && !tt.left && !tt.right) tt.bottom = true;
      return tt;
    },
    bAttrs() {
      const tt = this.bAttr;
      Object.assign(tt, this.$attrs);
      return tt;
    },
    activator() {
      return "#" + this.myUid;
    },
  },
  created() {},
};
</script>

<style></style>
