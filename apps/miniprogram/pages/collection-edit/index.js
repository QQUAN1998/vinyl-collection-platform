const { albums, featuredAlbumId } = require("../../data/seed.js");
const { removeCollectionItem, updateCollectionItem } = require("../../services/collection-service.js");
const {
  findAlbumInLibrary,
  toAlbumView
} = require("../../services/album-library-service.js");
const { requireCloudAccount, showCloudDeleteFailed, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS, normalizeMediumKey } = require("../../services/media-format-service.js");
const {
  addEditableTrack,
  normalizeEditableTracks,
  removeEditableTrack,
  updateEditableTrack
} = require("../../services/album-edit-service.js");

Page({
  data: {
    album: null,
    collectionForm: {
      collectionDate: "",
      source: "",
      quantity: 1,
      condition: "",
      mediumKey: DEFAULT_MEDIUM_KEY,
      price: "",
      notes: ""
    },
    mediaFormats: MEDIA_FORMATS,
    errorMessage: ""
  },
  onLoad(options = {}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadCollectionForm(options.albumId || featuredAlbumId);
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  loadCollectionForm(albumId) {
    const app = getApp();
    const album = findAlbumInLibrary(albumId, albums, app.globalData.manualAlbums || []);
    const collectionItem = (app.globalData.collectionItems || []).find((item) => item.albumId === albumId);

    if (!album || !collectionItem) {
      this.setData({
        album: album ? {
          ...toAlbumView(album),
          yearLabel: album.year || album.releaseYear || "未记录",
          tracks: normalizeEditableTracks(album.tracks || [])
        } : null,
        errorMessage: "这张唱片还没有收藏记录。"
      });
      return;
    }

    this.setData({
      album: {
        ...toAlbumView(album),
        yearLabel: album.year || album.releaseYear || "未记录",
        tracks: normalizeEditableTracks(album.tracks || [])
      },
      collectionForm: {
        collectionDate: collectionItem.collectionDate,
        source: collectionItem.source,
        quantity: collectionItem.quantity,
        condition: collectionItem.condition,
        mediumKey: normalizeMediumKey(collectionItem.mediumKey),
        price: collectionItem.price === undefined ? "" : `${collectionItem.price}`,
        notes: collectionItem.notes || ""
      },
      errorMessage: ""
    });
  },
  handleFieldChange(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({
      collectionForm: {
        ...this.data.collectionForm,
        [key]: event.detail.value
      }
    });
  },
  handleMediumChange(event) {
    this.setData({
      collectionForm: {
        ...this.data.collectionForm,
        mediumKey: event.detail.value
      }
    });
  },
  addTrack() {
    const tracks = addEditableTrack(this.data.album.tracks || []);
    if (tracks === this.data.album.tracks) {
      wx.showToast({ title: "最多添加 80 首曲目", icon: "none" });
      return;
    }
    this.setData({ "album.tracks": tracks });
  },
  handleTrackTitleInput(event) {
    const { index } = event.currentTarget.dataset;
    this.setData({
      "album.tracks": updateEditableTrack(this.data.album.tracks || [], index, event.detail.value)
    });
  },
  removeTrack(event) {
    const { index } = event.currentTarget.dataset;
    this.setData({
      "album.tracks": removeEditableTrack(this.data.album.tracks || [], index)
    });
  },
  chooseAlbumCover() {
    const applyCover = (cover) => {
      if (!cover) {
        return;
      }
      this.setData({
        album: {
          ...this.data.album,
          cover
        }
      });
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
        success: (result) => {
          applyCover(result.tempFiles && result.tempFiles[0] && result.tempFiles[0].tempFilePath);
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (result) => {
        applyCover(result.tempFilePaths && result.tempFilePaths[0]);
      }
    });
  },
  async saveCollection() {
    if (!this.data.album) {
      return;
    }

    const app = getApp();
    const me = await requireCloudAccount(app);
    if (!me) {
      return;
    }

    const patch = {
      ...this.data.collectionForm,
      quantity: Number(this.data.collectionForm.quantity || 1),
      price: this.data.collectionForm.price === "" ? undefined : Number(this.data.collectionForm.price)
    };
    const result = updateCollectionItem({
      collectionItems: app.globalData.collectionItems || [],
      albumId: this.data.album.id,
      patch
    });
    const syncResult = triggerTvSync(app.globalData.tvBindings || [], app.globalData.userId);

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d", mask: true });
    try {
      const cover = await app.uploadAlbumCoverIfNeeded(this.data.album.cover, this.data.album.id);
      const editedAlbum = {
        ...this.data.album,
        cover,
        coverUrl: cover,
        tracks: normalizeEditableTracks(this.data.album.tracks || [])
      };
      const payload = await app.saveCollectionToCloud(result.updatedItem, editedAlbum);
      if (!payload) {
        showCloudSaveFailed();
        return;
      }

      app.globalData.tvBindings = syncResult.bindings;
      wx.showToast({ title: "\u5df2\u4fdd\u5b58", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      wx.showToast({
        title: error && error.message ? error.message : "保存失败，请稍后重试",
        icon: "none"
      });
    } finally {
      wx.hideLoading();
    }
    return;
  },
  confirmDeleteCollection() {
    if (!this.data.album) {
      return;
    }

    wx.showModal({
      title: "删除唱片",
      content: `确认从收藏中删除《${this.data.album.title}》吗？`,
      confirmText: "删除",
      confirmColor: "#b96d5b",
      success: (result) => {
        if (result.confirm) {
          this.deleteCollection();
        }
      }
    });
  },
  async deleteCollection() {
    if (!this.data.album) {
      return;
    }

    const app = getApp();
    const me = await requireCloudAccount(app);
    if (!me) {
      return;
    }

    const result = removeCollectionItem({
      collectionItems: app.globalData.collectionItems || [],
      albumId: this.data.album.id
    });

    wx.showLoading({ title: "\u5220\u9664\u4e2d" });
    app.deleteCollectionFromCloud(result.removedItem.id)
      .then((payload) => {
        if (!payload) {
          showCloudDeleteFailed();
          return;
        }

        wx.showToast({
          title: "\u5df2\u5220\u9664",
          icon: "success"
        });
        wx.navigateBack();
      })
      .finally(() => {
        wx.hideLoading();
      });
  },
  cancelEdit() {
    wx.navigateBack();
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
