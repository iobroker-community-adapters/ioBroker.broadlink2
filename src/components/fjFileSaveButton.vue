<template>
  <fjB v-bind="$attrs" @click="saveFile(content, opts, $event)" />
</template>

<script>
import { saveAs } from "file-saver";
import Vue from "vue";
import fjB from "./fjB.vue";

export default {
  name: "fjFileSaveButton",
  //  inheritAttrs: false,
  components: {
    fjB,
  },

  props: {
    content: {
      type: Object,
      default: () => "empty file!",
    },
    opts: {
      type: Object,
      default: () => ({
        type: "JSON",
      }),
    },
  },
  computed: {},
  methods: {
    consoleLog(...args) {
      console.log(...args);
    },

    doCopyClipboard(text) {
      const that = this;
      if (!text) return Promise.resolve();
      if (typeof text !== "string") text = JSON.stringify(text, null, 2);
      return this.$copyText(text).then(
        (e) => {
          that.$alert("2|success:" + that.$t("Copied to clipboard!"));
          //          console.log(e);
        },
        (e) => {
          that.$alert("warning:", that.$t("Cannot copy!"));
          //          console.log(e);
        }
      );
    },

    exportFile(what, opts) {
      if (what === undefined || what === null) return { str: "" };
      opts = opts || {
        type: typeof what === "string" ? "Text" : "JSON",
      };
      let {
        type,
        addAtStart,
        addAtEnd,
        saveWithJSON,
        name,
        fileName,
        basename,
        skippedAfterEnd,
        skippedAtStart,
      } = opts;
      const todoTypes = {
        JSON: {
          stringify: true,
          ending: ".json",
          mime: "application/json",
        },
        Javascript: {
          stringify: true,
          ending: ".js",
          mime: "application/javascript",
        },
        Text: {
          ending: ".txt",
          mime: "text/plain",
        },
      };
      let { stringify, ending, mime } = todoTypes[type] || todoTypes.Text;
      stringify = stringify || saveWithJSON;

      if (!name) {
        if (!fileName) name = (basename ? basename : "file") + ending;
        else name = fileName;
      }
      addAtStart =
        (addAtStart === "!"
          ? skippedAtStart
          : addAtStart && addAtStart.split("\\n").join("\n")) || "";
      addAtEnd =
        (addAtEnd === "!"
          ? skippedAfterEnd
          : addAtEnd && addAtEnd.split("\\n").join("\n")) || "";
      //    debugger;
      const str =
        addAtStart +
        (stringify ? JSON.stringify(what, null, 2) : what) +
        addAtEnd;

      return {
        name,
        str,
        mime,
        ending,
      };
    },

    saveFile(what, opts, e) {
      const { mime, str, name } = this.exportFile(what, opts);
      if (!mime) return Promise.reject("invalid value to save!");

      if (e.shiftKey) {
        e.preventDefault();
        e.str = str.toString();
        //        this.$emit("shiftclick", e);
        this.doCopyClipboard(e.str);
        return false;
      }

      const blob = new Blob([str], {
        type: mime + ";charset=utf-8",
      });

      //      console.log(name, prepend, value, typ, str);
      return saveAs(blob, name);
    },
  },
  created() {
    if (typeof this.$alert != "function")
      Vue.prototype.$alert = this.consoleLog;
    //    console.log(this._uid, this.iconleft, this.label, this.img)
  },
  mounted() {},
};
</script>
