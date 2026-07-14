const { albums } = require("../../data/seed.js");
const { confirmSelectedAlbums } = require("../../services/collection-service.js");
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
      userId: "david",
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
    const draft = app.globalData.importDraft || {};
    const sourceAlbums = buildAlbumSource(app, draft);
    const selectedAlbumIds = this.data.selectedAlbums.map((album) => album.id);
    const userId = app.globalData.userId || this.data.defaults.userId;
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
    const seedIds = new Set(albums.map((album) => album.id));
    const existingManualIds = new Set((app.globalData.manualAlbums || []).map((album) => album.id));
    const newManualAlbums = this.data.selectedAlbums
      .filter((album) => !seedIds.has(album.id) && !existingManualIds.has(album.id))
      .map((album) => ({ ...album }));

    app.globalData.manualAlbums = [
      ...(app.globalData.manualAlbums || []),
      ...newManualAlbums
    ];
    app.globalData.collectionItems = result.collectionItems;
    app.globalData.tvBindings = syncResult.bindings;
    app.globalData.importDraft = null;
    app.refreshUserLabel();
    if (typeof app.saveCollectionToCloud === "function") {
      result.createdItems.forEach((item) => {
        const album = this.data.selectedAlbums.find((candidate) => candidate.id === item.albumId);
        app.saveCollectionToCloud(item, album);
      });
    }

    wx.showToast({
      title: `已加入 ${result.createdItems.length} 张`,
      icon: "success"
    });

    wx.redirectTo({
      url: "/pages/cabinet/index"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
