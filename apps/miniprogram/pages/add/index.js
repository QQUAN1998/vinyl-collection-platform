const { albums, recentAlbumIds } = require("../../data/seed.js");
const { calculateCollectionStats } = require("../../services/stats-service.js");
const { createShareMessage } = require("../../services/share.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || `/${album.coverUrl}`,
    styles: album.style
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function searchAlbums(sourceAlbums, query, limit = 4) {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  return sourceAlbums
    .filter((album) => [album.title, album.artist, album.region, album.style, String(album.year)]
      .some((field) => normalize(field).includes(normalized)))
    .slice(0, limit)
    .map(toAlbumView);
}

function recentAlbumsFrom(sourceAlbums) {
  return recentAlbumIds
    .map((albumId) => sourceAlbums.find((album) => album.id === albumId))
    .filter(Boolean)
    .map(toAlbumView);
}

Page({
  data: {
    query: "",
    hasSearch: false,
    collectionCount: 0,
    recentAlbums: [],
    results: []
  },
  onLoad() {
    this.loadAddPage();
  },
  onShow() {
    this.loadAddPage();
  },
  loadAddPage() {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const stats = calculateCollectionStats(sourceAlbums, app.globalData.collectionItems || []);
    this.setData({
      collectionCount: stats.albumCount,
      recentAlbums: recentAlbumsFrom(sourceAlbums),
      results: searchAlbums(sourceAlbums, this.data.query),
      hasSearch: Boolean(normalize(this.data.query))
    });
  },
  handleQuery(event) {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const query = event.detail.value;

    this.setData({
      query,
      hasSearch: Boolean(normalize(query)),
      results: searchAlbums(sourceAlbums, query)
    });
  },
  clearQuery() {
    this.setData({
      query: "",
      hasSearch: false,
      results: []
    });
  },
  goSearch() {
    const query = this.data.query.trim();
    if (!query) {
      wx.showToast({
        title: "先输入唱片或艺人",
        icon: "none"
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/search-results/index?query=${encodeURIComponent(query)}`
    });
  },
  goBatchInput() {
    wx.navigateTo({
      url: "/pages/batch-input/index"
    });
  },
  goManualAdd() {
    wx.navigateTo({
      url: "/pages/manual-add/index"
    });
  },
  goAllCollection() {
    wx.navigateTo({
      url: "/pages/all-collection/index"
    });
  },
  openAlbum(event) {
    const { albumId } = event.currentTarget.dataset;
    if (!albumId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${albumId}`
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
