<template>
  <span v-if="render"><slot></slot>{{ ago | ago }}</span>
</template>

<script>
export default {
  name: "fjTimerResfresh",

  data() {
    return {
      timeout: null,
      render: true,
    };
  },

  props: {
    seconds: {
      type: String,
      default: "5",
    },
    ago: {
      type: [String, Number],
      default: Date.now(),
    },
  },

  methods: {
    async refresh() {
      //      console.log(Date.now(), Math.floor((Date.now() - this.ago) / 1000));
      this.render = false;
      await this.$nextTick();
      await this.$nextTick();
      this.render = true;
    },
  },

  mounted() {
    const tout = 1000 * (Number(this.seconds) || 5);
    this.timeout = setInterval((_) => this.refresh(), tout);
  },

  beforeDestroy() {
    if (this.timeout) clearInterval(this.timeout);
    this.timeout = null;
  },
};
</script>
