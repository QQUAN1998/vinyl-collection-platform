const { albums, featuredAlbumId } = require("../../data/seed.js");
const { updateCollectionItem } = require("../../services/collection-service.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS, normalizeMediumKey } = require("../../services/media-format-service.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: `/${album.coverUrl}`,
    styles: album.style
  };
}

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
    this.loadCollectionForm(options.albumId || featuredAlbumId);
  },
  loadCollectionForm(albumId) {
    const app = getApp();
    const album = albums.find((item) => item.id === albumId);
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
  saveCollection() {
    if (!this.data.album) {
      return;
    }

    const app = getApp();
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

    app.globalData.collectionItems = result.collectionItems;
    app.globalData.tvBindings = syncResult.bindings;
    if (typeof app.refreshUserLabel === "function") {
      app.refreshUserLabel();
    }
    if (typeof app.saveCollectionToCloud === "function") {
      app.saveCollectionToCloud(result.updatedItem, this.data.album);
    }

    wx.showToast({
      title: "已保存",
      icon: "success"
    });

    wx.navigateBack();
  },
  cancelEdit() {
    wx.navigateBack();
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
