Component({
  properties: {
    tone: {
      type: String,
      value: "info"
    },
    title: {
      type: String,
      value: ""
    },
    description: {
      type: String,
      value: ""
    },
    actionText: {
      type: String,
      value: ""
    }
  },
  methods: {
    handleAction() {
      this.triggerEvent("action");
    }
  }
});
