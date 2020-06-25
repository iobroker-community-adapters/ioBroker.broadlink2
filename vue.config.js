// process.env.VUE_APP_VERSION = require("./package.json").version;
process.env.VUE_APP_IOBROKER = "localhost:8181";
process.env.VUE_APP_ADAPTERNAME = "broadlink2";

module.exports = {
  transpileDependencies: ["vuetify", "resize-detector"],
  lintOnSave: process.env.NODE_ENV !== "production",

  pluginOptions: {
    i18n: {
      locale: "en",
      fallbackLocale: "en",
      localeDir: "locales",
      enableInSFC: true,
    },
  },

  productionSourceMap: false,
  publicPath: ".",

  css: {
    extract: false,
  },

  outputDir: "admin",
};
