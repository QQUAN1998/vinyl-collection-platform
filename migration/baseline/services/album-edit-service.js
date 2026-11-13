const MAX_TRACK_COUNT = 80;
const MAX_TRACK_TITLE_LENGTH = 200;
const DEFAULT_UPLOAD_TIMEOUT_MS = 20000;

function normalizeEditableTracks(tracks = []) {
  return (tracks || [])
    .slice(0, MAX_TRACK_COUNT)
    .map((track) => typeof track === "string" ? track : track && track.title)
    .map((title) => String(title || "").trim().slice(0, MAX_TRACK_TITLE_LENGTH))
    .filter(Boolean)
    .map((title, index) => ({ position: index + 1, title }));
}

function addEditableTrack(tracks = []) {
  if (tracks.length >= MAX_TRACK_COUNT) {
    return tracks;
  }
  return [...tracks, { position: tracks.length + 1, title: "" }];
}

function updateEditableTrack(tracks = [], index, title) {
  return tracks.map((track, trackIndex) => trackIndex === Number(index)
    ? { ...track, title: String(title || "").slice(0, MAX_TRACK_TITLE_LENGTH) }
    : track);
}

function removeEditableTrack(tracks = [], index) {
  return tracks
    .filter((_, trackIndex) => trackIndex !== Number(index))
    .map((track, trackIndex) => ({ ...track, position: trackIndex + 1 }));
}

function isTemporaryImagePath(value) {
  const path = String(value || "").trim();
  return /^(wxfile:|file:|blob:|https?:\/\/tmp\/)/i.test(path)
    || /^\/(tmp|var\/|private\/)/i.test(path);
}

function safePathPart(value, fallback) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || fallback;
}

function imageExtension(path) {
  const matched = String(path || "").match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
  const extension = matched ? matched[1].toLowerCase() : "jpg";
  return ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(extension) ? extension : "jpg";
}

function uploadAlbumCover(options = {}) {
  const cover = String(options.cover || "").trim();
  if (!cover || !isTemporaryImagePath(cover)) {
    return Promise.resolve(cover);
  }

  const wxApi = options.wxApi || (typeof wx === "undefined" ? null : wx);
  if (!wxApi || !wxApi.cloud || typeof wxApi.cloud.uploadFile !== "function") {
    return Promise.reject(new Error("封面上传服务暂不可用"));
  }

  const userId = safePathPart(options.userId, "user");
  const albumId = safePathPart(options.albumId, "album");
  const now = options.now === undefined ? Date.now() : options.now;
  const cloudPath = `album-covers/${userId}/${albumId}/${now}.${imageExtension(cover)}`;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    let settled = false;
    let uploadTask;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      if (uploadTask && typeof uploadTask.abort === "function") {
        uploadTask.abort();
      }
      finish(reject, new Error("封面上传超时，请检查网络后重试"));
    }, timeoutMs);

    try {
      uploadTask = wxApi.cloud.uploadFile({
        cloudPath,
        filePath: cover,
        success(result) {
          if (!result || !result.fileID) {
            finish(reject, new Error("封面上传失败，请重试"));
            return;
          }
          finish(resolve, result.fileID);
        },
        fail() {
          finish(reject, new Error("封面上传失败，请检查网络后重试"));
        }
      });
    } catch (error) {
      finish(reject, error);
    }
  });
}

module.exports = {
  addEditableTrack,
  isTemporaryImagePath,
  normalizeEditableTracks,
  removeEditableTrack,
  updateEditableTrack,
  uploadAlbumCover
};
