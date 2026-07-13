const { albums } = require("../../data/seed.js");
const { getMediaFormat } = require("../../services/media-format-service.js");
const { getAlbumRarity } = require("../../services/rarity-service.js");
const { createShareMessage } = require("../../services/share.js");

function decadeOf(year) {
  return `${Math.floor(Number(year || 0) / 10) * 10}s`;
}

function toAlbumView(album, collectionItem = {}) {
  const price = collectionItem.price || 0;
  const rarity = getAlbumRarity(price);
  const medium = getMediaFormat(collectionItem.mediumKey);
  return {
    ...album,
    price,
    collectionDate: collectionItem.collectionDate || "未记录",
    mediumLabel: medium.label,
    rarityCode: rarity.code,
    rarityLabel: rarity.label,
    rarityName: rarity.name,
    rarityClass: `rarity-${rarity.code.toLowerCase()}`,
    decade: decadeOf(album.year),
    cover: `/${album.coverUrl}`,
    styles: album.style
  };
}

Page({
  data: {
    profileType: "artist",
    profileTitle: "",
    profileAlbums: [],
    visibleAlbums: [],
    artistFilters: [],
    styleFilters: [],
    decadeFilters: [],
    selectedArtist: "all",
    selectedStyle: "all",
    selectedDecade: "all",
    previewAlbum: null,
    previewIndex: 0
  },
  onLoad(options = {}) {
    this.loadProfile(options);
  },
  loadProfile(options = {}) {
    const app = getApp();
    const profileType = options.type || "artist";
    const profileTitle = decodeURIComponent(options.name || "");
    const collectionItems = app.globalData.collectionItems || [];
    const collectedIds = new Set(collectionItems.map((item) => item.albumId));
    const collectionByAlbumId = new Map(collectionItems.map((item) => [item.albumId, item]));
    const profileAlbums = albums
      .filter((album) => collectedIds.has(album.id))
      .filter((album) => {
        if (profileType === "all") {
          return true;
        }
        if (profileType === "style") {
          return album.style === profileTitle;
        }
        return album.artist === profileTitle;
      })
      .map((album) => toAlbumView(album, collectionByAlbumId.get(album.id)));
    const artistFilters = [...new Set(profileAlbums.map((album) => album.artist))];
    const styleFilters = [...new Set(profileAlbums.map((album) => album.style))];
    const decadeFilters = [...new Set(profileAlbums.map((album) => album.decade))].sort((a, b) => b.localeCompare(a));

    this.setData({
      profileType,
      profileTitle,
      profileAlbums,
      visibleAlbums: profileAlbums,
      artistFilters,
      styleFilters,
      decadeFilters,
      selectedArtist: "all",
      selectedStyle: "all",
      selectedDecade: "all"
    });
  },
  applyFilters() {
    const visibleAlbums = this.data.profileAlbums.filter((album) => {
      const artistMatched = this.data.selectedArtist === "all" || album.artist === this.data.selectedArtist;
      const styleMatched = this.data.selectedStyle === "all" || album.style === this.data.selectedStyle;
      const decadeMatched = this.data.selectedDecade === "all" || album.decade === this.data.selectedDecade;
      return artistMatched && styleMatched && decadeMatched;
    });
    this.setData({
      visibleAlbums
    });
  },
  selectArtist(event) {
    this.setData({
      selectedArtist: event.currentTarget.dataset.value
    });
    this.applyFilters();
  },
  selectStyle(event) {
    this.setData({
      selectedStyle: event.currentTarget.dataset.value
    });
    this.applyFilters();
  },
  selectDecade(event) {
    this.setData({
      selectedDecade: event.currentTarget.dataset.value
    });
    this.applyFilters();
  },
  openAlbum(event) {
    const albumId = event.detail.album ? event.detail.album.id : event.currentTarget.dataset.albumId;
    const previewIndex = this.data.visibleAlbums.findIndex((album) => album.id === albumId);
    const previewAlbum = this.data.visibleAlbums[previewIndex];
    if (!previewAlbum) {
      return;
    }

    this.setData({
      previewAlbum,
      previewIndex
    });
  },
  closePreview() {
    this.setData({
      previewAlbum: null
    });
  },
  movePreview(event) {
    const direction = Number(event.currentTarget.dataset.direction);
    const total = this.data.visibleAlbums.length;
    if (!total) return;
    const previewIndex = (this.data.previewIndex + direction + total) % total;
    this.setData({
      previewIndex,
      previewAlbum: this.data.visibleAlbums[previewIndex]
    });
  },
  openDetail() {
    if (!this.data.previewAlbum) return;
    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${this.data.previewAlbum.id}`
    });
  },
  onShareAppMessage() {
    const app = getApp();
    const name = app.globalData.userProfile?.name || "David";
    const album = this.data.previewAlbum;
    if (this.data.profileType === "all" && !album) {
      return createShareMessage({
        title: `${name}的全部唱片收藏`,
        path: "/pages/archive-profile/index?type=all&name=%E5%85%A8%E9%83%A8%E5%94%B1%E7%89%87"
      });
    }
    if (!album) {
      return createShareMessage({
        title: `${name}的唱片柜`,
        path: "/pages/cabinet/index"
      });
    }
    return createShareMessage({
      title: `${name}收藏的 ${album.title}`,
      path: `/pages/album-detail/index?albumId=${album.id}`,
      imageUrl: album.cover
    });
  }
});
