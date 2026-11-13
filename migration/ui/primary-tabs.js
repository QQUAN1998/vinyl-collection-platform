const TITLES = { home: '唱片柜', add: '搜索添加', stats: '统计' };

// Keep each visited pane mounted: returning home must reuse its image nodes.
module.exports = {
  uiPrimary(tab) {
    if (!['home', 'add', 'stats'].includes(tab) || tab === this.data.uiTab) return;
    const update = { uiTab: tab };
    if (tab !== 'home') update[`uiMounted.${tab}`] = true;
    this.setData(update);
    wx.setNavigationBarTitle({ title: TITLES[tab] });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    if (tab === 'home') this.loadCabinet();
  },
  uiPaneShare(event) {
    if (this.data.uiTab === 'home') return null;
    return this.selectComponent(`#ui-${this.data.uiTab}`)?.onShareAppMessage?.(event);
  }
};
