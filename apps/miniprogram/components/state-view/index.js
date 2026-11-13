const uiLocale=require("../../ui/locale-runtime");
Component(uiLocale.component({
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
}));
