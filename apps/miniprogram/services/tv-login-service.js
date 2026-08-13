const { findAlbumInLibrary } = require("./album-library-service.js");
const { callCloudContainer, callPublicApi } = require("./cloud-api.js");

const DEFAULT_TV_BASE_URL = "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54";
const MAX_TV_LOGIN_TRACKS = 12;
const MAX_TV_COMPACT_TRACKS = 8;
const MAX_CLOUD_FILE_URL_BATCH = 50;

function parseTvLoginQr(rawValue, options = {}) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    throw new Error("\u6ca1\u6709\u8bc6\u522b\u5230\u7535\u89c6\u767b\u5f55\u4e8c\u7ef4\u7801");
  }

  const json = parseJson(raw);
  if (json) {
    const code = normalizeCode(json.code || json.sessionCode || json.deviceCode);
    const confirmUrl = json.confirmUrl || buildConfirmUrl(json.scanUrl || "", code, options);
    if (code && confirmUrl) {
      return { code, confirmUrl, scanUrl: json.scanUrl || "" };
    }
  }

  const codeFromPath = normalizeCode(extractCodeFromPath(raw));
  if (codeFromPath) {
    return {
      code: codeFromPath,
      confirmUrl: buildConfirmUrl(raw, codeFromPath, options),
      scanUrl: raw
    };
  }

  const codeFromQuery = normalizeCode(extractQueryValue(raw, "code") || extractQueryValue(raw, "session"));
  if (codeFromQuery) {
    return {
      code: codeFromQuery,
      confirmUrl: buildConfirmUrl(raw, codeFromQuery, options),
      scanUrl: raw
    };
  }

  const rawCode = normalizeCode(raw);
  if (rawCode) {
    return {
      code: rawCode,
      confirmUrl: `${resolveTvBaseUrl(options)}/cloud/vinyl-data/tv-login/session/${rawCode}/confirm`,
      scanUrl: ""
    };
  }

  throw new Error("\u8fd9\u4e0d\u662f David \u5531\u7247\u67dc TV \u767b\u5f55\u4e8c\u7ef4\u7801");
}

function buildTvLoginConfirmPayload(app, seedAlbums = []) {
  const globalData = app && app.globalData ? app.globalData : {};
  const collectionItems = globalData.collectionItems || [];
  const manualAlbums = globalData.manualAlbums || [];
  return {
    userId: globalData.userId || "david",
    userName: (globalData.userProfile && globalData.userProfile.name) || "\u5531\u7247\u67dc\u7528\u6237",
    albums: collectionItems
      .map((item) => toTvAlbum(item, seedAlbums, manualAlbums))
      .filter(Boolean)
  };
}

function confirmTvLoginWithQr(rawValue, app, seedAlbums = [], options = {}, wxApi) {
  const parsed = parseTvLoginQr(rawValue, options);
  const payload = buildTvLoginConfirmPayload(app, seedAlbums);

  return resolveTvCloudCovers(payload, wxApi).then((resolvedPayload) => {
    const directConfirm = () => postJson(parsed.confirmUrl, resolvedPayload, wxApi);
    const proxyConfirm = () => postTvLoginConfirmThroughCloud(parsed, resolvedPayload, options, wxApi);
    const confirmRequest = shouldUseCloudConfirmFirst(parsed.confirmUrl, options)
      ? proxyConfirm().catch((proxyError) =>
          directConfirm().catch((directError) => Promise.reject(combineTvLoginErrors(proxyError, directError)))
        )
      : directConfirm().catch((directError) =>
          proxyConfirm().catch((proxyError) => Promise.reject(combineTvLoginErrors(proxyError, directError)))
        );

    return confirmRequest.then((response) => ({
      ...response,
      code: response && response.code ? response.code : parsed.code,
      syncedAlbumCount: resolvedPayload.albums.length
    }));
  });
}

function resolveTvCloudCovers(payload = {}, wxApi) {
  const albums = Array.isArray(payload.albums) ? payload.albums : [];
  const cloudCovers = [...new Set(albums
    .map((album) => String(album.cover || "").trim())
    .filter((cover) => cover.startsWith("cloud://")))];
  if (!cloudCovers.length) {
    return Promise.resolve(payload);
  }

  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!api || !api.cloud || typeof api.cloud.getTempFileURL !== "function") {
    return Promise.resolve(payload);
  }

  const batches = [];
  for (let index = 0; index < cloudCovers.length; index += MAX_CLOUD_FILE_URL_BATCH) {
    batches.push(cloudCovers.slice(index, index + MAX_CLOUD_FILE_URL_BATCH));
  }

  return Promise.all(batches.map((fileList) => api.cloud.getTempFileURL({ fileList })))
    .then((results) => {
      const resolved = new Map(results.flatMap((result) => result && result.fileList ? result.fileList : [])
        .filter((file) => file && file.fileID && /^https?:\/\//.test(file.tempFileURL || ""))
        .map((file) => [file.fileID, file.tempFileURL]));
      return {
        ...payload,
        albums: albums.map((album) => ({
          ...album,
          cover: resolved.get(album.cover) || album.cover
        }))
      };
    })
    .catch(() => payload);
}

function postTvLoginConfirmThroughCloud(parsed, payload, options = {}, wxApi) {
  const path = `/cloud/vinyl-data/tv-login/session/${encodeURIComponent(parsed.code)}/proxy-confirm`;
  const publicRequest = {
    method: "POST",
    data: buildTvLoginProxyPayload(parsed, payload)
  };
  const containerRequest = {
    method: "POST",
    data: buildTvLoginProxyPayload(parsed, compactTvLoginPayload(payload))
  };

  return callPublicApi(path, publicRequest, options, wxApi)
    .catch((publicError) =>
      callCloudContainer(path, containerRequest, options, wxApi)
        .catch((containerError) => Promise.reject(combineProxyErrors(publicError, containerError)))
    );
}

function buildTvLoginProxyPayload(parsed, payload) {
  return {
    ...payload,
    confirmUrl: parsed.confirmUrl,
    scanUrl: parsed.scanUrl || ""
  };
}

function shouldUseCloudConfirmFirst(confirmUrl, options = {}) {
  if (options.forceTvConfirmProxy === false) {
    return false;
  }
  if (options.forceTvConfirmProxy === true) {
    return true;
  }
  const url = String(confirmUrl || "");
  return url.indexOf(DEFAULT_TV_BASE_URL) === 0 || /aiforce\.cloud/.test(url);
}

function toTvAlbum(collectionItem, seedAlbums, manualAlbums) {
  const album = findAlbumInLibrary(collectionItem.albumId, seedAlbums, manualAlbums);
  if (!album) {
    return null;
  }

  const year = Number(album.year || album.releaseYear || 0) || null;
  const tracks = normalizeTracks(album.tracks || album.tracksPreview || album.songs || [], album.artist);
  const songsForLogin = tracks.slice(0, MAX_TV_LOGIN_TRACKS);
  return {
    id: album.id,
    title: album.title || "",
    artist: album.artist || "",
    year,
    decade: year ? `${Math.floor(year / 10) * 10}s` : "\u672a\u77e5",
    collectionDate: collectionItem.collectionDate || new Date().toISOString(),
    collectionYear: Number(String(collectionItem.collectionDate || "").slice(0, 4)) || new Date().getFullYear(),
    source: collectionItem.source || "\u5c0f\u7a0b\u5e8f\u540c\u6b65",
    condition: collectionItem.condition || "",
    notes: collectionItem.notes || "",
    region: album.region || "\u672a\u8bb0\u5f55",
    style: album.style || album.genre || "\u672a\u5206\u7c7b",
    songStyles: [album.style || album.genre || "\u672a\u5206\u7c7b"],
    price: Number(collectionItem.price || 0),
    quantity: Number(collectionItem.quantity || 1),
    songCount: tracks.length,
    duration: tracks.reduce((sum, track) => sum + Number(track.duration || 0), 0),
    cover: toTvCover(album.coverUrl || album.cover || album.coverThumbUrl || ""),
    songs: songsForLogin
  };
}

function normalizeTracks(tracks, fallbackArtist) {
  return (tracks || [])
    .map((track, index) => {
      if (typeof track === "string") {
        return {
          title: track,
          artist: fallbackArtist || "",
          duration: 0,
          orderNumber: index + 1
        };
      }
      const duration = track.duration !== undefined
        ? Number(track.duration || 0)
        : Math.round(Number(track.durationMs || 0) / 1000);
      return {
        title: track.title || "",
        artist: track.artist || fallbackArtist || "",
        duration,
        orderNumber: Number(track.orderNumber || track.position || index + 1)
      };
    })
    .filter((track) => track.title);
}

function toTvCover(value) {
  const cover = String(value || "").trim();
  if (!cover) return "";
  if (/^(https?:|cloud:|data:)/.test(cover)) {
    return cover;
  }

  const fileName = cover.split(/[\\/]/).filter(Boolean).pop();
  if (!fileName) return "";
  return `cloud/vinyl-data/cover/${fileName}`;
}

function compactTvLoginPayload(payload = {}) {
  return {
    userId: payload.userId,
    userName: payload.userName,
    albums: (payload.albums || []).map(toCompactTvAlbum)
  };
}

function toCompactTvAlbum(album, index) {
  return {
    id: String(index + 1),
    title: album.title || "",
    artist: album.artist || "",
    year: album.year || null,
    cover: album.cover || "",
    price: Number(album.price || 0),
    quantity: Number(album.quantity || 1),
    songCount: Number(album.songCount || 0),
    songs: compactTvSongs(album.songs || [])
  };
}

function compactTvSongs(songs) {
  return (songs || [])
    .slice(0, MAX_TV_COMPACT_TRACKS)
    .map((song, index) => ({
      title: song.title || "",
      artist: song.artist || "",
      duration: Number(song.duration || 0),
      orderNumber: Number(song.orderNumber || index + 1)
    }))
    .filter((song) => song.title);
}

function measureTvLoginPayloadBytes(payload) {
  if (typeof Buffer !== "undefined" && Buffer.byteLength) {
    return Buffer.byteLength(JSON.stringify(payload));
  }
  return JSON.stringify(payload).length;
}

function postJson(url, data, wxApi) {
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!api || typeof api.request !== "function") {
    return Promise.reject(new Error("WeChat request is not available."));
  }

  return new Promise((resolve, reject) => {
    api.request({
      url,
      method: "POST",
      data,
      header: { "content-type": "application/json" },
      success(response = {}) {
        const statusCode = Number(response.statusCode || 0);
        if (statusCode >= 200 && statusCode < 300) {
          resolve(response.data || {});
          return;
        }
        reject(new Error(`TV login confirm failed with ${statusCode || "unknown status"}.`));
      },
      fail(error) {
        reject(error || new Error("TV login confirm failed."));
      }
    });
  });
}

function combineProxyErrors(publicError, containerError) {
  const error = new Error(
    `TV proxy confirm failed. public=${formatErrorForDiagnostic(publicError)}; container=${formatErrorForDiagnostic(containerError)}`
  );
  error.publicError = publicError;
  error.containerError = containerError;
  return error;
}

function combineTvLoginErrors(primaryError, fallbackError) {
  const error = new Error(
    `TV login confirm failed. proxy=${formatErrorForDiagnostic(primaryError)}; direct=${formatErrorForDiagnostic(fallbackError)}`
  );
  error.proxyError = primaryError;
  error.directError = fallbackError;
  return error;
}

function formatErrorForDiagnostic(error) {
  if (!error) {
    return "unknown";
  }
  const statusCode = error.statusCode ? `status ${error.statusCode}` : "";
  const message = error.message || String(error);
  return [statusCode, message].filter(Boolean).join(" ");
}

function buildConfirmUrl(scanUrl, code, options = {}) {
  const normalizedCode = normalizeCode(code);
  const raw = String(scanUrl || "").trim();
  if (raw && /\/cloud\/vinyl-data\/tv-login\/session\/[^/?#]+\/confirm/.test(raw)) {
    return raw;
  }
  if (raw && /\/cloud\/vinyl-data\/tv-login\/[^/?#]+\/scan/.test(raw)) {
    return raw.replace(/\/cloud\/vinyl-data\/tv-login\/[^/?#]+\/scan.*/, `/cloud/vinyl-data/tv-login/session/${normalizedCode}/confirm`);
  }

  const base = raw.includes("/cloud/vinyl-data")
    ? raw.slice(0, raw.indexOf("/cloud/vinyl-data"))
    : resolveTvBaseUrl(options);
  return `${base.replace(/\/+$/, "")}/cloud/vinyl-data/tv-login/session/${normalizedCode}/confirm`;
}

function extractCodeFromPath(value) {
  const match = String(value || "").match(/\/cloud\/vinyl-data\/tv-login\/(?:session\/)?([a-zA-Z0-9_-]+)(?:\/scan|\/confirm)?/);
  return match ? match[1] : "";
}

function extractQueryValue(value, key) {
  const match = String(value || "").match(new RegExp(`[?&]${key}=([^&#]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{4,16}$/.test(code) ? code : "";
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function resolveTvBaseUrl(options = {}) {
  return String(options.tvBaseUrl || DEFAULT_TV_BASE_URL).replace(/\/+$/, "");
}

module.exports = {
  DEFAULT_TV_BASE_URL,
  MAX_TV_COMPACT_TRACKS,
  MAX_TV_LOGIN_TRACKS,
  buildTvLoginConfirmPayload,
  confirmTvLoginWithQr,
  compactTvLoginPayload,
  measureTvLoginPayloadBytes,
  parseTvLoginQr,
  postTvLoginConfirmThroughCloud,
  resolveTvCloudCovers,
  toTvAlbum,
  toTvCover
};
