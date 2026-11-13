const uiLocale=require("../../ui/locale-runtime");
const { albums } = require("../../data/seed.js");
const { confirmSelectedAlbums } = require("../../services/collection-service.js");
const { requireCloudAccount, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { coverToImageSrc } = require("../../services/catalog-api.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS } = require("../../services/media-format-service.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || coverToImageSrc(album.coverUrl),
    styles: album.style
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function buildAlbumSource(app, draft = {}) {
  return uniqueById([
    ...albums,
    ...(app.globalData.manualAlbums || []),
    ...(draft.candidates || [])
  ]);
}

function getSaveFailureSummary(app) {
  const diagnostic = app.globalData.cloud && app.globalData.cloud.lastDiagnostic;
  if (!diagnostic || !diagnostic.albumTitle) {
    return "";
  }
  return `${diagnostic.albumTitle}${diagnostic.statusCode ? `(${diagnostic.statusCode})` : ""}`;
}

Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  data: {
    selectedAlbums: [],
    selectedCount: 0,
    defaults: {
      userId: "",
      collectionDate: today(),
      source: "线上搜索",
      quantity: 1,
      condition: "NM",
      mediumKey: DEFAULT_MEDIUM_KEY,
      notes: ""
    },
    pricesByAlbumId: {},
    mediaFormats: MEDIA_FORMATS
  },
  onLoad() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadSelectedAlbums();
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  loadSelectedAlbums() {
    const app = getApp();
    const draft = app.globalData.importDraft || {};
    const sourceAlbums = buildAlbumSource(app, draft);
    const selectedIds = draft.selectedAlbumIds || [];
    const selectedAlbums = selectedIds
      .map((albumId) => sourceAlbums.find((album) => album.id === albumId))
      .filter(Boolean)
      .map(toAlbumView);

    this.setData({
      selectedAlbums,
      selectedCount: selectedAlbums.length
    });
  },
  handleDefaultChange(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({
      defaults: {
        ...this.data.defaults,
        [key]: key === "quantity" ? Number(event.detail.value || 1) : event.detail.value
      }
    });
  },
  handlePriceChange(event) {
    const { albumId } = event.currentTarget.dataset;
    this.setData({
      pricesByAlbumId: {
        ...this.data.pricesByAlbumId,
        [albumId]: Number(event.detail.value || 0) || undefined
      }
    });
  },
  handleMediumChange(event) {
    this.setData({
      defaults: {
        ...this.data.defaults,
        mediumKey: event.detail.value
      }
    });
  },
  async confirmAdd() {
    const app = getApp();
    const me = await requireCloudAccount(app);
    if (!me) {
      return;
    }

    const draft = app.globalData.importDraft || {};
    const sourceAlbums = buildAlbumSource(app, draft);
    const selectedAlbumIds = this.data.selectedAlbums.map((album) => album.id);
    const userId = app.globalData.userId || this.data.defaults.userId || "";
    const result = confirmSelectedAlbums({
      selectedAlbumIds,
      albums: sourceAlbums,
      existingCollectionItems: app.globalData.collectionItems || [],
      defaults: {
        ...this.data.defaults,
        userId
      },
      pricesByAlbumId: this.data.pricesByAlbumId
    });
    const syncResult = triggerTvSync(app.globalData.tvBindings || [], userId);
    if (!result.createdItems.length) {
      app.globalData.importDraft = null;
      uiLocale.toast(wx,{
        title: "\u5df2\u5728\u6536\u85cf",
        icon: "success"
      });
      wx.redirectTo({
        url: "/pages/cabinet/index"
      });
      return;
    }

    uiLocale.loading(wx,{ title: "\u4fdd\u5b58\u4e2d" });
    Promise.all(result.createdItems.map((item) => {
      const album = this.data.selectedAlbums.find((candidate) => candidate.id === item.albumId);
      return app.saveCollectionToCloud(item, album).then((payload) => ({
        item,
        album,
        payload
      }));
    }))
      .then((saveResults) => {
        const savedResults = saveResults.filter((saveResult) => saveResult.payload);
        const failedResults = saveResults.filter((saveResult) => !saveResult.payload);
        if (!savedResults.length) {
          const failureSummary = getSaveFailureSummary(app);
          showCloudSaveFailed();
          if (failureSummary && typeof wx.showModal === "function") {
            uiLocale.modal(wx,{
              title: "\u4fdd\u5b58\u5931\u8d25",
              content: `\u5931\u8d25\u5531\u7247\uff1a${failureSummary}\u3002\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff0c\u6216\u628a\u8fd9\u4e2a\u63d0\u793a\u53d1\u7ed9\u6211\u3002`,
              showCancel: false,
              confirmText: "\u77e5\u9053\u4e86"
            });
          }
          return;
        }

        app.globalData.tvBindings = syncResult.bindings;
        app.globalData.importDraft = null;
        return app.loadCloudCollection({ force: true }).then(() => {
          uiLocale.toast(wx,{
            title: failedResults.length
              ? `\u5df2\u52a0 ${savedResults.length} \u5f20\uff0c${failedResults.length} \u5f20\u5931\u8d25`
              : `\u5df2\u52a0\u5165 ${savedResults.length} \u5f20`,
            icon: failedResults.length ? "none" : "success"
          });
          wx.redirectTo({
            url: "/pages/cabinet/index"
          });
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
    return;
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
},"确认加入"));
