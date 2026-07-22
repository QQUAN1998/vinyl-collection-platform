const { TV_PACKAGE_BASE64 } = require("./tv-package-data.js");

const TV_PACKAGE_FILE_NAME = "唱片柜-TV.zip";
const TV_PACKAGE_CLOUD_FILE_ID = "cloud://vinyl-prod-d0g8u61k95ee7a1e6.7669-vinyl-prod-d0g8u61k95ee7a1e6-1314675814/downloads/vinyl-cabinet-tv-1.0.66.7.zip";
const TV_PACKAGE_PUBLIC_URL = "https://vinyl-prod-d0g8u61k95ee7a1e6-1314675814.tcloudbaseapp.com/downloads/vinyl-cabinet-tv-1.0.66.7.zip";

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  if (typeof wx === "undefined") return null;
  return wx;
}

function readErrorMessage(error) {
  if (!error) return "APK 下载失败";
  return String(error.errMsg || error.message || error);
}

function formatTvApkDownloadError(error) {
  const detail = Array.from(readErrorMessage(error)).slice(0, 120).join("");
  const normalized = detail.toLowerCase();

  if (normalized.includes("cancel")) {
    return { cancelled: true, title: "", message: "", detail };
  }
  if (normalized.includes("domain list")) {
    return {
      cancelled: false,
      title: "下载通道未启用",
      message: "APK 下载域名暂未启用，请稍后再试。",
      detail,
    };
  }
  if (normalized.includes("sharefilemessage") || normalized.includes("不支持文件分享")) {
    return {
      cancelled: false,
      title: "微信版本不支持",
      message: "请升级微信后再下载并分享电视版安装包。",
      detail,
    };
  }
  return {
    cancelled: false,
    title: "下载失败",
    message: "安装包未能下载或分享，请检查网络后重试。",
    detail,
  };
}

function downloadAndShareTvApk(options = {}, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.shareFileMessage !== "function") {
    return Promise.reject(new Error("当前微信版本不支持文件分享"));
  }

  const fileName = options.fileName || TV_PACKAGE_FILE_NAME;
  const cloudFileId = options.cloudFileId || TV_PACKAGE_CLOUD_FILE_ID;
  const url = options.url || TV_PACKAGE_PUBLIC_URL;

  return new Promise((resolve, reject) => {
    const sharePackage = (filePath, source) => {
      api.shareFileMessage({
        filePath,
        fileName,
        success() {
          resolve({ filePath, fileName, source, url });
        },
        fail: reject,
      });
    };

    const downloadRemotePackage = () => {
      const cloudDownload = api.cloud && typeof api.cloud.downloadFile === "function"
        ? api.cloud.downloadFile.bind(api.cloud)
        : null;
      const publicDownload = typeof api.downloadFile === "function"
        ? api.downloadFile.bind(api)
        : null;
      const download = cloudDownload || publicDownload;
      if (!download) {
        reject(new Error("当前微信版本不支持下载文件"));
        return;
      }

      let task;
      try {
        task = download({
          ...(cloudDownload ? { fileID: cloudFileId } : { url }),
        success(response = {}) {
          const statusCode = Number(response.statusCode || 0);
          if (statusCode && (statusCode < 200 || statusCode >= 300)) {
            reject(new Error(`TV package download failed with status ${statusCode || "unknown"}.`));
            return;
          }

          const downloadedPath = response.tempFilePath || response.filePath || "";
          if (!downloadedPath) {
            reject(new Error("TV package download completed without a temporary file."));
            return;
          }
          sharePackage(downloadedPath, cloudDownload ? "cloud" : "public");
        },
        fail: reject,
      });
      } catch (error) {
        reject(error);
        return;
      }

      if (task && typeof task.onProgressUpdate === "function" && typeof options.onProgress === "function") {
        task.onProgressUpdate((progress = {}) => {
          options.onProgress(Number(progress.progress || 0));
        });
      }
    };

    const userPath = api.env && api.env.USER_DATA_PATH ? api.env.USER_DATA_PATH : "";
    const fs = typeof api.getFileSystemManager === "function" ? api.getFileSystemManager() : null;
    if (userPath && fs && typeof fs.writeFile === "function") {
      const filePath = `${userPath}/${fileName}`;
      fs.writeFile({
        filePath,
        data: TV_PACKAGE_BASE64,
        encoding: "base64",
        success() {
          if (typeof options.onProgress === "function") options.onProgress(100);
          sharePackage(filePath, "bundled");
        },
        fail: downloadRemotePackage,
      });
      return;
    }

    downloadRemotePackage();
  });
}

module.exports = {
  TV_PACKAGE_FILE_NAME,
  TV_PACKAGE_CLOUD_FILE_ID,
  TV_PACKAGE_PUBLIC_URL,
  downloadAndShareTvApk,
  formatTvApkDownloadError,
};
