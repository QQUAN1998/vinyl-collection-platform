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
    menus: ["shareAppMessage", "shareTimeline"],
  });
}

function createShareMessage(options = {}) {
  return {
    ...DEFAULT_SHARE,
    title: currentCabinetTitle(),
    ...options,
  };
}

function pathToTimelineQuery(path) {
  if (typeof path !== "string") {
    return "";
  }

  const queryStart = path.indexOf("?");
  if (queryStart === -1 || queryStart === path.length - 1) {
    return "";
  }

  return path.slice(queryStart + 1);
}

function createShareTimeline(options = {}) {
  const message = createShareMessage(options);
  const query = options.query || pathToTimelineQuery(message.path);
  const timeline = {
    title: message.title || DEFAULT_SHARE.title,
  };

  if (query) {
    timeline.query = query;
  }
  if (message.imageUrl) {
    timeline.imageUrl = message.imageUrl;
  }

  return timeline;
}

module.exports = {
  createShareMessage,
  createShareTimeline,
  enableFriendShare,
};
