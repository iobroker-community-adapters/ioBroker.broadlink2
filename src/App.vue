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
      </div>
      <v-tabs centered v-model="page">
        <v-tab
          v-for="item in configTranslated"
          v-bind:key="item.label"
          :disabled="item.disabled && !devMode"
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
      />
      <fjFileLoadButton
        @onchange="iobrokerConfig = arguments[0]"
        text
        icon
        small
        :tooltip="$t('Upload Config JSON or drop config file here')"
        img="mdi-briefcase-upload"
        :message="$t('Loaded config!')"
      />
      <fjB
        text
        :disabled="!iobrokerConfigChanged"
        small
        @click.stop="saveAdapterConfig"
        :label="$t('Save')"
        img="mdi-content-save"
        :tooltip="$t('Save current config')"
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
      />
      <fjB
        text
        small
        dense
        :tooltip="$t('cancel and close config')"
        :label="$t('Cancel')"
        img="mdi-close"
        @click.stop="closeAdapterConfig"
      />
    </v-app-bar>

    <v-main id="MyAppContent" class="flex-wrap">
      <fjConfigContainer :cItem="iobrokerConfig" :configPage="configPage" />
      <fjConfirm />
    </v-main>
  </v-app>
</template>

<script>
//import axios from "axios";

// import helper from "./plugins/helper";
import ioBroker from "./plugins/iobroker";
import broadlink from "./plugins/broadlink";

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
  mixins: [ioBroker, broadlink],

  data: () => {
    return {
      page: -1,
      configPage: { items: [] },
      //      tmptext: "",
    };
  },

  //  created() {},
  async beforeMount() {
    this.page = 0;
    this.iobrokerLang = this.iobrokerLang || "en";
    await this.wait(10);
    await this.loadDevList();
    await this.wait(10);
    this.makeConfigPage(0);
    await this.wait(10);
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

  // computed: {},
};
</script>
<style scoped.vue>
html {
  overflow-y: auto !important;
}
</style>
