// Adapt existing page controllers without duplicating search or statistics logic.
// A hidden pane stays mounted, but its timers and visible lifecycle are suspended.
module.exports = function registerPane(spec) {
  const methods = Object.fromEntries(
    Object.entries(spec).filter(([, value]) => typeof value === 'function')
  );
  function syncVisibility() {
    const visible = this.data.visible && !this.uiPageHidden;
    if (visible === this.uiPaneVisible) return;
    this.uiPaneVisible = visible;
    if (visible) spec.onShow?.call(this);
    else {
      this.cancelOnlineSearch?.();
      spec.onHide?.call(this);
    }
  }
  Component({
    options: { styleIsolation: 'apply-shared' },
    properties: { visible: { type: Boolean, value: false } },
    data: spec.data,
    methods,
    observers: { visible() { if (this.uiPaneReady) syncVisibility.call(this); } },
    lifetimes: {
      attached() {
        this.options = {};
        spec.onLoad?.call(this, this.options);
        this.uiPaneReady = true;
        syncVisibility.call(this);
      },
      detached() {
        this.cancelOnlineSearch?.();
        spec.onUnload?.call(this);
      }
    },
    pageLifetimes: {
      show() { this.uiPageHidden = false; if (this.uiPaneReady) syncVisibility.call(this); },
      hide() { this.uiPageHidden = true; if (this.uiPaneReady) syncVisibility.call(this); }
    }
  });
};
