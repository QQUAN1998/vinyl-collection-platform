Component({
  properties: {
    album: {
      type: Object,
      value: {}
    },
    meta: {
      type: String,
      value: ""
    },
    selected: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    showCheck: {
      type: Boolean,
      value: false
    },
    showArrow: {
      type: Boolean,
      value: false
    },
    compact: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap() {
      if (this.data.disabled) {
        return;
      }

      this.triggerEvent("select", {
        album: this.data.album,
        selected: this.data.selected
      });
    }
  }
});
