const PRIMARY = {
  '/pages/cabinet/index': 'home',
  '/pages/add/index': 'add',
  '/pages/stats/index': 'stats'
};

function openFromHome(url, api) {
  const fail = () => api.showToast({ title: '打开失败，请重试', icon: 'none' });
  const tab = PRIMARY[url];
  if (!tab) return api.navigateTo({ url, fail });
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const home = pages.findIndex(page => page.route === 'pages/cabinet/index' && typeof page.uiPrimary === 'function');
  if (home >= 0) {
    const activate = () => pages[home].uiPrimary(tab);
    const delta = pages.length - home - 1;
    if (delta) return api.navigateBack({ delta, success: activate, fail });
    return activate();
  }
  api.redirectTo({ url: '/pages/cabinet/index' + (tab === 'home' ? '' : '?tab=' + tab), fail });
}

module.exports = { openFromHome };
