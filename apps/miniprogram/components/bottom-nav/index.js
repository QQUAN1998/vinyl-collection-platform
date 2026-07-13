const { getNavItems } = require("../../utils/navigation.js");

Component({
  properties: {
    active: {
      type: String,
      value: "cabinet"
    }
  },
  data: {
    navItems: []
  },
  lifetimes: {
    attached() {
      this.setData({
        navItems: getNavItems(this.data.active)
      });
    }
  },
  observers: {
    active(active) {
      this.setData({
        navItems: getNavItems(active)
      });
    }
  },
  methods: {
    handleTap(event) {
      const { item } = event.currentTarget.dataset;
      if (!item || item.active) {
        return;
      }

      wx.redirectTo({
        url: item.pagePath
      });
    }
  }
});
