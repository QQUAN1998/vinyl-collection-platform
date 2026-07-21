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
        album: album ? toAlbumView(album) : null,
        errorMessage: "这张唱片还没有收藏记录。"
      });
      return;
    }

    this.setData({
      album: toAlbumView(album),
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
        success: (result) => {
          applyCover(result.tempFiles && result.tempFiles[0] && result.tempFiles[0].tempFilePath);
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
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

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
    app.saveCollectionToCloud(result.updatedItem, this.data.album)
      .then((payload) => {
        if (!payload) {
          showCloudSaveFailed();
          return;
        }

        app.globalData.tvBindings = syncResult.bindings;
        wx.showToast({
          title: "\u5df2\u4fdd\u5b58",
          icon: "success"
        });
        wx.navigateBack();
      })
      .finally(() => {
        wx.hideLoading();
      });
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
