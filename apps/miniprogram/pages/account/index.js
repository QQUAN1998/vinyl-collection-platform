const { albums } = require("../../data/seed.js");
const { calculateCollectionStats } = require("../../services/stats-service.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage } = require("../../services/share.js");

const tvStatusLabels = {
  active: "已绑定",
  syncing: "同步中",
  failed: "同步失败",
  unbound: "未绑定"
};

Page({
  data: {
    userLabel: "SETTINGS",
    userProfile: {
      name: "David",
      avatar: "",
      bio: ""
    },
    avatarInitial: "D",
    tierLabel: "普通",
    collectionLimitText: "普通用户可加载10张",
    summary: {
      albumCount: 0,
      artistCount: 0
    },
    tvBinding: null,
    tvStatus: "unbound",
    tvStatusLabel: tvStatusLabels.unbound,
    tvDeviceName: "未绑定电视",
    tvMeta: tvStatusLabels.unbound
  },
  onShow() {
    this.loadAccount();
  },
  loadAccount() {
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    const stats = calculateCollectionStats(albums, collectionItems);
    const tvBinding = (app.globalData.tvBindings || []).find((binding) => binding.userId === app.globalData.userId) || null;
    const tvStatus = tvBinding ? tvBinding.status : "unbound";

    const userProfile = app.globalData.userProfile || this.data.userProfile;

    this.setData({
      userLabel: "SETTINGS",
      userProfile,
      avatarInitial: (userProfile.name || "D").slice(0, 1).toUpperCase(),
      tierLabel: stats.albumCount > 10 ? "VIP" : "普通",
      collectionLimitText: stats.albumCount > 10 ? "收藏上限 10,000 张" : `普通用户可加载10张 · 当前 ${stats.albumCount} 张`,
      summary: {
        albumCount: stats.albumCount,
        artistCount: stats.artistCount
      },
      tvBinding,
      tvStatus,
      tvStatusLabel: tvStatusLabels[tvStatus] || tvStatusLabels.unbound,
      tvDeviceName: tvBinding ? tvBinding.deviceName : "未绑定电视",
      tvMeta: tvBinding && tvBinding.lastSyncedAt
        ? `${tvStatusLabels[tvStatus] || tvStatusLabels.unbound} · ${tvBinding.lastSyncedAt}`
        : tvStatusLabels[tvStatus] || tvStatusLabels.unbound
    });
  },
  openUserProfile() {
    const app = getApp();
    if (typeof wx.getUserProfile === "function") {
      wx.getUserProfile({
        desc: "用于同步微信头像和昵称到唱片柜资料",
        success: (result) => {
          app.updateWechatProfile(result.userInfo);
          this.loadAccount();
          wx.navigateTo({
            url: "/pages/user-profile/index"
          });
        },
        fail: () => {
          wx.navigateTo({
            url: "/pages/user-profile/index"
          });
        }
      });
      return;
    }

    wx.navigateTo({
      url: "/pages/user-profile/index"
    });
  },
  manualSync() {
    const app = getApp();
    this.setData({
      tvStatus: "syncing",
      tvStatusLabel: tvStatusLabels.syncing,
      tvMeta: tvStatusLabels.syncing
    });

    const result = triggerTvSync(app.globalData.tvBindings || [], app.globalData.userId);
    app.globalData.tvBindings = result.bindings;
    this.loadAccount();

    wx.showToast({
      title: "已同步",
      icon: "success"
    });
  },
  showPlaceholder(event) {
    const { title } = event.currentTarget.dataset;
    wx.showToast({
      title,
      icon: "none"
    });
  },
  openUserGuide() {
    wx.navigateTo({
      url: "/pages/user-guide/index"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
