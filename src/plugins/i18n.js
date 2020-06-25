import Vue from "vue";
import VueI18n from "vue-i18n";
import words from "./words";

Vue.use(VueI18n);

function loadLocaleMessages(words, messages) {
  messages = messages || {};
  for (const keys of Object.keys(words))
    for (const langs of Object.keys(words[keys]))
      if (messages[langs]) messages[langs][keys] = words[keys][langs];
      else
        messages[langs] = {
          [keys]: words[keys][langs],
        };

  /*   const locales = require.context(
      "./locales",
      true,
      /[A-Za-z0-9-_,\s]+\.json$/i
    );
    const messages = {};
    locales.keys().forEach((key) => {
      debugger;
      const matched = key.match(/([A-Za-z0-9-_]+)\./i);
      if (matched && matched.length > 1) {
        const locale = matched[1];
        messages[locale] = locales(key);
      }
    });
   */

  return messages;
}

async function loadwordsjson(file, messages) {
  try {
    const wj = await fetch(file)
      .then((res) => {
        return res.json();
      })
      .catch((err) => (console.log("loadwords fetch", file, err), null));
    if (wj) loadLocaleMessages(wj, messages);
  } catch (e) {
    console.log("loadwords err", e);
  }
}

const messages = loadLocaleMessages(words);
loadwordsjson("./words.json", messages);
const i18nOptions = {
  locale: process.env.VUE_APP_I18N_LOCALE || "en",
  fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
  messages: messages,
  silentTranslationWarn: true,
};
const i18n = new VueI18n(i18nOptions);

const missing = {};
Vue.prototype.$missing = missing;
i18n.loadLocaleMessages = loadLocaleMessages;
i18n.missing = (lang, key, vm, values) => {
  //  if (i18n.te(key, i18n.fallbackLocale)) {
  //    return i18n.t(key, i18n.fallbackLocale).toString();
  //  }
  //
  const fb = i18nOptions.fallbackLocale;
  function getKey() {
    if (words[key] && words[key][lang]) return words[key][lang];
    /*     if (!missing[key] || !missing[key][lang]) {
      //    console.log(`missing for lang (${lang}): '${key}'`);
      if (missing[key]) missing[key][lang] = null;
      else
        missing[key] = 
          [lang]: null,
        };
    }
 */ if (
      words[key] &&
      words[key][fb]
    ) {
      if (missing[key] && !missing[key][lang]) missing[key][lang] = key;
      else if (!missing[key])
        missing[key] = {
          [lang]: key,
        };
      return words[key][fb];
    } else if (!missing[key] || !missing[key][fb]) {
      //    console.log(`missing for lang (${lang}): '${key}'`);
      if (missing[key]) missing[key][fb] = key;
      else
        missing[key] = {
          [fb]: key,
        };
    }
    return key; // instead of showing the key + warning
  }

  let nk = getKey() || "!undefined i18n key!";
  let m;
  if (typeof nk == "string")
    nk = nk.replace(/\{([\d\w_]+)\}/g, (match, p1) => values[p1.trim()]);
  else return "!undefined i18n key!";
  return nk;
};

export default i18n;
