Component({
  properties: {
    label: {
      type: String,
      value: "收藏形式",
    },
    options: {
      type: Array,
      value: [],
    },
    selectedKey: {
      type: String,
      value: "vinyl",
    },
  },
  methods: {
    handleSelect(event) {
      const { key } = event.currentTarget.dataset;
      this.triggerEvent("change", {
        value: key,
      });
    },
  },
});
