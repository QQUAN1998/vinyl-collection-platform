const DEFAULT_SHARE = {
  title: "David的唱片柜",
  path: "/pages/cabinet/index",
};

function currentCabinetTitle() {
  try {
    const app = getApp();
    const name = app.globalData.userProfile?.name || "David";
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
