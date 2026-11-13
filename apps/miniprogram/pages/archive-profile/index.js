const uiLocale=require("../../ui/locale-runtime");
const { albums } = require("../../data/seed.js");
const { buildArchiveProfile } = require("../../services/archive-profile-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
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
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadProfile(options);
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  loadProfile(options = {}) {
    const app = getApp();
    const profileType = options.type || "artist";
    const profileTitle = decodeURIComponent(options.name || "");
    const profile = buildArchiveProfile({
      seedAlbums: albums,
      manualAlbums: app.globalData.manualAlbums || [],
      collectionItems: app.globalData.collectionItems || [],
      profileType,
      profileTitle
    });

    this.setData(profile);
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
    const name = app.globalData.userProfile?.name || "\u5531\u7247\u67dc\u7528\u6237";
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
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
},"档案"));
