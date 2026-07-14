const { albums } = require("./data/seed.js");
const { SESSION_REQUIRED_TITLE } = require("./services/cloud-session.js");
const {
  applyCloudCollectionPayload,
  deleteCollectionFromCloud: requestDeleteCollectionFromCloud,
  fetchMyCloudCollection,
  fetchSharedCloudCollection,
  initWechatCloud,
  normalizeCloudCollectionPayload,
  saveCollectionToCloud: requestSaveCollectionToCloud
} = require("./services/cloud-api.js");
const { enableFriendShare } = require("./services/share.js");

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function collectionTotalLabel(items) {
  return money((items || []).reduce((sum, item) => sum + Number(item.price || 0), 0));
}

App({
  onLaunch() {
    this.loadWechatProfile();
    this.bootstrapCloud();
    enableFriendShare();
  },
  onShow() {
    enableFriendShare();
  },
  loadWechatProfile() {
    if (typeof wx === "undefined" || typeof wx.getStorageSync !== "function") {
      return;
    }

    const applyUserInfo = (userInfo = {}) => {
      const name = userInfo.nickName || userInfo.nickname || "";
      if (!name) return;

      this.globalData.userProfile = {
        ...this.globalData.userProfile,
        name,
        avatar: userInfo.avatarUrl || this.globalData.userProfile.avatar,
      };
      this.globalData.userLabel = `${name} / ${this.globalData.collectionCostLabel}`;
    };

    applyUserInfo(wx.getStorageSync("wechatUserInfo"));
  },
  updateWechatProfile(userInfo) {
    if (!userInfo) return;
    this.globalData.userProfile = {
      ...this.globalData.userProfile,
      name: userInfo.nickName || userInfo.nickname || this.globalData.userProfile.name,
      avatar: userInfo.avatarUrl || this.globalData.userProfile.avatar,
    };
    this.globalData.userLabel = `${this.globalData.userProfile.name} / ${this.globalData.collectionCostLabel}`;

    if (typeof wx !== "undefined" && typeof wx.setStorageSync === "function") {
      wx.setStorageSync("wechatUserInfo", userInfo);
    }
  },
  refreshUserLabel() {
    this.globalData.collectionCostLabel = collectionTotalLabel(this.globalData.collectionItems);
    this.globalData.userLabel = `${this.globalData.userProfile.name} / ${this.globalData.collectionCostLabel}`;
  },
  bootstrapCloud() {
    this.globalData.cloud.ready = initWechatCloud(this.globalData.cloud);
    if (this.globalData.cloud.ready) {
      this.loadCloudCollection();
    }
  },
  loadCloudCollection(options = {}) {
    if (!this.globalData.cloud.ready && !options.force) {
      return Promise.resolve(null);
    }
    if (this.globalData.cloud.loadingPromise && !options.force) {
      return this.globalData.cloud.loadingPromise;
    }

    this.globalData.cloud.loadingPromise = fetchMyCloudCollection(this.globalData.cloud)
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return applyCloudCollectionPayload(this, payload, albums);
      })
      .catch((error) => {
        this.rememberCloudError(error);
        return null;
      })
      .finally(() => {
        this.globalData.cloud.loadingPromise = null;
      });

    return this.globalData.cloud.loadingPromise;
  },
  loadSharedCloudCollection(ownerId) {
    if (!ownerId || !this.globalData.cloud.ready) {
      return Promise.resolve(null);
    }

    return fetchSharedCloudCollection(ownerId, this.globalData.cloud)
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return normalizeCloudCollectionPayload(payload, albums);
      })
      .catch((error) => {
        this.rememberCloudError(error);
        return null;
      });
  },
  saveCollectionToCloud(collectionItem, album) {
    if (!this.globalData.cloud.ready || !collectionItem || !album) {
      return Promise.resolve(null);
    }

    return requestSaveCollectionToCloud(collectionItem, album, this.globalData.cloud)
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return applyCloudCollectionPayload(this, payload, albums);
      })
      .catch((error) => {
        this.rememberCloudError(error);
        return null;
      });
  },
  deleteCollectionFromCloud(collectionId) {
    if (!this.globalData.cloud.ready || !collectionId) {
      return Promise.resolve(null);
    }

    return requestDeleteCollectionFromCloud(collectionId, this.globalData.cloud)
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return payload ? applyCloudCollectionPayload(this, payload, albums) : null;
      })
      .catch((error) => {
        this.rememberCloudError(error);
        return null;
      });
  },
  isCloudSessionReady() {
    return Boolean(this.globalData.cloud && this.globalData.cloud.ready);
  },
  showCloudSessionRequired(wxApi) {
    const api = wxApi || (typeof wx === "undefined" ? null : wx);
    if (api && typeof api.showToast === "function") {
      api.showToast({
        title: SESSION_REQUIRED_TITLE,
        icon: "none"
      });
    }
  },
  rememberCloudError(error) {
    const message = error && error.message ? error.message : "Cloud sync failed";
    this.globalData.cloud.lastError = message;
  },
  globalData: {
    userId: "",
    userLabel: `\u5531\u7247\u67dc\u7528\u6237 / ${collectionTotalLabel([])}`,
    userProfile: {
      name: "\u5531\u7247\u67dc\u7528\u6237",
      avatar: "",
      bio: "",
    },
    collectionCostLabel: collectionTotalLabel([]),
    manualAlbums: [],
    collectionItems: [],
    photoWallOrder: [],
    tvBindings: [],
    importDraft: null,
    cloud: {
      enabled: true,
      env: "prod-d5gmzcuby62751753",
      service: "express-i2ts",
      publicBaseUrl: "https://express-i2ts-281225-8-1453155745.sh.run.tcloudbase.com",
      ready: false,
      loadingPromise: null,
      lastError: ""
    },
  },
});
