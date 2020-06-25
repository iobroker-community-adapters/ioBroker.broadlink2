//import Vue from "vue";

const helper = {
  filters: {
    nFormat(val, places, options) {
      if (
        options === undefined &&
        (typeof places === "object" || typeof places === "string")
      ) {
        options = places;
        places = undefined;
      } else if (!options) options = {};
      else if (typeof options === "string" && places !== undefined)
        options = { postfix: options };
      if (typeof options === "string") {
        const match = options.match(/^([.,?]?)(\d+)?(\;?)(\-[^\+]+)?\+?(.*)$/);
        options = {};
        if (match) {
          if (match[2] === undefined && places === undefined) places = 0;
          else places = Number(match[2]);
          if (match[1]) options.decimalPoint = match[1];
          options.sepThousands = !!match[3];
          if (match[4] && match[4].startsWith("-"))
            options.prefix = match[4].slice(1);
          else options.prefix = "";
          options.postfix = match[5];
        }
      }
      if (places !== undefined) {
        if (!isNaN(Number(places))) places = Number(places);
      } else places = Number(options.digits);
      if (places === undefined || isNaN(places)) places = 0;
      if (options.digits && !isNaN(Number(options.digits)))
        places = Number(options.digits);
      if (options.decimalPoint === "?") {
        options.decimalPoint = mylang == "en" ? "." : ",";
      }
      val = Number(val);
      val = isNaN(val) ? "" : val.toFixed(places).toString();
      if (options.decimalPoint) val = val.replace(".", options.decimalPoint);
      if (options.sepThousands) {
        const del = options.decimalPoint === "," ? "." : ",";
        const dec = del === "," ? "." : ",";
        const spl = val.split(dec);
        val = spl[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1" + del);
        if (spl[1]) val += dec + spl[1].replace(/(\d{3})(?=\d)/g, "$1" + del);
      }
      if (options.prefix) val = options.prefix + " " + val;
      if (options.postfix) val += " " + options.postfix;
      return val;
    },
  },
  methods: {
    async Presolve(val) {
      return Promise.resolve(val);
    },

    numberFormat(val, ...args) {
      if (
        this.$options &&
        this.$options.filters &&
        this.$options.filters["nFormat"]
      )
        return this.$options.filters["nFormat"](val, ...args);
      else return val;
    },

    convCsv(data, options) {
      function splitCSV(str, delimiter, quotes) {
        //split the str first
        //then merge the elments between two double quotes
        delimiter = delimiter || ",";
        quotes = quotes || '"';
        var elements = str.split(delimiter);
        var newElements = [];
        for (var i = 0; i < elements.length; ++i) {
          if (elements[i].indexOf(quotes) >= 0) {
            //the left double quotes is found
            var indexOfRightQuotes = -1;
            var tmp = elements[i];
            //find the right double quotes
            for (var j = i + 1; j < elements.length; ++j) {
              if (elements[j].indexOf(quotes) >= 0) {
                indexOfRightQuotes = j;
                break;
              }
            }
            //found the right double quotes
            //merge all the elements between double quotes
            if (-1 != indexOfRightQuotes) {
              for (var j = i + 1; j <= indexOfRightQuotes; ++j) {
                tmp = tmp + delimiter + elements[j];
              }
              newElements.push(tmp);
              i = indexOfRightQuotes;
            } else {
              //right double quotes is not found
              newElements.push(elements[i]);
            }
          } else {
            //no left double quotes is found
            newElements.push(elements[i]);
          }
        }

        return newElements;
      }
      const { sep, lineSep, noHeader, quotes } = Object.assign(
        { sep: ",", lineSep: "\n", quotes: '"' },
        options || {}
      );
      data = data || "";
      const list = data.split(lineSep).map((i) => i.trim());
      const titles = splitCSV(list[0], sep, quotes).map((i, index) =>
        noHeader ? index : i.trim()
      );
      const res = {};
      for (let i = noHeader ? 0 : 1; i < list.length; i++) {
        const values = splitCSV(list[i], sep, quotes).map((i) => i.trim());
        for (let j = 0; j < titles.length; j++) {
          const name = titles[j];
          if (name) {
            if (!res[name]) res[name] = [];
            const item = res[name];
            const val = values[j];
            item[noHeader ? i : i - 1] =
              val === "0" || Number(val) ? Number(val) : val;
          }
        }
      }
      return res;
    },
  },
};

export default helper;
