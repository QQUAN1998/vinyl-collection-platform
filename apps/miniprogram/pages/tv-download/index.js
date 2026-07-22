const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  TV_APK_FILE_NAME,
  downloadAndShareTvApk,
} = require("../../services/tv-apk-service.js");

function formatDownloadError(error) {
  const message = error && (error.errMsg || error.message) ? (error.errMsg || error.message) : "APK 下载失败";
  if (message.includes("domain list")) {
    return "下载域名暂未启用，请稍后再试";
  }
  if (message.includes("cancel")) {
    return "";
  }
  return Array.from(message).slice(0, 24).join("");
}

Page({
  data: {
    fileName: TV_APK_FILE_NAME,
    fileSize: "约 336 KB",
    downloading: false,
    downloadProgress: 0,
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  handleDownloadShare() {
    if (this.data.downloading) return;

    this.setData({ downloading: true, downloadProgress: 0 });
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
        wx.showToast({ title: "请选择微信好友", icon: "success" });
      })
      .catch((error) => {
        const title = formatDownloadError(error);
        if (title) {
          wx.showToast({ title, icon: "none" });
        }
      })
      .finally(() => {
        wx.hideLoading();
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
