<template>
  <div class="pa-0 elevation-2 fluid xs-12 xl-12">
    <v-toolbar dark height="36" color="primary">
      <v-icon left v-if="icon">{{ icon }}</v-icon>
      <v-toolbar-title class="subtitle-2">{{
        `${adapterName}.${adapterInstance}&nbsp;${$t("log entries")}:&nbsp;${
          adapterLog.length
        }&nbsp;`
      }}</v-toolbar-title>
      <v-spacer />
      <v-text-field
        v-model="markRed"
        class="body-1"
        append-icon="mdi-filter"
        :label="$t('Filter')"
        single-line
        hide-details
        dense
      ></v-text-field
      ><v-spacer>&#x2060;</v-spacer>
      <fjB
        label="Clear"
        text
        img="mdi-delete-forever"
        small
        @click="adapterLog.splice(1)"
        tooltip="delete all but last message"
      />
      <fjB
        label="To Clipboard"
        text
        img="mdi-clipboard-plus-outline"
        small
        @click="clipboard"
        tooltip="copy filtered items to clipboard"
      />
      <fjB
        label="Show lines -5"
        text
        img="mdi-format-indent-decrease"
        small
        @click="changeMax(-5)"
        tooltip="reduse number of shown lines by 5"
      />
      {{ myMax }}
      <fjB
        label="Show lines +5"
        text
        img="mdi-format-indent-increase"
        small
        @click="changeMax(+5)"
        tooltip="increase number of shown lines by 5"
      />
    </v-toolbar>
    <v-simple-table
      dense
      class="elevation-2 xa-1"
      :style="`display: block; max-height: ${
        64 + myMax * 24
      }px; overflow: auto; width: 100%;`"
    >
      <template v-slot:default>
        <thead>
          <tr>
            <th class="text-left">Time/Severity</th>
            <th class="text-left">{{ $t("Log Message") }}</th>
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
  </div>
</template>

<script>
export default {
  name: "fjIoBrokerLog",

  //  inheritAttrs: false,
  props: {
    showMax: {
      type: Number,
      default: 25,
    },
    icon: { type: String, required: false, default: "mdi-playlist-star" },
  },
  data() {
    return {
      markRed: "",
      myMax: 25,
    };
  },
  computed: {
    adapterLog() {
      return this.$store.state.adapterLog;
    },
    adapterInstance() {
      return this.$store.state.iobrokerInstance;
    },
    adapterName() {
      return this.$store.state.iobrokerAdapter;
    },
    adapterLogFiltered() {
      const log = this.adapterLog;
      const filter = this.markRed ? this.markRed.toLowerCase() : null;
      return filter
        ? log.filter((i) => i.message.toLowerCase().indexOf(filter) >= 0)
        : log;
    },
  },
  //  watch: {},
  methods: {
    clipboard(e) {
      let s = "";
      for (const loge of this.adapterLogFiltered)
        s +=
          this.timeStamp(loge.ts) +
          "/" +
          loge.severity +
          "\t" +
          loge.message +
          "\n";
      this.$copyText(s);
      return this.$alert(this.$t("Copied filtered log to clipboard!"));
    },
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

    changeMax(val) {
      if (this.myMax + val < 5) this.myMax = 5;
      else if (this.myMax + val > 100) this.myMax = 100;
      else this.myMax += val;
    },
  },
  //  created() {},
  mounted() {
    this.myMax = this.showMax;
  },
  //  unmounted() {},
};
</script>
