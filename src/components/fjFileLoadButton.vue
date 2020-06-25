<template>
  <fjB
    v-bind="$attrs"
    :label="over ? droplabel : label"
    @click.stop="triggerLoad"
    :loading="loading"
    :disabled="loading"
    :class="over ? dropclass : ''"
  >
    <input
      type="file"
      :id="myId"
      style="display: none;"
      @change="loadTextFromFile"
    />
  </fjB>
  <!--   </div>
  -->
</template>

<script>
import fjB from "./fjB.vue";

export default {
  name: "fjFileLoadButton",

  components: {
    fjB,
  },
  //  inheritAttrs: false,
  props: {
    opts: {
      type: Object,
      default: () => ({
        type: "JSON",
        basename: "FileLoadButton",
      }),
    },
    dropclass: {
      type: String,
      default: "success",
    },
    label: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    droplabel: {
      type: String,
      default: "Drop here",
    },
  },
  data() {
    return {
      loading: false,
      drop: false,
      over: false,
    };
  },
  computed: {
    myId() {
      const id =
        (this.opts.basename || "FileLoadButton_") + this._uid.toString();
      //      console.log("fileLoadBiutton:", id);
      return id;
    },
  },
  watch: {},
  methods: {
    importFile(r, opts) {
      opts = opts || {
        type: "JSON",
      };
      const { skipAtStart, skipAfterEnd, type } = opts;
      let ss = skipAtStart ? r.indexOf(skipAtStart) : -1;
      if (ss > 0) {
        opts.skippedAtStart = r.slice(0, ss);
        r = r.slice(ss);
      }
      let se = skipAfterEnd ? r.lastIndexOf(skipAfterEnd) : -1;
      if (se > 0) {
        opts.skippedAfterEnd = r.slice(se + 1);
        r = r.slice(0, se + 1);
      }
      if (type === "JSON") {
        try {
          r = JSON.parse(r);
        } catch (e) {
          r = "Error: file did not include json syntax!";
          this.$alert(`error:JSON.parse: ${e}`);
        }
      } else if (type === "Javascript") {
        try {
          r = eval("(" + r + ")");
        } catch (e) {
          r = "Error: file could not be evaluated!";
          this.$alert(`error:eval: ${e}`);
        }
      }
      return r;
    },

    loadTextFromFile(ev) {
      const that = this;
      //      console.log(ev);
      if (!ev.target.files || !ev.target.files.length) {
        this.loading = false;
        if (ev.target.value)
          this.$alert(
            "warning:" + this.tt("Browser does not load same file again!"),
            (this.loading = false)
          );
      }
      this.loading = true;
      const file = ev.target.files[0];
      const reader = new FileReader();
      this.$nextTick((_) => {
        this.opts.name = file.name;
        //      debugger;
        //      console.log(ev.target.value, reader);
        reader.onload = (e) => {
          let r = e.target.result;
          r = that.importFile(r, that.opts);
          //        console.log("results text:", r);
          that.$emit("onchange", r);
          that.$alert &&
            that.message &&
            that.$alert(`2|success:${this.message}`);
          that.loading = false;
          //        this.value = r;
          //        return r;
          //       this.$emit("load", e.target.result);
        };
        reader.readAsText(file);
      }, this);
    },
    triggerLoad() {
      //            debugger;
      const el = document.getElementById(this.myId);
      //      console.log(this.myId, "trigger:", el);
      el.value = null;
      el.click();
    },
    /*     focus(e) {
      console.log(e);
    }
 */
  },
  created() {
    //    console.log(this._uid, this.iconleft, this.label, this.img)0
  },
  mounted() {
    const that = this;
    this.drop = typeof window.FileReader !== "undefined";
    //    console.log(this.$el, "FileReader supported:", this.drop);
    const holder = this.$el;
    if (this.drop) {
      holder.ondragleave = holder.ondragover = holder.ondragenter = function () {
        that.over = true;
        return false;
      };
      holder.ondragleave = function () {
        that.over = false;
        return false;
      };
      holder.ondrop = function (e) {
        that.over = false;
        e.preventDefault();
        e.target.files = e.dataTransfer.files;
        that.$nextTick().then((_) => that.loadTextFromFile(e));
        return false;
      };
    }

    //    console.log(this.myId, this.opts);
  },
  unmounted() {
    //    console.log(this.$el);
    if (this.drop) {
      const holder = this.$el;
      holder.ondragenter = holder.ondragover = holder.ondragleave = holder.ondrop = null;
    }
  },
};
</script>
