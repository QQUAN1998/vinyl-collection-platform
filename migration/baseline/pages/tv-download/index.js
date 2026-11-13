const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  TV_PACKAGE_FILE_NAME,
  downloadAndShareTvApk,
  formatTvApkDownloadError,
} = require("../../services/tv-apk-service.js");

Page({
  data: {
    fileName: TV_PACKAGE_FILE_NAME,
    fileSize: "约 330 KB",
    downloading: false,
    downloadProgress: 0,
    downloadError: "",
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  handleDownloadShare() {
    if (this.data.downloading) return;

    this.setData({ downloading: true, downloadProgress: 0, downloadError: "" });
    wx.showLoading({ title: "准备安装包" });
    downloadAndShareTvApk({
      onProgress: (downloadProgress) => {
        this.setData({ downloadProgress });
        if (downloadProgress > 0) {
          wx.showLoading({ title: `下载 ${downloadProgress}%` });
        }
      },
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: "压缩包已分享", icon: "success" });
      })
      .catch((error) => {
        wx.hideLoading();
        const failure = formatTvApkDownloadError(error);
        if (!failure.cancelled) {
          this.setData({ downloadError: failure.message });
          wx.showModal({
            title: failure.title,
            content: `${failure.message}\n诊断：${failure.detail}`,
            showCancel: false,
            confirmText: "知道了",
          });
        }
      })
      .finally(() => {
        this.setData({ downloading: false });
      });
  },
  onShareAppMessage() {
    return createShareMessage({
      title: "唱片柜电视版安装指引",
      path: "/pages/tv-download/index",
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  },
});
