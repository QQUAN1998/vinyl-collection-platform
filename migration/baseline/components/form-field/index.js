Component({
  properties: {
    label: {
      type: String,
      value: ""
    },
    value: {
      type: String,
      value: ""
    },
    placeholder: {
      type: String,
      value: ""
    },
    type: {
      type: String,
      value: "text"
    },
    mode: {
      type: String,
      value: "input"
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleInput(event) {
      this.triggerEvent("change", {
        value: event.detail.value
      });
    }
  }
});
