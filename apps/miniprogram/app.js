const { albums } = require("./data/seed.js");
const {
  DEFAULT_PROFILE_NAME,
  buildWechatProfile,
  cleanProfileNameValue,
  hasWechatProfileInfo
} = require("./services/account-profile-service.js");
const { SESSION_REQUIRED_TITLE } = require("./services/cloud-session.js");
const { uploadAlbumCover } = require("./services/album-edit-service.js");
const {
  hasStoredAuthAccount,
  readStoredAuthState,
  writeStoredAuthState
} = require("./services/auth-state-service.js");
const {
  applyCloudCollectionPayload,
  deleteCollectionFromCloud: requestDeleteCollectionFromCloud,
  deleteCollectionsFromCloud: requestDeleteCollectionsFromCloud,
  fetchMyCloudCollection,
  fetchSharedCloudCollection,
  initWechatCloud,
  loginWithCloudIdentity: requestLoginWithCloudIdentity,
  normalizeMeResponse,
  normalizeCloudCollectionPayload,
  saveCollectionToCloud: requestSaveCollectionToCloud,
  saveCollectionsToCloud: requestSaveCollectionsToCloud
} = require("./services/cloud-api.js");
const { enableFriendShare } = require("./services/share.js");
const {
  applyThemeChrome,
  buildThemeViewData,
  readStoredThemeSetting,
  writeStoredThemeSetting
} = require("./services/theme-service.js");
const { getCollectionAmount } = require("./services/stats-service.js");

const LOGIN_PROMPT_DELAY_MS = 600;

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function collectionTotalLabel(items) {
  return money((items || []).reduce((sum, item) => sum + getCollectionAmount(item), 0));
}

function getProfileDisplayName(userInfo = {}) {
  return [
    userInfo.displayName,
    userInfo.nickName,
    userInfo.nickname,
    userInfo.name,
  ].map(cleanProfileNameValue).find(Boolean) || "";
}

function getProfileAvatarUrl(userInfo = {}) {
  return [userInfo.avatarUrl, userInfo.avatar]
    .find((value) => typeof value === "string" && value.trim()) || "";
}

function isRemoteAvatarUrl(value) {
  return /^(https?:|cloud:)/.test(String(value || ""));
}

function getAvatarExtension(value) {
  const match = String(value || "").match(/\.(png|jpe?g|webp)$/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

App({
  onLaunch() {
    this.restoreTheme();
    this.bootstrapCloud();
    this.restoreStoredAuthState();
    this.loadWechatProfile();
    if (this.canLoadCloudCollection()) {
      this.loadCloudCollection();
    }
    this.promptWechatLoginOnLaunch();
    enableFriendShare();
  },
  onShow() {
    enableFriendShare();
    this.applyThemeChrome();
  },
  restoreTheme() {
    this.globalData.theme = readStoredThemeSetting();
    this.applyThemeChrome();
  },
  getThemeViewData() {
    return buildThemeViewData(this.globalData.theme);
  },
  applyThemeChrome() {
    applyThemeChrome(this.getThemeViewData());
  },
  applyThemeToPage(page) {
    if (!page || typeof page.setData !== "function") {
      this.applyThemeChrome();
      return this.getThemeViewData();
    }

    const viewData = this.getThemeViewData();
    page.setData({
      themeClass: viewData.themeClass,
      themeStyle: viewData.themeStyle
    });
    applyThemeChrome(viewData);
    return viewData;
  },
  setTheme(setting) {
    this.globalData.theme = writeStoredThemeSetting(setting);
    const viewData = this.getThemeViewData();
    applyThemeChrome(viewData);
    this.refreshVisiblePageThemes(viewData);
    return viewData;
  },
  refreshVisiblePageThemes(viewData = this.getThemeViewData()) {
    if (typeof getCurrentPages !== "function") {
      return;
    }

    (getCurrentPages() || []).forEach((page) => {
      if (page && typeof page.setData === "function") {
        page.setData({
          themeClass: viewData.themeClass,
          themeStyle: viewData.themeStyle
        });
      }
    });
  },
  loadWechatProfile() {
    if (typeof wx === "undefined" || typeof wx.getStorageSync !== "function") {
      return;
    }

    const applyUserInfo = (userInfo = {}) => {
      if (!hasWechatProfileInfo(userInfo)) return;

      this.globalData.userProfile = buildWechatProfile(userInfo, this.globalData.userProfile);
      this.globalData.userLabel = `${this.globalData.userProfile.name} / ${this.globalData.collectionCostLabel}`;
    };

    applyUserInfo(wx.getStorageSync("wechatUserInfo"));
  },
  getStoredWechatProfile() {
    if (typeof wx === "undefined" || typeof wx.getStorageSync !== "function") {
      return {};
    }

    return wx.getStorageSync("wechatUserInfo") || {};
  },
  restoreStoredAuthState() {
    const stored = readStoredAuthState();
    if (stored.token) {
      this.globalData.auth.token = stored.token;
      this.globalData.cloud.authToken = stored.token;
    }
    if (stored.userProfile) {
      this.globalData.userProfile = {
        ...this.globalData.userProfile,
        ...stored.userProfile
      };
    }
    if (hasStoredAuthAccount(stored)) {
      this.applyMeResponse(stored.me, { persist: false });
    }
    if (stored.cloudCollection) {
      this.restoreStoredCloudCollection(stored.cloudCollection);
    }
    this.refreshUserLabel();
  },
  restoreStoredCloudCollection(cloudCollection = {}) {
    this.globalData.manualAlbums = Array.isArray(cloudCollection.manualAlbums)
      ? cloudCollection.manualAlbums
      : [];
    this.globalData.collectionItems = Array.isArray(cloudCollection.collectionItems)
      ? cloudCollection.collectionItems
      : [];
    this.globalData.photoWallOrder = Array.isArray(cloudCollection.photoWallOrder)
      ? cloudCollection.photoWallOrder
      : [];
  },
  persistAuthState(now) {
    return writeStoredAuthState({
      token: this.globalData.auth.token || "",
      me: this.globalData.auth.me || null,
      userProfile: this.globalData.userProfile || null,
      cloudCollection: {
        collectionItems: this.globalData.collectionItems || [],
        manualAlbums: this.globalData.manualAlbums || [],
        photoWallOrder: this.globalData.photoWallOrder || []
      }
    }, undefined, now);
  },
  updateWechatProfile(userInfo) {
    if (!hasWechatProfileInfo(userInfo)) return;
    this.globalData.userProfile = buildWechatProfile(userInfo, this.globalData.userProfile);
    this.globalData.userLabel = `${this.globalData.userProfile.name} / ${this.globalData.collectionCostLabel}`;

    if (typeof wx !== "undefined" && typeof wx.setStorageSync === "function") {
      wx.setStorageSync("wechatUserInfo", userInfo);
    }
    this.persistAuthState();
  },
  uploadWechatAvatarIfNeeded(avatarUrl) {
    const avatar = String(avatarUrl || "").trim();
    if (!avatar || isRemoteAvatarUrl(avatar)) {
      return Promise.resolve(avatar);
    }
    if (
      typeof wx === "undefined"
      || !wx.cloud
      || typeof wx.cloud.uploadFile !== "function"
      || !this.globalData.userId
    ) {
      return Promise.resolve(avatar);
    }

    const safeUserId = String(this.globalData.userId).replace(/[^a-zA-Z0-9_-]/g, "");
    const cloudPath = `user-avatars/${safeUserId}/${Date.now()}.${getAvatarExtension(avatar)}`;
    return new Promise((resolve) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: avatar,
        success: (result) => resolve(result.fileID || avatar),
        fail: () => resolve(avatar)
      });
    });
  },
  uploadAlbumCoverIfNeeded(cover, albumId) {
    return uploadAlbumCover({
      cover,
      albumId,
      userId: this.globalData.userId,
      wxApi: typeof wx === "undefined" ? null : wx
    });
  },
  syncWechatProfile(userInfo = {}, options = {}) {
    if (!hasWechatProfileInfo(userInfo)) {
      return Promise.resolve(this.globalData.auth.me);
    }

    const displayName = getProfileDisplayName(userInfo);
    const avatarUrl = getProfileAvatarUrl(userInfo);
    return this.uploadWechatAvatarIfNeeded(avatarUrl)
      .then((uploadedAvatarUrl) => this.loginWithCloudIdentity({
        nickName: displayName,
        avatarUrl: uploadedAvatarUrl || avatarUrl
      }, options));
  },
  refreshUserLabel() {
    this.globalData.collectionCostLabel = collectionTotalLabel(this.globalData.collectionItems);
    this.globalData.userLabel = `${this.globalData.userProfile.name} / ${this.globalData.collectionCostLabel}`;
  },
  applyAuthToken(token, options = {}) {
    if (!token) {
      return;
    }
    this.globalData.auth.token = token;
    this.globalData.cloud.authToken = token;
    if (typeof wx !== "undefined" && typeof wx.setStorageSync === "function") {
      wx.setStorageSync("vinylAuthToken", token);
    }
    if (options.persist !== false) {
      this.persistAuthState();
    }
  },
  bootstrapCloud() {
    this.globalData.cloud.ready = initWechatCloud(this.globalData.cloud);
  },
  applyMeResponse(payload, options = {}) {
    const me = normalizeMeResponse(payload);
    const user = me.user || {};
    if (!user.id) {
      return null;
    }

    this.globalData.auth = {
      ...this.globalData.auth,
      loggedIn: true,
      loading: false,
      me,
      lastError: ""
    };
    this.globalData.userId = user.id;
    const currentProfile = this.globalData.userProfile || {};
    const displayName = cleanProfileNameValue(user.displayName);
    const shouldUseServerName = displayName && (
      currentProfile.name === DEFAULT_PROFILE_NAME || displayName !== DEFAULT_PROFILE_NAME
    );
    this.globalData.userProfile = {
      ...currentProfile,
      name: shouldUseServerName ? displayName : currentProfile.name || DEFAULT_PROFILE_NAME,
      avatar: user.avatarUrl || currentProfile.avatar || ""
    };
    this.refreshUserLabel();
    if (options.persist !== false) {
      this.persistAuthState();
    }
    return me;
  },
  loginWithCloudIdentity(userInfo = {}, options = {}) {
    if (!this.canAttemptWechatIdentityLogin()) {
      if (!options.silent) {
        this.showCloudSessionRequired();
      }
      return Promise.resolve(null);
    }

    this.globalData.auth.loading = true;
    return requestLoginWithCloudIdentity(userInfo, this.globalData.cloud)
      .then((payload) => {
        const me = payload && payload.me ? payload.me : payload;
        if (payload && payload.token) {
          this.applyAuthToken(payload.token);
        }
        if (hasWechatProfileInfo(userInfo)) {
          this.updateWechatProfile(userInfo);
        }
        return this.applyMeResponse(me);
      })
      .catch((error) => {
        this.globalData.auth.lastError = error && error.message ? error.message : "Login failed";
        this.rememberCloudError(error);
        if (!options.silent && typeof wx !== "undefined" && typeof wx.showToast === "function") {
          wx.showToast({
            title: "登录未成功，请再试一次",
            icon: "none"
          });
        }
        return null;
      })
      .finally(() => {
        this.globalData.auth.loading = false;
      });
  },
  requestWechatProfile(options = {}) {
    if (typeof wx === "undefined" || typeof wx.getUserProfile !== "function") {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: options.desc || "\u7528\u4e8e\u521b\u5efa\u5531\u7247\u67dc\u8d26\u53f7\u5e76\u540c\u6b65\u5fae\u4fe1\u5934\u50cf\u6635\u79f0",
        success: (result) => {
          resolve(result.userInfo || {});
        },
        fail: () => {
          resolve({});
        }
      });
    });
  },
  hasLoggedInIdentity() {
    return Boolean(
      this.globalData.auth.loggedIn
        && this.globalData.userId
    );
  },
  canAttemptWechatIdentityLogin() {
    const api = typeof wx === "undefined" ? null : wx;
    return Boolean(
      api && (
        (api.cloud && typeof api.cloud.callContainer === "function")
          || (typeof api.login === "function" && typeof api.request === "function")
      )
    );
  },
  isCloudAccountReady() {
    return this.hasLoggedInIdentity();
  },
  canLoadCloudCollection(options = {}) {
    const cloud = this.globalData.cloud || {};
    const auth = this.globalData.auth || {};
    const hasPublicToken = Boolean(cloud.authToken && cloud.publicBaseUrl);
    const hasIdentity = Boolean(auth.loggedIn || hasPublicToken);
    const hasTransport = Boolean(options.force || cloud.ready || hasPublicToken);
    return hasIdentity && hasTransport;
  },
  promptWechatLoginOnLaunch() {
    if (
      typeof wx === "undefined"
      || typeof wx.showModal !== "function"
      || this.globalData.auth.loginPromptShown
      || this.hasLoggedInIdentity()
    ) {
      return;
    }

    this.globalData.auth.loginPromptShown = true;
    const showPrompt = () => {
      if (this.hasLoggedInIdentity()) {
        return;
      }

      wx.showModal({
        title: "登录唱片柜",
        content: "登录后，你的收藏、上墙和电视同步都会保存在自己的微信账号里。",
        confirmText: "微信登录",
        cancelText: "稍后",
        success: (result) => {
          if (!result || !result.confirm) {
            return;
          }

          this.openAccountPageForLogin();
          this.requireWechatAccount({
            desc: "用于创建唱片柜账号并保存你的收藏"
          }).then((me) => {
            if (!me) {
              return;
            }
            this.refreshAccountPageAfterLogin(me);
            if (typeof wx.showToast === "function") {
              wx.showToast({
                title: "已登录",
                icon: "success"
              });
            }
          });
        }
      });
    };

    if (typeof setTimeout === "function") {
      setTimeout(showPrompt, LOGIN_PROMPT_DELAY_MS);
      return;
    }
    showPrompt();
  },
  openAccountPageForLogin() {
    if (typeof wx === "undefined" || typeof wx.redirectTo !== "function") {
      return;
    }

    wx.redirectTo({
      url: "/pages/account/index"
    });
  },
  refreshAccountPageAfterLogin(me) {
    if (typeof getCurrentPages !== "function") {
      return;
    }

    const pages = getCurrentPages();
    const currentPage = pages && pages.length ? pages[pages.length - 1] : null;
    if (!currentPage || currentPage.route !== "pages/account/index") {
      return;
    }
    if (typeof currentPage.loadAccount === "function") {
      currentPage.loadAccount();
    }
    if (typeof currentPage.showOnboardingGuideIfNeeded === "function") {
      currentPage.showOnboardingGuideIfNeeded(me);
    }
  },
  requireWechatAccount(options = {}) {
    if (this.isCloudAccountReady()) {
      return Promise.resolve(this.globalData.auth.me);
    }
    if (!this.canAttemptWechatIdentityLogin()) {
      this.showCloudSessionRequired();
      return Promise.resolve(null);
    }
    if (this.globalData.auth.loginPromise) {
      return this.globalData.auth.loginPromise;
    }

    const profilePromise = options.withProfile === true
      ? this.requestWechatProfile(options)
      : Promise.resolve(options.userInfo || {});
    const loginPromise = profilePromise
      .then((userInfo) => {
        return this.loginWithCloudIdentity(userInfo || {}, options);
      })
      .then((me) => {
        if (!me) {
          return null;
        }
        return this.loadCloudCollection({ force: true }).then(() => me);
      })
      .finally(() => {
        this.globalData.auth.loginPromise = null;
      });

    this.globalData.auth.loginPromise = loginPromise;
    return loginPromise;
  },
  loadCloudCollection(options = {}) {
    if (!this.canLoadCloudCollection(options)) {
      return Promise.resolve(null);
    }
    if (this.globalData.cloud.loadingPromise && !options.force) {
      return this.globalData.cloud.loadingPromise;
    }

    this.globalData.cloud.loadingPromise = fetchMyCloudCollection(this.globalData.cloud)
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        const normalized = applyCloudCollectionPayload(this, payload, albums);
        this.applyCollectionOwnerAsAuth(normalized);
        this.persistAuthState();
        return normalized;
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
  applyCollectionOwnerAsAuth(normalized) {
    if (this.globalData.auth.loggedIn || !normalized || !normalized.owner) {
      return null;
    }

    const owner = normalized.owner;
    if (!owner.id) {
      return null;
    }

    return this.applyMeResponse({
      user: {
        id: owner.id,
        displayName: owner.displayName,
        avatarUrl: owner.avatarUrl
      },
      stats: {
        collectionCount: Array.isArray(normalized.collectionItems)
          ? normalized.collectionItems.length
          : 0
      }
    }, { persist: false });
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
    if (!this.isCloudAccountReady() || !collectionItem || !album) {
      return Promise.resolve(null);
    }

    return Promise.resolve()
      .then(() => requestSaveCollectionToCloud(collectionItem, album, this.globalData.cloud))
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return applyCloudCollectionPayload(this, payload, albums);
      })
      .catch((error) => {
        this.rememberCloudError(error, {
          action: "saveCollection",
          albumId: collectionItem.albumId || album.id || "",
          albumTitle: album.title || "",
          albumArtist: album.artist || ""
        });
        return null;
      });
  },
  saveCollectionsToCloud(items) {
    const entries = (items || []).filter((item) => item && item.collectionItem && item.album);
    if (!this.isCloudAccountReady() || !entries.length) {
      return Promise.resolve(null);
    }

    return Promise.resolve()
      .then(() => requestSaveCollectionsToCloud(entries, this.globalData.cloud))
      .then((payload) => {
        this.globalData.cloud.lastError = "";
        return applyCloudCollectionPayload(this, payload, albums);
      })
      .catch((error) => {
        this.rememberCloudError(error, {
          action: "saveCollections",
          count: entries.length
        });
        return null;
      });
  },
  deleteCollectionFromCloud(collectionId) {
    if (!this.isCloudAccountReady() || !collectionId) {
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
  deleteCollectionsFromCloud(collectionIds) {
    if (!this.isCloudAccountReady() || !Array.isArray(collectionIds) || !collectionIds.length) {
      return Promise.resolve(null);
    }

    return requestDeleteCollectionsFromCloud(collectionIds, this.globalData.cloud)
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
  rememberCloudError(error, context = {}) {
    const message = error && error.message ? error.message : "Cloud sync failed";
    this.globalData.cloud.lastError = message;
    this.globalData.cloud.lastDiagnostic = {
      ...context,
      message,
      statusCode: error && error.statusCode ? error.statusCode : undefined,
      at: new Date().toISOString()
    };
    if (typeof console !== "undefined" && typeof console.warn === "function") {
      console.warn("[cloud]", this.globalData.cloud.lastDiagnostic);
    }
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
    recommendationAlbums: [],
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
      lastError: "",
      lastDiagnostic: null
    },
    auth: {
      loggedIn: false,
      loading: false,
      me: null,
      loginPromise: null,
      token: "",
      lastError: ""
    },
    theme: {
      mode: "standard",
      customColor: "#fbfaf6"
    },
  },
});
