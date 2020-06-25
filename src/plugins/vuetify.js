import "typeface-roboto";
//import "material-design-icons-iconfont/dist/material-design-icons.css";
import "@mdi/font/css/materialdesignicons.min.css";

import Vue from "vue";
import Vuetify from "vuetify/lib";
import { Ripple } from "vuetify/lib/directives";
Vue.use(Vuetify, {
  directives: {
    Ripple,
  },
});

import zhHans from "vuetify/es5/locale/zh-Hans";
import pl from "vuetify/es5/locale/pl";
import en from "vuetify/es5/locale/en";
import de from "vuetify/es5/locale/de";
import ru from "vuetify/es5/locale/ru";
import pt from "vuetify/es5/locale/pt";
import nl from "vuetify/es5/locale/nl";
import fr from "vuetify/es5/locale/fr";
import it from "vuetify/es5/locale/it";
import es from "vuetify/es5/locale/es";

export default new Vuetify({
  lang: {
    locales: { zhHans, pl, en, de, ru, pt, nl, fr, it, es },
    current: "en",
  },
  icons: {
    iconfont: "mdi",
  },
  icons: {
    iconfont: "mdi",
  },
});
