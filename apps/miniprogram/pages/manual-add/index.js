const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { requireCloudAccount, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const { DEFAULT_MEDIUM_KEY, MEDIA_FORMATS } = require("../../services/media-format-service.js");

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

Page({
  data: {
    cover: "",
    manualForm: {
      title: "",
      artist: "",
      year: "",
      style: "",
      collectionDate: todayText(),
      source: "手动添加",
      quantity: "1",
      condition: "NM",
      mediumKey: DEFAULT_MEDIUM_KEY,
      price: "",
      notes: ""
    },
    mediaFormats: MEDIA_FORMATS
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  handleFieldChange(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({
      manualForm: {
        ...this.data.manualForm,
        [key]: event.detail.value
      }
    });
  },
  handleMediumChange(event) {
    this.setData({
      manualForm: {
        ...this.data.manualForm,
        mediumKey: event.detail.value
      }
    });
  },
  chooseAlbumCover() {
    const applyCover = (cover) => {
      if (!cover) return;
      this.setData({ cover });
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
  async saveManualAlbum() {
    const app = getApp();
    const form = this.data.manualForm;
    const title = form.title.trim();
    const artist = form.artist.trim();

    if (!title || !artist) {
      wx.showToast({
        title: "请填写专辑名和艺人",
        icon: "none"
      });
      return;
    }

    const me = await requireCloudAccount(app);
    if (!me) {
      return;
    }

    const now = new Date().toISOString();
    const albumId = `manual-${Date.now()}`;
    const album = {
      id: albumId,
      title,
      artist,
      year: Number(form.year || new Date().getFullYear()),
      region: "未记录",
      style: form.style.trim() || "未分类",
      cover: this.data.cover || "/covers/E493418C-7D4C-4114-9475-7DD55918D8D6.webp",
      tracks: []
    };
    const collectionItem = {
      id: `collection-${albumId}`,
      userId: app.globalData.userId,
      albumId,
      collectionDate: form.collectionDate || todayText(),
      source: form.source || "手动添加",
      quantity: Number(form.quantity || 1),
      condition: form.condition || "NM",
      mediumKey: form.mediumKey || DEFAULT_MEDIUM_KEY,
      price: form.price === "" ? undefined : Number(form.price),
      notes: form.notes || "",
      createdAt: now,
      updatedAt: now
    };
    const syncResult = triggerTvSync(app.globalData.tvBindings || [], app.globalData.userId, now);

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
    app.saveCollectionToCloud(collectionItem, album)
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
  cancelManualAdd() {
    wx.navigateBack();
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
