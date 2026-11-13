Component({
  properties: { current: { type: String, value: 'vinyl' } },
  methods: {
    open() {
      if (this.switching) return;
      this.switching = true;
      wx.showActionSheet({
        itemList: ['唱片柜', '演出集'],
        success: ({ tapIndex }) => {
          const current = this.properties.current === 'live' ? 1 : 0;
          if (current === tapIndex) return;
          wx.reLaunch({
            url: tapIndex === 1 ? '/packages/live-archive/pages/index/index' : '/pages/cabinet/index',
            fail: () => wx.showToast({ title: '切换失败，请重试', icon: 'none' })
          });
        },
        complete: () => { this.switching = false; }
      });
    }
  }
});
