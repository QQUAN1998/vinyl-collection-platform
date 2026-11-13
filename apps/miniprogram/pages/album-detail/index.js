const uiImageActions=require('../../ui/image-actions');
const uiLocale=require("../../ui/locale-runtime");
const releaseDates=require('../../ui/release-date');
const uiDetailMotion=require('../../ui/detail-motion');
const { albums, collectionItems, demoPricesByAlbumId, featuredAlbumId } = require("../../data/seed.js");
const { confirmSelectedAlbums } = require("../../services/collection-service.js");
const {
  mergeAlbumLibraries,
  toAlbumView
} = require("../../services/album-library-service.js");
const { requireCloudAccount, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS, getMediaFormat } = require("../../services/media-format-service.js");
const { normalizeTrackDisplayList } = require("../../services/track-display-service.js");
const { fetchTrackPreview } = require("../../services/catalog-api.js");
const {
  getPreviewPlayerState,
  playPreviewAudio: playSharedPreviewAudio,
  stopPreviewPlayback,
  subscribePreviewPlayer,
  togglePreviewPlayback
} = require("../../services/preview-player-service.js");

function formatPrice(price) {
  if (price === undefined || price === null || price === "") {
    return "未填写";
  }

  return `¥ ${price}`;
}

Page(uiLocale.page({uiImageActions(){const d=this.data;uiImageActions.openImage(d.album?.cover);},
uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  ...uiDetailMotion,
  data: {
    uiDragY:0,uiDetailOpacity:1,uiClosing:false,
    uiSharedOwnerId:"",
    album: null,
    collectionItem: null,
    detailFacts: [],
    tracks: [],
    previewLoadingKey: "",
    previewPlayingKey: "",
    pendingMediumKey: DEFAULT_MEDIUM_KEY,
    mediaFormats: MEDIA_FORMATS
  },
  onLoad(options = {}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.unsubscribePreviewPlayer = subscribePreviewPlayer((state) => {
      this.syncPreviewPlayerState(state);
    });
    const id=options.albumId||featuredAlbumId;
    if(options.ownerId){this.setData({uiSharedOwnerId:options.ownerId});app.loadSharedCloudCollection(options.ownerId).then(payload=>{if(!payload)return;this.uiSharedPayload=payload;this.loadAlbumDetail(id);});}
    else this.loadAlbumDetail(id);
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    if (this.data.album && this.data.album.id) {
      this.loadAlbumDetail(this.data.album.id);
    }
    this.syncPreviewPlayerState();
  },
  onUnload() {
    if (this.unsubscribePreviewPlayer) {
      this.unsubscribePreviewPlayer();
      this.unsubscribePreviewPlayer = null;
    }
  },
  loadAlbumDetail(albumId) {
    const app = getApp();
    const shared=this.data.uiSharedOwnerId;
    if(shared&&!this.uiSharedPayload)return;
    const sourceAlbums=shared?mergeAlbumLibraries(albums,this.uiSharedPayload.manualAlbums||[]):mergeAlbumLibraries(albums,app.globalData.manualAlbums||[],app.globalData.recommendationAlbums||[]);
    const liveCollectionItems=shared?this.uiSharedPayload.collectionItems:(app.globalData.collectionItems||collectionItems);
    const album = toAlbumView(sourceAlbums.find((item) => item.id === albumId));
    const collectionItem = liveCollectionItems.find((item) => item.albumId === albumId) || null;

    if (!album) {
      this.setData({
        album: null,
        collectionItem: null,
        detailFacts: [],
        tracks: [],
        previewLoadingKey: "",
        previewPlayingKey: ""
      });
      return;
    }

    this.setData({
      album,
      collectionItem,
      detailFacts: [
        { label: "发行日期", value: releaseDates.value(album) || "未记录" },
        { label: "地区", value: album.region },
        { label: "风格", value: album.style },
        { label: "介质", value: collectionItem ? getMediaFormat(collectionItem.mediumKey).label : "未收藏" },
        { label: "价格", value: collectionItem ? formatPrice(collectionItem.price) : "未收藏" },
        { label: "数量", value: collectionItem ? `${collectionItem.quantity}` : "--" },
        { label: "品相", value: collectionItem ? collectionItem.condition : "--" }
      ],
      tracks: normalizeTrackDisplayList(album.tracks || []).map((track, index) => ({
        ...track,
        previewKey: `${track.position || index + 1}:${track.title}`
      }))
    }, () => {
      this.syncPreviewPlayerState();
    });
  },
  handleTrackPreview(event) {
    const key = event.currentTarget.dataset.key;
    const index = Number(event.currentTarget.dataset.index);
    const track = this.data.tracks[index];
    const album = this.data.album;
    if (!key || !track || !album) {
      return;
    }

    const currentPreview = getPreviewPlayerState();
    const isCurrentTrack = currentPreview.visible && currentPreview.albumId === album.id && currentPreview.trackKey === key;
    if (isCurrentTrack) {
      togglePreviewPlayback();
      this.syncPreviewPlayerState();
      return;
    }

    stopPreviewPlayback();
    this.setData({
      previewLoadingKey: key,
      previewPlayingKey: ""
    });

    fetchTrackPreview(
      {
        track: track.title,
        artist: album.artist,
        album: album.title,
        country: "CN"
      },
      getApp().globalData.cloudConfig || {},
      wx
    )
      .then((preview) => {
        if (!preview || !preview.ok || !preview.streamUrl) {
          uiLocale.toast(wx,{
            title: "暂无试听",
            icon: "none"
          });
          return;
        }
        this.playPreviewAudio(preview.streamUrl, key, track);
      })
      .catch(() => {
        uiLocale.toast(wx,{
          title: "试听失败",
          icon: "none"
        });
      })
      .finally(() => {
        if (this.data.previewLoadingKey === key) {
          this.setData({ previewLoadingKey: "" });
        }
      });
  },
  playPreviewAudio(src, key, track) {
    const api = typeof wx === "undefined" ? null : wx;
    const played = playSharedPreviewAudio({
      src,
      key,
      album: this.data.album,
      track
    }, api);
    if (!played && api && typeof api.showToast === "function") {
      api.showToast({
        title: "\u5f53\u524d\u73af\u5883\u4e0d\u80fd\u8bd5\u542c",
        icon: "none"
      });
    }
  },
  stopPreviewAudio() {
    stopPreviewPlayback();
    this.setData({
      previewPlayingKey: "",
      previewLoadingKey: ""
    });
  },
  syncPreviewPlayerState(state = getPreviewPlayerState()) {
    const album = this.data.album || {};
    const isSameAlbum = state.visible && album.id && state.albumId === album.id;
    this.setData({
      previewPlayingKey: isSameAlbum && state.isPlaying ? state.trackKey : "",
      previewLoadingKey: isSameAlbum && state.isPlaying ? "" : this.data.previewLoadingKey
    });
  },
  handleMediumChange(event) {
    this.setData({
      pendingMediumKey: event.detail.value
    });
  },
  addToCollection() {
    if(this.data.uiSharedOwnerId)return;
    if (!this.data.album || this.data.collectionItem) {
      return;
    }

    const app = getApp();
    requireCloudAccount(app).then((me) => {
      if (!me) {
        return;
      }

      const now = new Date().toISOString();
      const result = confirmSelectedAlbums({
        selectedAlbumIds: [this.data.album.id],
        albums: mergeAlbumLibraries(
          albums,
          app.globalData.manualAlbums || [],
          app.globalData.recommendationAlbums || []
        ),
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
        uiLocale.toast(wx,{
          title: "\u5df2\u5728\u6536\u85cf",
          icon: "success"
        });
        return;
      }

      uiLocale.loading(wx,{ title: "\u4fdd\u5b58\u4e2d" });
      app.saveCollectionToCloud(result.createdItems[0], this.data.album)
        .then((payload) => {
          if (!payload) {
            showCloudSaveFailed();
            return;
          }

          this.loadAlbumDetail(this.data.album.id);
          uiLocale.toast(wx,{
            title: "\u5df2\u52a0\u5165\u6536\u85cf",
            icon: "success"
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
    });
    return;
  },
  openEdit() {
    if(this.data.uiSharedOwnerId)return;
    if (!this.data.album) {
      return;
    }

    wx.navigateTo({
      url: `/pages/collection-edit/index?albumId=${this.data.album.id}`
    });
  },
  onShareAppMessage() {
    const app = getApp();
    const name = this.uiSharedPayload?.owner?.displayName || app.globalData.userProfile?.name || "\u5531\u7247\u67dc\u7528\u6237";
    const album = this.data.album;
    if (!album) return createShareMessage();

    return createShareMessage({
      title: this.data.collectionItem ? `${name}收藏的 ${album.title}` : `${name}的唱片柜 · ${album.title}`,
      path: this.data.uiSharedOwnerId?`/pages/all-collection/index?ownerId=${encodeURIComponent(this.data.uiSharedOwnerId)}`:`/pages/album-detail/index?albumId=${album.id}`,
      imageUrl: album.cover
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
},"专辑详情"));
