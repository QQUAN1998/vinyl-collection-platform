// A process-local claim covers cold starts on home and shared routes alike.
let claimed = false;
Component({
  data: { visible: false, ready: false },
  lifetimes: {
    attached() {
      if (claimed) return;
      claimed = true;
      this.setData({ visible: true });
      // A missing asset cannot leave an invisible overlay mounted indefinitely.
      this.entryTimer = setTimeout(() => this.dismiss(), 1600);
    },
    detached() { clearTimeout(this.entryTimer); }
  },
  methods: {
    loaded() {
      if (!this.data.visible || this.data.ready) return;
      clearTimeout(this.entryTimer);
      this.setData({ ready: true });
      this.entryTimer = setTimeout(() => this.dismiss(), 1050);
    },
    dismiss() {
      clearTimeout(this.entryTimer);
      this.setData({ visible: false });
    }
  }
});
