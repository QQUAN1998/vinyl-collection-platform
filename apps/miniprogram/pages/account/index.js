const { albums } = require("../../data/seed.js");
const {
  DEFAULT_PROFILE_NAME,
  cleanProfileNameValue,
  formatProfileDisplayName
} = require("../../services/account-profile-service.js");
const { calculateCollectionStats } = require("../../services/stats-service.js");
const {
  ONBOARDING_EXAMPLE_QUERY,
  ONBOARDING_STEPS,
  markOnboardingSeen,
  shouldShowNewUserOnboarding
} = require("../../services/onboarding-service.js");
const { bindTvLoginSession, triggerTvSync, unbindTvLoginSession } = require("../../services/tv-sync-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  exportCollectionMarkdownFile,
  shareMarkdownFile
} = require("../../services/collection-export-service.js");
const { confirmTvLoginWithQr, parseTvLoginQr } = require("../../services/tv-login-service.js");

const tvStatusLabels = {
  active: "已绑定",
  syncing: "同步中",
  failed: "同步失败",
  unbound: "未绑定"
};

function formatTvLoginFailureMessage(error) {
  const message = error && error.message ? error.message : "TV login confirm failed.";
  return Array.from(message).slice(0, 180).join("");
}

function showTvLoginFailure(error) {
  const detail = formatTvLoginFailureMessage(error);
  if (typeof wx.showModal === "function") {
    wx.showModal({
      title: "电视未确认",
      content: `请刷新电视二维码后再试。\n诊断：${detail}`,
      showCancel: false,
      confirmText: "知道了"
    });
    return;
  }

  wx.showToast({
    title: "电视未确认，请重试",
    icon: "none"
  });
}

Page({
  data: {
    userLabel: "SETTINGS",
    userProfile: {
      name: "\u5531\u7247\u67dc\u7528\u6237",
      avatar: "",
      bio: ""
    },
    displayProfileName: "\u5531\u7247\u67dc\u7528\u6237",
    avatarInitial: "D",
    tierLabel: "用户",
    collectionLimitText: "已收藏 0 张",
    summary: {
      albumCount: 0,
      artistCount: 0
    },
    tvBinding: null,
    tvStatus: "unbound",
    tvStatusLabel: tvStatusLabels.unbound,
    tvDeviceName: "未绑定电视",
    tvMeta: tvStatusLabels.unbound,
    tvCanUnbind: false,
    authStatusLabel: "未登录",
    authActionLabel: "连接微信账号",
    authLoading: false,
    loggedIn: false,
    hasSyncedWechatProfile: false,
    showProfileSyncInline: false,
    profileActionLabel: "授权微信登录",
    profileHintLabel: "登录后收藏和上墙会跟随你的账号",
    profileDraftName: "",
    profileDraftAvatar: "",
    themeSummary: "标准模式",
    showOnboardingGuide: false,
    onboardingSteps: ONBOARDING_STEPS
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadAccount();
  },
  loadAccount() {
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    const stats = calculateCollectionStats(albums, collectionItems);
    const tvBinding = (app.globalData.tvBindings || []).find((binding) => binding.userId === app.globalData.userId) || null;
    const tvStatus = tvBinding ? tvBinding.status : "unbound";

    const userProfile = app.globalData.userProfile || this.data.userProfile;
    const auth = app.globalData.auth || {};
    const me = auth.me || {};
    const authUser = me.user || {};
    const themeViewData = typeof app.getThemeViewData === "function" ? app.getThemeViewData() : null;
    const loggedIn = Boolean(auth.loggedIn && authUser.id);
    const serverDisplayName = cleanProfileNameValue(authUser.displayName);
    const savedProfileName = cleanProfileNameValue(userProfile.name);
    const currentDraftName = cleanProfileNameValue(this.data.profileDraftName);
    const hasSyncedWechatProfile = loggedIn && (
      (serverDisplayName && serverDisplayName !== DEFAULT_PROFILE_NAME)
        || (savedProfileName && savedProfileName !== DEFAULT_PROFILE_NAME)
        || Boolean(authUser.avatarUrl || userProfile.avatar)
    );
    const profileDraftName = currentDraftName || (hasSyncedWechatProfile ? savedProfileName : "");
    const profileDraftAvatar = this.data.profileDraftAvatar || userProfile.avatar || "";
    const visibleProfile = loggedIn ? {
      ...userProfile,
      name: profileDraftName || savedProfileName || DEFAULT_PROFILE_NAME,
      avatar: profileDraftAvatar || userProfile.avatar || ""
    } : {
      name: DEFAULT_PROFILE_NAME,
      avatar: "",
      bio: ""
    };
    const showProfileSyncInline = loggedIn && !hasSyncedWechatProfile;
    const collectionLimitText = `已收藏 ${stats.albumCount} 张`;

    this.setData({
      userLabel: "SETTINGS",
      userProfile: visibleProfile,
      displayProfileName: formatProfileDisplayName(visibleProfile.name),
      avatarInitial: (visibleProfile.name || "D").slice(0, 1).toUpperCase(),
      tierLabel: "用户",
      collectionLimitText,
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
        : tvStatusLabels[tvStatus] || tvStatusLabels.unbound,
      tvCanUnbind: Boolean(tvBinding),
      authStatusLabel: hasSyncedWechatProfile ? "已同步微信资料" : loggedIn ? "已登录" : "未登录",
      authActionLabel: loggedIn ? "同步微信资料" : "授权微信登录",
      authLoading: Boolean(auth.loading || auth.loginPromise),
      loggedIn,
      hasSyncedWechatProfile,
      showProfileSyncInline,
      profileActionLabel: !loggedIn
        ? "授权微信登录"
        : showProfileSyncInline
          ? "保存微信资料"
          : "编辑资料",
      profileHintLabel: !loggedIn
        ? "登录后收藏和上墙会跟随你的账号"
        : showProfileSyncInline
          ? "点头像和昵称，完成微信资料同步"
          : collectionLimitText,
      profileDraftName,
      profileDraftAvatar,
      themeSummary: themeViewData ? themeViewData.label : "标准模式"
    });
  },
  stopTap() {},
  handleProfileCardTap() {
    if (!this.data.loggedIn) {
      this.handleLogin();
      return;
    }
    if (this.data.showProfileSyncInline) {
      wx.showToast({
        title: "先选头像或填昵称",
        icon: "none"
      });
      return;
    }
    this.openUserProfile();
  },
  handleProfileNicknameInput(event) {
    const profileDraftName = cleanProfileNameValue(event.detail.value);
    this.setData({
      profileDraftName,
      userProfile: {
        ...this.data.userProfile,
        name: profileDraftName || DEFAULT_PROFILE_NAME
      },
      displayProfileName: profileDraftName
        ? formatProfileDisplayName(profileDraftName)
        : DEFAULT_PROFILE_NAME,
      avatarInitial: (profileDraftName || DEFAULT_PROFILE_NAME).slice(0, 1).toUpperCase()
    });
  },
  handleProfileAvatarChosen(event) {
    const profileDraftAvatar = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : "";
    if (!profileDraftAvatar) return;

    this.setData({
      profileDraftAvatar,
      userProfile: {
        ...this.data.userProfile,
        avatar: profileDraftAvatar
      }
    });
  },
  saveWechatProfileDraft() {
    if (!this.data.loggedIn) {
      this.handleLogin();
      return;
    }

    const nickName = cleanProfileNameValue(this.data.profileDraftName);
    const avatarUrl = this.data.profileDraftAvatar || "";
    if (!nickName && !avatarUrl) {
      wx.showToast({
        title: "先选头像或填昵称",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    this.setData({ authLoading: true });
    app.syncWechatProfile({ nickName, avatarUrl })
      .then((me) => {
        if (!me) {
          this.loadAccount();
          return;
        }
        this.setData({
          profileDraftName: "",
          profileDraftAvatar: ""
        });
        this.loadAccount();
        wx.showToast({
          title: "已同步",
          icon: "success"
        });
      })
      .finally(() => {
        this.setData({ authLoading: false });
      });
  },
  handleLogin() {
    const app = getApp();
    this.setData({ authLoading: true });

    app.requireWechatAccount()
      .then((me) => {
        this.loadAccount();
        if (app.isCloudAccountReady()) {
          wx.showToast({
            title: this.data.hasSyncedWechatProfile ? "\u5df2\u767b\u5f55" : "\u5df2\u767b\u5f55\uff0c\u8bf7\u540c\u6b65\u8d44\u6599",
            icon: "success"
          });
        }
        this.showOnboardingGuideIfNeeded(me || app.globalData.auth.me);
      })
      .finally(() => {
        this.setData({ authLoading: false });
      });
  },
  showOnboardingGuideIfNeeded(me) {
    if (!shouldShowNewUserOnboarding(me)) {
      return;
    }

    this.setData({ showOnboardingGuide: true });
  },
  dismissOnboardingGuide() {
    const userId = getApp().globalData.userId;
    markOnboardingSeen(userId);
    this.setData({ showOnboardingGuide: false });
  },
  startOnboardingGuide() {
    const userId = getApp().globalData.userId;
    markOnboardingSeen(userId);
    this.setData({ showOnboardingGuide: false }, () => {
      wx.navigateTo({
        url: `/pages/user-guide/index?mode=onboarding&query=${encodeURIComponent(ONBOARDING_EXAMPLE_QUERY)}`
      });
    });
  },
  openUserProfile() {
    const app = getApp();
    app.requireWechatAccount({
      desc: "用于同步微信头像和昵称到唱片柜资料"
    }).then((me) => {
      this.loadAccount();
      if (!me) {
        return;
      }
      wx.navigateTo({
        url: "/pages/user-profile/index"
      });
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
  unbindTvSync() {
    const app = getApp();
    const binding = this.data.tvBinding;
    if (!binding) {
      wx.showToast({
        title: "暂无绑定电视",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "退出电视同步",
      content: "退出后，小程序会忘记这台电视；电视端可在电视上重新扫码同步。",
      confirmText: "退出同步",
      confirmColor: "#8b4f3d",
      success: (result) => {
        if (!result.confirm) return;
        const unbindResult = unbindTvLoginSession(
          app.globalData.tvBindings || [],
          app.globalData.userId,
          binding.deviceCode
        );
        app.globalData.tvBindings = unbindResult.bindings;
        this.loadAccount();
        wx.showToast({
          title: "已退出同步",
          icon: "success"
        });
      }
    });
  },
  scanTvLogin() {
    const app = getApp();
    let loadingShown = false;
    app.requireWechatAccount()
      .then((me) => {
        if (!me) return null;
        return this.scanTvCode();
      })
      .then((scanResult) => {
        if (!scanResult || !scanResult.result) return null;
        const parsed = parseTvLoginQr(scanResult.result);
        wx.showLoading({ title: "绑定电视中" });
        loadingShown = true;
        return confirmTvLoginWithQr(scanResult.result, app, albums, app.globalData.cloud)
          .then((result) => {
            const bindResult = bindTvLoginSession(app.globalData.tvBindings || [], app.globalData.userId, parsed);
            app.globalData.tvBindings = bindResult.bindings;
            this.loadAccount();
            wx.hideLoading();
            loadingShown = false;
            wx.showToast({
              title: `已同步 ${result.syncedAlbumCount || 0} 张`,
              icon: "success"
            });
            return result;
          })
          .catch((error) => {
            wx.hideLoading();
            loadingShown = false;
            const failureMessage = formatTvLoginFailureMessage(error);
            app.globalData.cloud = {
              ...(app.globalData.cloud || {}),
              lastTvLoginError: failureMessage
            };
            showTvLoginFailure(error);
            return null;
          });
      })
      .catch((error) => {
        if (error && error.errMsg && error.errMsg.indexOf("cancel") >= 0) {
          return;
        }
        wx.showToast({
          title: error && error.message ? error.message : "电视绑定失败",
          icon: "none"
        });
      })
      .finally(() => {
        if (loadingShown) {
          wx.hideLoading();
        }
      });
  },
  scanTvCode() {
    if (!wx.scanCode) {
      wx.showToast({
        title: "当前微信版本不支持扫码",
        icon: "none"
      });
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      wx.scanCode({
        onlyFromCamera: false,
        scanType: ["qrCode"],
        success: resolve,
        fail: reject
      });
    });
  },
  openBatchImport() {
    wx.navigateTo({
      url: "/pages/batch-input/index"
    });
  },
  exportCollectionMarkdown() {
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    if (!collectionItems.length) {
      wx.showToast({
        title: "暂无收藏可导出",
        icon: "none"
      });
      return;
    }

    wx.showLoading({ title: "生成文件中" });
    exportCollectionMarkdownFile({
      ownerName: (app.globalData.userProfile && app.globalData.userProfile.name) || "唱片柜用户",
      albums,
      manualAlbums: app.globalData.manualAlbums || [],
      collectionItems
    })
      .then((file) => shareMarkdownFile(file))
      .then(() => {
        wx.showToast({
          title: "已生成 Markdown",
          icon: "success"
        });
      })
      .catch((error) => {
        wx.showToast({
          title: error && error.message ? error.message : "导出失败",
          icon: "none"
        });
      })
      .finally(() => {
        wx.hideLoading();
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
  openThemeSettings() {
    wx.navigateTo({
      url: "/pages/theme-settings/index"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
