const { albums, collectionItems, tvBindings } = require("./data/seed.js");
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
  rememberCloudError(error) {
    const message = error && error.message ? error.message : "Cloud sync failed";
    this.globalData.cloud.lastError = message;
  },
  globalData: {
    userId: "david",
    userLabel: `David / ${collectionTotalLabel(collectionItems)}`,
    userProfile: {
      name: "David",
      avatar: "",
      bio: "喜欢华语流行、游戏原声和 City Pop",
    },
    collectionCostLabel: collectionTotalLabel(collectionItems),
    manualAlbums: [],
    collectionItems: [...collectionItems],
    photoWallOrder: collectionItems.map((item) => item.albumId),
    tvBindings: [...tvBindings],
    importDraft: null,
    cloud: {
      enabled: true,
      env: "vinyl-prod-d0g8u61k95ee7a1e6",
      service: "express-i2ts",
      publicBaseUrl: "https://express-i2ts-281225-8-1453155745.sh.run.tcloudbase.com",
      ready: false,
      loadingPromise: null,
      lastError: ""
    },
  },
});
