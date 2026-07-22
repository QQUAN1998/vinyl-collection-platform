const TV_APK_FILE_NAME = "唱片柜-TV.apk";
const TV_APK_PUBLIC_URL = "https://vinyl-prod-d0g8u61k95ee7a1e6-1314675814.tcloudbaseapp.com/downloads/vinyl-cabinet-tv-1.0.66.7.apk";

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
      message: "请升级微信后再下载并分享 APK。",
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
  if (!api || typeof api.downloadFile !== "function") {
    return Promise.reject(new Error("当前微信版本不支持下载文件"));
  }
  if (typeof api.shareFileMessage !== "function") {
    return Promise.reject(new Error("当前微信版本不支持文件分享"));
  }

  const fileName = options.fileName || TV_APK_FILE_NAME;
  const url = options.url || TV_APK_PUBLIC_URL;

  return new Promise((resolve, reject) => {
    let task;
    try {
      task = api.downloadFile({
        url,
        success(response = {}) {
          const statusCode = Number(response.statusCode || 0);
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`APK download failed with status ${statusCode || "unknown"}.`));
            return;
          }

          const downloadedPath = response.tempFilePath || response.filePath || "";
          if (!downloadedPath) {
            reject(new Error("APK download completed without a temporary file."));
            return;
          }
          api.shareFileMessage({
            filePath: downloadedPath,
            fileName,
            success() {
              resolve({ filePath: downloadedPath, fileName, url });
            },
            fail: reject,
          });
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
  });
}

module.exports = {
  TV_APK_FILE_NAME,
  TV_APK_PUBLIC_URL,
  downloadAndShareTvApk,
  formatTvApkDownloadError,
};
