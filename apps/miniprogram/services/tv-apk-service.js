const TV_APK_FILE_NAME = "唱片柜-TV.apk";
const TV_APK_PUBLIC_URL = "https://vinyl-prod-d0g8u61k95ee7a1e6-1314675814.tcloudbaseapp.com/downloads/vinyl-cabinet-tv-1.0.66.7.apk";

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  if (typeof wx === "undefined") return null;
  return wx;
}

function downloadAndShareTvApk(options = {}, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.downloadFile !== "function") {
    return Promise.reject(new Error("当前微信版本不支持下载文件"));
  }
  if (typeof api.shareFileMessage !== "function") {
    return Promise.reject(new Error("当前微信版本不支持文件分享"));
  }

  const userPath = api.env && api.env.USER_DATA_PATH ? api.env.USER_DATA_PATH : "";
  if (!userPath) {
    return Promise.reject(new Error("无法访问微信文件目录"));
  }

  const fileName = options.fileName || TV_APK_FILE_NAME;
  const filePath = `${userPath}/${fileName}`;
  const url = options.url || TV_APK_PUBLIC_URL;

  return new Promise((resolve, reject) => {
    const startDownload = () => {
      let task;
      try {
        task = api.downloadFile({
          url,
          filePath,
          success(response = {}) {
            const statusCode = Number(response.statusCode || 0);
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(`APK download failed with status ${statusCode || "unknown"}.`));
              return;
            }

            const downloadedPath = response.filePath || response.tempFilePath || filePath;
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
    };

    const fs = typeof api.getFileSystemManager === "function" ? api.getFileSystemManager() : null;
    if (fs && typeof fs.unlink === "function") {
      fs.unlink({ filePath, complete: startDownload });
      return;
    }
    startDownload();
  });
}

module.exports = {
  TV_APK_FILE_NAME,
  TV_APK_PUBLIC_URL,
  downloadAndShareTvApk,
};
