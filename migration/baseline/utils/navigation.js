const navItems = [
  {
    key: "cabinet",
    label: "首页",
    icon: "records",
    pagePath: "/pages/cabinet/index"
  },
  {
    key: "add",
    label: "添加",
    icon: "search",
    pagePath: "/pages/add/index"
  },
  {
    key: "stats",
    label: "统计",
    icon: "chart",
    pagePath: "/pages/stats/index"
  },
  {
    key: "account",
    label: "我的",
    icon: "user",
    pagePath: "/pages/account/index"
  }
];

function getNavItems(activeKey) {
  return navItems.map((item) => ({
    ...item,
    active: item.key === activeKey,
    iconSrc: `/assets/icons/${item.icon}-${item.key === activeKey ? "ink" : "muted"}.png`
  }));
}

module.exports = {
  navItems,
  getNavItems
};
