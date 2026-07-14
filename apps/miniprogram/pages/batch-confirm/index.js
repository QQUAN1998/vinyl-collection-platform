const { albums } = require("../../data/seed.js");
const { confirmSelectedAlbums } = require("../../services/collection-service.js");
const { ensureCloudSession, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { coverToImageSrc } = require("../../services/catalog-api.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage } = require("../../services/share.js");
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

Page({
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
    this.loadSelectedAlbums();
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
  confirmAdd() {
    const app = getApp();
    if (!ensureCloudSession(app)) {
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
      wx.showToast({
        title: "\u5df2\u5728\u6536\u85cf",
        icon: "success"
      });
      wx.redirectTo({
        url: "/pages/cabinet/index"
      });
      return;
    }

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
    Promise.all(result.createdItems.map((item) => {
      const album = this.data.selectedAlbums.find((candidate) => candidate.id === item.albumId);
      return app.saveCollectionToCloud(item, album);
    }))
      .then((payloads) => {
        if (payloads.some((payload) => !payload)) {
          showCloudSaveFailed();
          return;
        }

        app.globalData.tvBindings = syncResult.bindings;
        app.globalData.importDraft = null;
        return app.loadCloudCollection({ force: true }).then(() => {
          wx.showToast({
            title: `\u5df2\u52a0\u5165 ${result.createdItems.length} \u5f20`,
            icon: "success"
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
  }
});
