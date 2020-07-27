<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
      dense
      elevate-on-scroll
      scroll-target="#MyAppContent"
    >
      <div class="d-flex align-center">
        <v-img
          :alt="iobrokerAdapter"
          class="shrink mr-2"
          contain
          :src="adapterIcon"
          width="35"
        />
        <fjB
          :href="iobrokerReadme"
          target="_blank"
          text
          img="mdi-help-circle-outline"
          :tooltip="$t('Goto readme for {0}', [iobrokerAdapter])"
          :label="
            iobrokerAdapterInstance +
            ' v(' +
            iobrokerAdapterCommon.version +
            ')'
          "
          class="text-none"
        />
        <fjB
          :color="['red', 'orange', 'green'][adapterStatus]"
          :img="
            ['mdi-play-circle', 'mdi-pause-circle', 'mdi-pause-octagon'][
              adapterStatus
            ]
          "
          @click="enableDisableInstance(!adapterStatus)"
          :tooltip="adapterStatus ? $t('stop adapter') : $t('start adapter')"
        />
        <fjB
          :disabled="!adapterStatus"
          color="warning"
          img="mdi-refresh"
          @click="enableDisableInstance('restart')"
          :tooltip="$t('restart adapter')"
        />
      </div>
      <v-tabs v-model="page">
        <v-tab
          v-for="item in configTranslated"
          v-bind:key="item.label"
          :disabled="item.disabled && !devMode"
          class="text-none"
        >
          <v-icon v-if="item.icon" left small>{{ item.icon }}</v-icon>
          <span>{{ item.label }}</span>
        </v-tab>
      </v-tabs>
      <v-spacer></v-spacer>
      <fjFileSaveButton
        :content="iobrokerConfigD()"
        :opts="{ type: 'JSON', basename: iobrokerAdapter + '-config' }"
        icon
        small
        text
        :tooltip="
          $t('Download Config JSON or shift-click to copy to clipboard')
        "
        img="mdi-briefcase-download"
        class="text-none"
      />
      <fjFileLoadButton
        @onchange="iobrokerConfig = arguments[0]"
        text
        icon
        small
        :tooltip="$t('Upload Config JSON or drop config file here')"
        img="mdi-briefcase-upload"
        :message="$t('Loaded config!')"
        class="text-none"
      />
      <fjB
        text
        :disabled="!iobrokerConfigChanged"
        small
        @click.stop="saveAdapterConfig"
        :label="$t('Save')"
        img="mdi-content-save"
        :tooltip="$t('Save current config')"
        class="text-none"
      />
      <fjAlerts :offsetX="0" :offsetY="20" />
      <fjB
        text
        small
        @click.stop="saveAndClose"
        :disabled="!iobrokerConfigChanged"
        dense
        :tooltip="$t('Save settings and close config')"
        :label="$t('Save&Close')"
        img="mdi-content-save-move"
        class="text-none"
      />
      <fjB
        text
        small
        dense
        :tooltip="$t('cancel and close config')"
        :label="$t('Cancel')"
        img="mdi-close"
        @click.stop="closeAdapterConfig"
        class="text-none"
      />
    </v-app-bar>

    <v-main id="MyAppContent" class="flex-wrap">
      <fjConfigContainer :cItem="iobrokerConfig" :configPage="configPage" />
      <fjConfirm />
      <v-simple-table v-if="!page" dense class="elevation-2 xa-1">
        <template v-slot:default>
          <thead>
            <tr>
              <th class="text-left">Adapter log Time@Severity</th>
              <th class="text-left">
                {{ $t("Messages:") + " " + adapterLog.length + " " }}
                <fjB
                  label="Clear"
                  img="mdi-delete-forever"
                  right
                  x-small
                  @click="adapterLog.splice(1)"
                  tooltip="delete all but last message"
                />
                <v-text-field
                  dense
                  flat
                  hide-details
                  hint="Enter filter Text:"
                  v-model="markRed"
                  label="Filter:"
                  class="caption"
                  clearable
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in adapterLogFiltered"
              :key="index.toString() + item.ts.toString()"
            >
              <td :class="'height24 caption ' + sevColor(item)">
                {{ timeStamp(item.ts) + "/" + item.severity }}
              </td>
              <td :class="'height24 caption ' + sevColor(item)">
                {{ item.message }}
              </td>
            </tr>
          </tbody>
        </template>
      </v-simple-table>
      <fjStateSelector v-model="testSel" />
      {{ testSel }}
    </v-main>
  </v-app>
</template>

<script>
//import axios from "axios";

// import helper from "./plugins/helper";
import Vue from "vue";
// import ioBroker from "./plugins/iobroker";
import broadlink from "./plugins/broadlink";

import fjStateSelector from "./components/fjStateSelector";

Vue.component("fjStateSelector", fjStateSelector);

// let what = null;
// console.log(process.env);
/*
function fix(number, digits, min, max) {
  min = min || Number.NEGATIVE_INFINITY;
  max = max || Number.POSITIVE_INFINITY;
  number = number < min ? min : number;
  number = number > max ? max : number;
  return Number(number.toFixed(digits === undefined ? 3 : digits));
}
*/

export default {
  name: "App",
  mixins: [broadlink],

  data: () => {
    return {
      page: -1,
      configPage: { items: [] },
      markRed: "",
      testSel: [],
      //      tmptext: "",
    };
  },

  created() {
    Vue.prototype.$app = this;
  },

  async beforeMount() {
    this.page = 0;
    this.iobrokerLang = this.iobrokerLang || "en";
    await this.wait(10);
    await this.loadDevList();
    await this.wait(10);
    this.makeConfigPage(0);
    await this.wait(10);
    //    console.log(await this.loadInterfaces());
  },
  // async mounted() {},
  //  filters: {},

  methods: {
    // setTmp(res, add) {
    //   const newT =
    //     typeof res == "number" || typeof res == "string"
    //       ? res
    //       : JSON.stringify(res, null, 2);
    //   if (add) this.tmptext += "\n" + newT;
    //   else this.tmptext = "" + newT;
    // },

    sevColor(item) {
      const sev = item.severity;
      let color = "primary";
      switch (sev) {
        case "warning":
        case "error":
          color = sev;
          break;
        case "debug":
          color = "grey";
          break;
        case "info":
          if (item.message.indexOf(" debug: ") >= 0) color = "grey";
        default:
          break;
      }
      return color + " lighten-4";
    },

    timeStamp(ts) {
      function digits(v, p) {
        p = p || 2;
        v = v.toString();
        while (v.length < p) v = "0" + v;
        return v;
      }
      const d = new Date(ts);
      return `${digits(d.getHours())}:${digits(d.getMinutes())}:${digits(
        d.getSeconds()
      )}.${digits(d.getMilliseconds(), 3)}`;
    },

    makeConfigPage(page) {
      const cp = Object.assign(
        {},
        this.copyObject(this.configTranslated[page] || {})
      );
      // console.log(
      //   "MakeConfigPage:",
      //   page,
      //   this.configTranslated,
      //   this.configTranslated[page]
      // );
      this.configPage = {};
      const items = cp.items;
      // this.$set(this.configPage, "items", []);
      this.$set(this.configPage, "page", page);
      this.$set(this.configPage, "items", items);
      // for (const i in items) this.configPage.items.splice(i, 1, items[i]);
      //      return this.wait(10).then(() => this.$forceUpdate());
      //      console.log("MakeConfigPage:", this.configPage);
      return this.configPage;
    },
  },

  watch: {
    page(newV) {
      this.wait(10).then(() => this.makeConfigPage(Number(newV)));
    },
    configTranslated: {
      handler: function () {
        this.wait(10).then(() => this.makeConfigPage(Number(this.page)));
      },
      deep: true,
    },
  },

  computed: {
    adapterLogFiltered() {
      const log = this.adapterLog;
      const filter = this.markRed ? this.markRed.toLowerCase() : null;
      return filter
        ? log.filter((i) => i.message.toLowerCase().indexOf(filter) >= 0)
        : log;
    },
  },
};
</script>
<style scoped.vue>
.height24 {
  height: 22px !important;
}
html {
  overflow-y: auto !important;
}
</style>
