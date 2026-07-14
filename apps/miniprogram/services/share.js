const DEFAULT_SHARE = {
  title: "\u5531\u7247\u67dc",
  path: "/pages/cabinet/index",
};

function currentCabinetTitle() {
  try {
    const app = getApp();
    const name = app.globalData.userProfile?.name || "\u5531\u7247\u67dc\u7528\u6237";
    return `${name}的唱片柜`;
  } catch (error) {
    return DEFAULT_SHARE.title;
  }
}

function enableFriendShare() {
  if (typeof wx === "undefined" || typeof wx.showShareMenu !== "function") {
    return;
  }

  wx.showShareMenu({
    withShareTicket: true,
    menus: ["shareAppMessage"],
  });
}

function createShareMessage(options = {}) {
  return {
    ...DEFAULT_SHARE,
    title: currentCabinetTitle(),
    ...options,
  };
}

module.exports = {
  createShareMessage,
  enableFriendShare,
};
