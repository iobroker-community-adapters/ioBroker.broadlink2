<template>
  <v-flex v-if="cToolItem.type == 'text'" v-bind="attrs('html,text,label')">
    <div v-if="cToolItem.label" v-text="cToolItem.label" class="subtitle-2" />
    <div v-if="cToolItem.text" v-text="cToolItem.text" class="caption" />
    <div v-if="cToolItem.html" v-html="cToolItem.html" class="caption" />
  </v-flex>
  <v-flex v-else-if="cToolItem.type == 'html'" v-bind="attrs('text,label')">
    <div v-if="cToolItem.label" v-text="cToolItem.label" class="subtitle-2" />
    <div
      v-if="Array.isArray(cToolItem.text)"
      v-html="cToolItem.text.join('<br>')"
      class="caption"
    />
    <div v-else v-html="cToolItem.text" class="caption" />
  </v-flex>
  <fjB
    v-else-if="cToolItem.type == 'button'"
    v-bind="attrs()"
    @click="cToolItem.click"
  />
  <v-text-field
    v-else-if="cToolItem.type == 'number'"
    dense
    hide-details="auto"
    v-bind="attrs('min,max')"
    v-model="number"
  />
  <v-text-field
    v-else-if="cToolItem.type == 'string'"
    dense
    hide-details="auto"
    v-bind="attrs()"
    v-model="cValue"
  />
  <v-checkbox
    v-else-if="cToolItem.type == 'checkbox' && cToolItem.label"
    dense
    hide-details="auto"
    v-model="cValue"
    v-bind="attrs()"
    @change="cToolItem.click ? cToolItem.click($event) : null"
  />
  <v-select
    v-else-if="cToolItem.type == 'select'"
    :items="cToolItem.select"
    dense
    hide-details="auto"
    v-model="cValue"
    v-bind="attrs()"
  />
  <v-textarea
    v-else-if="cToolItem.type == 'textarea'"
    style="font-family: monospace !important; font-size: 14px"
    auto-grow
    row-height="15"
    hide-details="auto"
    :rows="cValue.split(`\n`).length"
    dense
    v-model="cValue"
    v-bind="attrs()"
  />
  <v-combobox
    v-else-if="cToolItem.type == 'chips' && Array.isArray(cValue)"
    v-model="cValue"
    v-bind="attrs()"
    :items="cToolItem.select || []"
    chips
    dense
    hide-details="auto"
    deletable-chips
    :search-input.sync="search"
    multiple
  />
  <fjConfigTable
    v-else-if="cToolItem.type == 'table'"
    :columns="cToolItem.items"
    :table="cValue"
    v-bind="attrs()"
  />
  <v-simple-checkbox
    v-else-if="cToolItem.type == 'checkbox' && !cToolItem.label"
    v-model="cValue"
    v-bind="attrs()"
    @change="cToolItem.click ? cToolItem.click($event) : null"
  />
  <fjIoBrokerLog v-bind="attrs()" v-else-if="cToolItem.type == 'log'" />
  <v-switch
    v-else-if="cToolItem.type == 'switch'"
    dense
    hide-details="auto"
    v-model="cValue"
    v-bind="attrs()"
    @change="cToolItem.click ? cToolItem.click($event) : null"
  />
  <div v-else v-bind="attrs()">
    {{ cToolItem }} {{ cToolItem.value ? cValue : "" }}
  </div>
</template>

<script>
import fjIoBrokerLog from "./fjIoBrokerLog";

export default {
  name: "fjConfigItem",
  components: {
    fjIoBrokerLog,
  },

  data() {
    //    return { my_attrs: "top,bottom,left,right" };
    return {
      //      myUid: "tooltipa_" + this._uid,
      search: null,
      mToolItem: {},
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
    cTable: {
      type: Object,
      default: () => ({}),
    },
    /*     disabled: {
      type: Boolean,
      default: false
    },
    */
  },
  computed: {
    number: {
      get() {
        let val = this.cItem[this.cToolItem.value];
        if (val === undefined) val = 0;
        if (typeof val === "string" || typeof val === "boolean")
          val == Number(val);
        if (isNaN(val)) val = 0;
        return val.toString();
      },
      set(value) {
        const num = Number(value);
        if (!isNaN(num)) this.$set(this.cItem, this.cToolItem.value, num);
      },
    },

    cValue: {
      get() {
        const ct = this.cTable;
        const cv = this.cToolItem;
        const value = cv.value;
        const ci = this.cItem;
        // const ls = this.$store.state.adapterLastState;
        if (!value.startsWith("(")) return ci[value];
        const o = eval(value);
        return o;
      },
      set(val) {
        const value = this.cToolItem.value;
        const ci = this.cItem;
        if (!value.startsWith("(")) return this.$set(ci, value, val);
        const o = eval(value + "=val");
        return o;
      },
    },
  },
  //  methods: {},
  methods: {
    removeChip(item) {
      this.cValue.splice(this.cItem[this.cToolItem.value].indexOf(item), 1);
      //      this.chips = [...this.chips]
    },

    numberRule(val) {
      const n = Number(val);
      if (isNaN(n)) return this.$t("You can enter only a number here!");
      if (this.cToolItem.min != undefined && n < this.cToolItem.min)
        return this.$t("Number should not be lower than ") + this.cToolItem.min;
      if (this.cToolItem.max != undefined && n > this.cToolItem.max)
        return (
          this.$t("Number should not be bigger than ") + this.cToolItem.max
        );
      return true;
    },

    uniqueTableRule(val) {
      const { items, column } = this.cTable;
      const v = ("" + val).trim();
      const vp = column.value;
      const found = items.filter((i) => ("" + i[vp]).trim() == v);
      return (
        found.length <= 1 ||
        this.$t("This item can only be once per table in this field!")
      );
    },

    onlyWords(val) {
      if (Array.isArray(val)) val = val[0];
      //      debugger;
      return (
        !!val.match(/^[\u00C0-\u017Fa-zA-Z0-9_\-\@\$\/]+$/) ||
        this.$t("Only letters, numbers and `_ - @ $ /` are allowed!")
      );
    },

    stringToArrayWith(item, value, what) {
      what = what || ",";
      const val = value[item.value];
      if (typeof val === "string") {
        const ret = val.split(",").map((i) => i.trim());
        if (ret.length == 1 && !ret[0]) ret.splice(0, 1);
        // console.log(val, ret);
        value[item.value] = ret;
      }
    },

    attrs(remove) {
      const rem = [
        "type",
        "value",
        "attrs",
        "convertold",
        "click",
        "select",
        "eval",
        "_translated",
      ];

      if (remove) {
        if (typeof remove === "string")
          rem.push(...remove.split(",").map((i) => i.trim()));
        else if (Array.isArray(remove)) rem.push(...remove);
        // else
        //   this.$alert(
        //     "warning:using wrong attrs(arg):" + JSON.stringify(remove)
        //   );
      }
      if (
        this.cToolItem.convertold &&
        typeof this.cToolItem.convertold !== "function"
      )
        this.mToolItem.convertold = this.makeFunction(
          this.mToolItem.convertold,
          this,
          "item",
          "conf"
        );
      if (this.mToolItem.click && typeof this.mToolItem.click !== "function")
        this.mToolItem.click = this.makeFunction(
          this.cToolItem.click,
          this,
          "item",
          "conf"
        );
      if (
        typeof this.cToolItem.eval == "string" &&
        this.cToolItem.eval.trim()
      ) {
        const fun = this.makeFunction(
          this.cToolItem.eval.trim(),
          this,
          "item",
          "conf"
        );
        // console.log(nitem.eval);
        // debugger;
        try {
          const res = fun(this.cToolItem, this.cItem);
          // console.log(nitem);
        } catch (e) {
          console.log("eval error in translation:", nitem, e, this);
        }
      }

      if (
        typeof this.cToolItem.disabled === "string" &&
        this.cToolItem.disabled.length > 1
      )
        this.mToolItem.disabled = this.makeFunction(
          this.cToolItem.disabled,
          null,
          "conf"
        );
      if (typeof this.cToolItem.convertold == "function")
        try {
          this.cToolItem.convertold(this.cToolItem, this.cItem);
        } catch (e) {
          console.log(
            `error ${e} in conversion function of item ${JSON.stringify(
              this.cToolItem
            )}`
          );
        }
      const nattr = Object.assign(
        {},
        this.cToolItem.attrs ? this.cToolItem.attrs : { class: "pa-1" },
        this.cToolItem
      );
      if (typeof nattr.disabled == "function")
        nattr.disabled = nattr.disabled(this.cItem);

      const rules = nattr.rules;
      const nrules = [];
      if (rules && rules.length) {
        for (let i of rules) {
          const rule = this.makeFunction(i, this, "$");
          if (rule) nrules.push(rule);
        }
        nattr.rules = nrules;
      }
      for (let r of rem) delete nattr[r];
      for (let p of ["text", "label", "placeholder", "hint"])
        if (typeof nattr[p] == "string") nattr[p] = this.$t(nattr[p]);
      return nattr;
    },
  },
  //  created() {},
  mounted() {
    this.mToolItem = this.cToolItem;
  },
};
</script>

<style></style>
