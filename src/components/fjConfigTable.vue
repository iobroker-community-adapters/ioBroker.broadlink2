<template>
  <div class="pa-0 elevation-2">
    <v-toolbar dark height="36" color="primary">
      <v-icon left v-if="icon">{{ icon }}</v-icon>
      <v-toolbar-title class="subtitle-2">{{ label }}</v-toolbar-title>
      <v-spacer /><v-text-field
        v-model="search"
        class="body-1"
        append-icon="mdi-magnify"
        :label="$t('Search')"
        single-line
        hide-details
        dense
      ></v-text-field
      ><v-spacer />
      <fjB
        text
        small
        @click="addRow"
        :label="$t('Add entry')"
        img="mdi-playlist-plus"
      />
    </v-toolbar>
    <v-data-table
      dense
      :headers="icolumns"
      :items="table || []"
      :search="search"
      :disableSort="disableSort"
    >
      <template v-slot:item="{ item, headers, index }" height="auto">
        <tr class="alternate">
          <td
            v-for="column in headers"
            :key="column.value"
            style="padding: 0px 1px 0px 1px;"
          >
            <span v-if="column.value == '-'" class="d-flex justify-center">
              <fjB
                v-if="disableSort"
                :disabled="table.indexOf(item) < 1"
                color="primary darken-4"
                img="mdi-transfer-up"
                @click.stop="itemMove(item, -1)"
                :tooltip="$t('move item one line up')"
              />
              <fjB
                v-if="disableSort"
                color="primary darken-4"
                :disabled="table.indexOf(item) >= table.length - 1"
                img="mdi-transfer-down"
                @click.stop="itemMove(item, +1)"
                :tooltip="$t('move item one line down')"
              />
              <fjB
                img="mdi-delete-forever"
                color="error darken-4"
                @click.stop="itemDelete(item)"
                :tooltip="$t('delete item')"
              />
            </span>
            <fjConfigItem
              v-else
              :cItem="item"
              :cToolItem="column"
              :cTable="cTable(index, column)"
            />
          </td>
        </tr>
      </template>
    </v-data-table>
  </div>
</template>

<script>
export default {
  name: "fjConfigTable",

  props: {
    table: { type: Array, required: true },
    columns: { type: Array, required: true },
    label: { type: String, required: false, default: "" },
    icon: { type: String, required: false, default: "mdi-table" },
    disableSort: { type: Boolean, required: false, default: false },
  },
  data: () => ({
    search: "",
  }),
  methods: {
    async itemDelete(item) {
      if (this.table.indexOf(item) < 0) return;
      const i = this.table.indexOf(item);
      const ret = await this.$confirm(
        this.$t("Do you really want to delete item") + ` '${item.path}' ?`
      );
      if (ret) this.table.splice(i, 1);
    },

    itemMove(i, dir) {
      const index = this.table.indexOf(i);
      if (index >= 0) i = index;
      else return;
      const item = this.table.splice(i, 1);
      this.table.splice(i + dir, 0, item[0]);
    },

    numberRule(val) {
      const n = Number(val);
      if (isNaN(n)) return this.$t("You can enter only a number here!");
      if (this.cToolItem.min != undefined && n < this.cToolItem.min)
        return this.$t("Number should not be lower than ") + this.cToolItem.min;
      if (this.cToolItem.max != undefined && n > this.cToolItem.max)
        return (
          this.$t("Number should not be bigger than ") + this.cToolItem.min
        );
      return true;
    },

    cTable(index, column) {
      return {
        items: this.table,
        index: index,
        column: column,
      };
    },

    addRow() {
      let ni = {};
      this.columns.forEach((c, index) => {
        ni[c.value] =
          c.default !== undefined
            ? c.default
            : {
                text: "",
                string: "",
                textarea: "",
                number: 0,
                select:
                  (c.select && c.select.find((i) => i != undefined)) || "",
                checkbox: false,
                chips: [],
              }[c.type] || "";
      });

      this.table.push(ni);
    },
  },
  //  watch: {},
  computed: {
    icolumns() {
      return [
        ...this.columns,
        {
          text: "\u270D",
          value: "-",
          align: "center",
          filterable: false,
          // justify: "center",
          // class: "text-center",
          sortable: false,
          width: this.disableSort ? "5%" : "2%",
        },
      ];
    },
  },
  //  created() {},
};
</script>
<style>
td,
th,
th[role="columnheader"] {
  padding: 0 1px;
  border-left: 1px dotted #dddddd;
}

tr.alternate:nth-child(even) {
  background: #e3f2fd;
}
.v-text-field {
  padding-top: 0px;
  /*  */
  margin-top: 4px;
}
</style>
