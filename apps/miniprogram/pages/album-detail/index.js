const { albums, collectionItems, demoPricesByAlbumId, featuredAlbumId } = require("../../data/seed.js");
const { confirmSelectedAlbums } = require("../../services/collection-service.js");
const { ensureCloudSession, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { createShareMessage } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS, getMediaFormat } = require("../../services/media-format-service.js");
const { normalizeTrackDisplayList } = require("../../services/track-display-service.js");

function toAlbumView(album) {
  if (!album) {
    return null;
  }

  return {
    ...album,
    cover: album.cover || `/${album.coverUrl}`,
    styles: album.style
  };
}

function formatPrice(price) {
  if (price === undefined || price === null || price === "") {
    return "未填写";
  }

  return `¥ ${price}`;
}

Page({
  data: {
    album: null,
    collectionItem: null,
    detailFacts: [],
    tracks: [],
    pendingMediumKey: DEFAULT_MEDIUM_KEY,
    mediaFormats: MEDIA_FORMATS
  },
  onLoad(options = {}) {
    this.loadAlbumDetail(options.albumId || featuredAlbumId);
  },
  onShow() {
    if (this.data.album && this.data.album.id) {
      this.loadAlbumDetail(this.data.album.id);
    }
  },
  loadAlbumDetail(albumId) {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const album = toAlbumView(sourceAlbums.find((item) => item.id === albumId));
    const collectionItem = liveCollectionItems.find((item) => item.albumId === albumId) || null;

    if (!album) {
      this.setData({
        album: null,
        collectionItem: null,
        detailFacts: [],
        tracks: []
      });
      return;
    }

    this.setData({
      album,
      collectionItem,
      detailFacts: [
        { label: "发行年份", value: `${album.year}` },
        { label: "地区", value: album.region },
        { label: "风格", value: album.style },
        { label: "介质", value: collectionItem ? getMediaFormat(collectionItem.mediumKey).label : "未收藏" },
        { label: "价格", value: collectionItem ? formatPrice(collectionItem.price) : "未收藏" },
        { label: "数量", value: collectionItem ? `${collectionItem.quantity}` : "--" },
        { label: "品相", value: collectionItem ? collectionItem.condition : "--" }
      ],
      tracks: normalizeTrackDisplayList(album.tracks || [])
    });
  },
  handleMediumChange(event) {
    this.setData({
      pendingMediumKey: event.detail.value
    });
  },
  addToCollection() {
    if (!this.data.album || this.data.collectionItem) {
      return;
    }

    const app = getApp();
    if (!ensureCloudSession(app)) {
      return;
    }

    const now = new Date().toISOString();
    const result = confirmSelectedAlbums({
      selectedAlbumIds: [this.data.album.id],
      albums: [...albums, ...(app.globalData.manualAlbums || [])],
      existingCollectionItems: app.globalData.collectionItems || [],
      defaults: {
        userId: app.globalData.userId || "",
        collectionDate: now.slice(0, 10),
        source: "资料库添加",
        quantity: 1,
        condition: "NM",
        mediumKey: this.data.pendingMediumKey || DEFAULT_MEDIUM_KEY,
        notes: ""
      },
      pricesByAlbumId: demoPricesByAlbumId,
      now
    });

    if (!result.createdItems.length) {
      this.loadAlbumDetail(this.data.album.id);
      wx.showToast({
        title: "\u5df2\u5728\u6536\u85cf",
        icon: "success"
      });
      return;
    }

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
    app.saveCollectionToCloud(result.createdItems[0], this.data.album)
      .then((payload) => {
        if (!payload) {
          showCloudSaveFailed();
          return;
        }

        this.loadAlbumDetail(this.data.album.id);
        wx.showToast({
          title: "\u5df2\u52a0\u5165\u6536\u85cf",
          icon: "success"
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
    return;
  },
  openEdit() {
    if (!this.data.album) {
      return;
    }

    wx.navigateTo({
      url: `/pages/collection-edit/index?albumId=${this.data.album.id}`
    });
  },
  onShareAppMessage() {
    const app = getApp();
    const name = app.globalData.userProfile?.name || "\u5531\u7247\u67dc\u7528\u6237";
    const album = this.data.album;
    if (!album) return createShareMessage();

    return createShareMessage({
      title: this.data.collectionItem ? `${name}收藏的 ${album.title}` : `${name}的唱片柜 · ${album.title}`,
      path: `/pages/album-detail/index?albumId=${album.id}`,
      imageUrl: album.cover
    });
  }
});
