Component({
  properties: {
    album: {
      type: Object,
      value: {}
    },
    eyebrow: {
      type: String,
      value: ""
    },
    size: {
      type: String,
      value: "default"
    }
  },
  methods: {
    handleTap() {
      this.triggerEvent("open", {
        album: this.data.album
      });
    }
  }
});
