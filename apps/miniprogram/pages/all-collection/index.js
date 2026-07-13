const { albums } = require("../../data/seed.js");
const {
  COLLECTION_SEARCH_SCOPES,
  buildCollectionShowcase,
  buildCollectedAlbumViews,
  filterCollectedAlbumViews
} = require("../../services/collection-showcase-service.js");
const { createShareMessage } = require("../../services/share.js");

Page({
  data: {
    userName: "David",
    avatarInitial: "D",
    stats: {
      albumCount: 0,
      artistCount: 0,
      trackCount: 0,
      totalPriceLabel: "¥0"
    },
    query: "",
    searchScope: "all",
    searchScopes: COLLECTION_SEARCH_SCOPES.map((item, index) => ({ ...item, active: index === 0 })),
    collectedAlbums: [],
    visibleAlbums: [],
    ownerId: "",
    albumCard: null,
    cardIndex: 0,
    cardPositionLabel: "0 / 0"
  },
  onLoad(options = {}) {
    this.setData({
      ownerId: options.ownerId || ""
    });
    this.loadCollection();
  },
  onShow() {
    this.loadCollection();
  },
  loadCollection() {
    const app = getApp();
    if (this.data.ownerId && typeof app.loadSharedCloudCollection === "function") {
      this.loadSharedCloudCollection(this.data.ownerId);
      return;
    }

    this.loadLocalCollection();
    if (typeof app.loadCloudCollection === "function") {
      app.loadCloudCollection().then((payload) => {
        if (payload) {
          this.loadLocalCollection();
        }
      });
    }
  },
  loadLocalCollection() {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const collectionItems = app.globalData.collectionItems || [];
    this.renderCollection(sourceAlbums, collectionItems, app.globalData.userProfile);
  },
  loadSharedCloudCollection(ownerId) {
    const app = getApp();
    app.loadSharedCloudCollection(ownerId).then((payload) => {
      if (!payload) {
        this.loadLocalCollection();
        return;
      }

      this.renderCollection(
        [...albums, ...payload.manualAlbums],
        payload.collectionItems,
        {
          name: payload.owner.displayName,
          avatar: payload.owner.avatarUrl
        }
      );
    });
  },
  renderCollection(sourceAlbums, collectionItems, userProfile) {
    const showcase = buildCollectionShowcase(sourceAlbums, collectionItems, userProfile);

    this.setData({
      userName: showcase.userName,
      avatarInitial: showcase.avatarInitial,
      stats: showcase.stats,
      collectedAlbums: showcase.albums,
      visibleAlbums: filterCollectedAlbumViews(showcase.albums, this.data.query, this.data.searchScope)
    });
  },
  applySearch() {
    this.setData({
      visibleAlbums: filterCollectedAlbumViews(this.data.collectedAlbums, this.data.query, this.data.searchScope),
      searchScopes: COLLECTION_SEARCH_SCOPES.map((item) => ({
        ...item,
        active: item.key === this.data.searchScope
      }))
    });
  },
  handleQuery(event) {
    this.setData({
      query: event.detail.value
    }, () => {
      this.applySearch();
    });
  },
  clearQuery() {
    this.setData({
      query: ""
    }, () => {
      this.applySearch();
    });
  },
  selectSearchScope(event) {
    this.setData({
      searchScope: event.currentTarget.dataset.scope || "all"
    }, () => {
      this.applySearch();
    });
  },
  openAlbumCard(event) {
    const { albumId } = event.currentTarget.dataset;
    const cardIndex = this.data.visibleAlbums.findIndex((album) => album.id === albumId);
    if (cardIndex < 0) {
      return;
    }

    this.setData({
      albumCard: this.data.visibleAlbums[cardIndex],
      cardIndex,
      cardPositionLabel: `${cardIndex + 1} / ${this.data.visibleAlbums.length}`
    });
  },
  closeAlbumCard() {
    this.setData({
      albumCard: null
    });
  },
  moveAlbumCard(event) {
    const direction = Number(event.currentTarget.dataset.direction);
    const total = this.data.visibleAlbums.length;
    if (!total) {
      return;
    }

    const cardIndex = (this.data.cardIndex + direction + total) % total;
    this.setData({
      albumCard: this.data.visibleAlbums[cardIndex],
      cardIndex,
      cardPositionLabel: `${cardIndex + 1} / ${total}`
    });
  },
  openCardDetail() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    this.setData({
      albumCard: null
    }, () => {
      wx.navigateTo({
        url: `/pages/album-detail/index?albumId=${albumCard.id}`
      });
    });
  },
  noop() {},
  onShareAppMessage() {
    const app = getApp();
    const ownerId = encodeURIComponent(app.globalData.userId || "david");
    return createShareMessage({
      title: `${this.data.userName}的全部唱片收藏`,
      path: `/pages/all-collection/index?ownerId=${ownerId}`
    });
  }
});
