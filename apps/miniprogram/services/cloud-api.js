const DEFAULT_CLOUD_CONFIG = {
  enabled: true,
  env: "prod-d5gmzcuby62751753",
  service: "express-i2ts",
  publicBaseUrl: "https://express-i2ts-281225-8-1453155745.sh.run.tcloudbase.com",
  loginRetryDelaysMs: [350, 900]
};
const DEFAULT_PROFILE_NAME = "\u5531\u7247\u67dc\u7528\u6237";
const FALLBACK_ALBUM_TITLE = "\u672a\u547d\u540d\u5531\u7247";
const FALLBACK_ARTIST_NAME = "\u672a\u77e5\u827a\u4eba";
const PLACEHOLDER_PROFILE_NAMES = new Set(["-", "\u2014", "--"]);
const CLOUD_FIELD_LIMITS = {
  albumId: 191,
  albumTitle: 200,
  artist: 160,
  region: 80,
  style: 80,
  coverUrl: 2048,
  source: 80,
  condition: 32,
  mediumKey: 32,
  notes: 2000,
  trackCount: 80,
  trackTitle: 200
};

function resolveCloudConfig(config = {}) {
  const cloud = config.cloud || config || {};
  return {
    ...DEFAULT_CLOUD_CONFIG,
    ...cloud,
    enabled: cloud.enabled !== false
  };
}

function isWechatCloudAvailable(wxApi) {
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  return Boolean(api && api.cloud && typeof api.cloud.callContainer === "function");
}

function initWechatCloud(config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!resolved.enabled || !api || !api.cloud || typeof api.cloud.init !== "function") {
    return false;
  }

  api.cloud.init({
    env: resolved.env,
    traceUser: true
  });
  return true;
}

function callCloudContainer(path, options = {}, config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!resolved.enabled || !api || !api.cloud || typeof api.cloud.callContainer !== "function") {
    return Promise.reject(new Error("WeChat cloud container is not available."));
  }

  // Keep this exact call visible for static checks and WeChat Cloud Hosting review.
  const callContainer = wxApi ? api.cloud.callContainer.bind(api.cloud) : wx.cloud.callContainer.bind(wx.cloud);
  let request;
  try {
    request = callContainer({
      config: { env: resolved.env },
      path,
      method: options.method || "GET",
      data: options.data,
      header: {
        "X-WX-SERVICE": resolved.service,
        ...buildAuthorizationHeader(resolved),
        ...(options.header || {})
      }
    });
  } catch (error) {
    return Promise.reject(error);
  }

  return Promise.resolve(request).then((response) => {
    if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
      throwCloudApiError("Cloud container request failed", response.statusCode, response.data);
    }
    return response.data;
  });
}

function callCloudApi(path, options = {}, config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  if (resolved.authToken && canCallPublicApi(resolved, wxApi)) {
    return callPublicApi(path, options, resolved, wxApi)
      .catch(() => callCloudContainer(path, options, resolved, wxApi));
  }

  return callCloudContainer(path, options, resolved, wxApi)
    .catch(() => callPublicApi(path, options, resolved, wxApi));
}

function callPublicApi(path, options = {}, config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!resolved.publicBaseUrl || !api || typeof api.request !== "function") {
    return Promise.reject(new Error("Public cloud API is not available."));
  }

  return new Promise((resolve, reject) => {
    api.request({
      url: `${resolved.publicBaseUrl.replace(/\/+$/, "")}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        ...buildAuthorizationHeader(resolved),
        ...(options.header || {})
      },
      success(response) {
        const statusCode = Number(response.statusCode || 0);
        if (statusCode >= 200 && statusCode < 300) {
          resolve(response.data);
          return;
        }
        rejectCloudApiError(reject, "Public cloud API request failed", statusCode, response.data);
      },
      fail(error) {
        const message = error && error.errMsg ? error.errMsg : "request failed";
        reject(new Error(`Public cloud API request failed: ${message}`));
      }
    });
  });
}

function canCallPublicApi(config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  return Boolean(resolved.publicBaseUrl && api && typeof api.request === "function");
}

function buildAuthorizationHeader(config) {
  return config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {};
}

function fetchMyCloudCollection(config = {}, wxApi) {
  return callCloudApi("/api/collections/me", { method: "GET" }, config, wxApi);
}

function loginWithCloudIdentity(userInfo = {}, config = {}, wxApi) {
  const resolved = resolveCloudConfig(config);
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  const canUsePublicIdentity = Boolean(api && typeof api.login === "function" && typeof api.request === "function");
  const loginWithContainerIdentity = () => retryAsync(() => callCloudContainer(
      "/api/auth/cloud-login",
      {
        method: "POST",
        data: buildAuthProfileRequest(userInfo)
      },
      resolved,
      api
    ).then(normalizeMeResponse),
    resolved.loginRetryDelaysMs
  );
  const loginWithPublicIdentity = () => getWechatLoginCode(api)
    .then((code) => callPublicApi(
      "/v1/auth/wechat-login",
      {
        method: "POST",
        data: {
          code,
          ...buildAuthProfileRequest(userInfo)
        }
      },
      resolved,
      api
    ))
    .then(normalizeAuthLoginResponse);

  if (isWechatCloudAvailable(api)) {
    return loginWithContainerIdentity()
      .catch((error) => {
        if (!canUsePublicIdentity) {
          throw error;
        }
        return loginWithPublicIdentity();
      });
  }

  if (canUsePublicIdentity) {
    return loginWithPublicIdentity();
  }

  return loginWithContainerIdentity();
}

function retryAsync(operation, retryDelaysMs = []) {
  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  let retryIndex = 0;

  const run = () => Promise.resolve()
    .then(operation)
    .catch((error) => {
      if (retryIndex >= delays.length) {
        throw error;
      }
      const delayMs = Number(delays[retryIndex] || 0);
      retryIndex += 1;
      return delay(delayMs).then(run);
    });

  return run();
}

function delay(ms) {
  if (!ms || typeof setTimeout !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchSharedCloudCollection(ownerId, config = {}, wxApi) {
  return callCloudApi(
    `/api/collections/shared/${encodeURIComponent(ownerId)}`,
    { method: "GET" },
    config,
    wxApi
  );
}

function saveCollectionToCloud(collectionItem, album, config = {}, wxApi) {
  return callCloudApi(
    "/api/collections",
    {
      method: "POST",
      data: buildCloudCollectionRequest(collectionItem, album)
    },
    config,
    wxApi
  );
}

function saveCollectionsToCloud(items = [], config = {}, wxApi) {
  const entries = (items || [])
    .filter((item) => item && item.collectionItem && item.album);
  if (!entries.length) {
    return Promise.resolve(null);
  }
  if (entries.length === 1) {
    return saveCollectionToCloud(entries[0].collectionItem, entries[0].album, config, wxApi);
  }

  return callCloudApi(
    "/api/collections/batch-upsert",
    {
      method: "POST",
      data: {
        items: entries.map((item) => buildCloudCollectionRequest(item.collectionItem, item.album))
      }
    },
    config,
    wxApi
  ).catch(() => saveCollectionsIndividually(entries, config, wxApi));
}

function saveCollectionsIndividually(items, config = {}, wxApi) {
  let savedCount = 0;
  return runWithConcurrency(items, 8, (item) =>
    saveCollectionToCloud(item.collectionItem, item.album, config, wxApi)
      .then((payload) => {
        if (payload) {
          savedCount += 1;
        }
      })
      .catch(() => undefined)
  ).then(() => (
    savedCount === items.length
      ? fetchMyCloudCollection(config, wxApi).catch(() => null)
      : null
  ));
}

function deleteCollectionFromCloud(collectionId, config = {}, wxApi) {
  if (!collectionId) {
    return Promise.resolve(null);
  }

  return callCloudApi(
    `/api/collections/${encodeURIComponent(collectionId)}`,
    { method: "DELETE" },
    config,
    wxApi
  );
}

function deleteCollectionsFromCloud(collectionIds = [], config = {}, wxApi) {
  const ids = uniqueStrings(collectionIds);
  if (!ids.length) {
    return Promise.resolve(null);
  }
  if (ids.length === 1) {
    return deleteCollectionFromCloud(ids[0], config, wxApi);
  }

  return callCloudApi(
    "/api/collections/batch-delete",
    {
      method: "POST",
      data: { collectionIds: ids }
    },
    config,
    wxApi
  ).catch(() => deleteCollectionsIndividually(ids, config, wxApi));
}

function deleteCollectionsIndividually(collectionIds, config = {}, wxApi) {
  return runWithConcurrency(collectionIds, 8, (collectionId) =>
    deleteCollectionFromCloud(collectionId, config, wxApi)
  ).then(() => fetchMyCloudCollection(config, wxApi).catch(() => null));
}

function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, () => {
    const next = () => {
      const item = queue.shift();
      if (!item) {
        return Promise.resolve();
      }
      return Promise.resolve(worker(item)).then(next);
    };
    return next();
  });

  return Promise.all(workers);
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push(text);
  }
  return result;
}

function buildAuthProfileRequest(userInfo = {}) {
  const displayName = cleanDisplayName(userInfo.displayName)
    || cleanDisplayName(userInfo.nickName)
    || cleanDisplayName(userInfo.nickname)
    || cleanDisplayName(userInfo.name)
    || "";
  const avatarUrl = userInfo.avatarUrl || userInfo.avatar || "";
  const request = {};
  if (displayName) {
    request.displayName = displayName;
  }
  if (avatarUrl) {
    request.avatarUrl = avatarUrl;
  }
  return request;
}

function getWechatLoginCode(api) {
  return new Promise((resolve, reject) => {
    api.login({
      success(result) {
        if (result && result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error("WeChat login code is empty."));
      },
      fail: reject
    });
  });
}

function normalizeAuthLoginResponse(payload = {}) {
  return {
    token: payload.token || "",
    me: normalizeMeResponse(payload.me || payload)
  };
}

function normalizeMeResponse(payload = {}) {
  const me = payload.me || payload || {};
  const user = me.user || {};
  const displayName = cleanDisplayName(user.displayName);
  return {
    ...me,
    user: {
      id: user.id || "",
      displayName: displayName || DEFAULT_PROFILE_NAME,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt || "",
      membership: user.membership || null
    },
    stats: me.stats || { collectionCount: 0 }
  };
}

function buildCloudCollectionRequest(collectionItem, album) {
  if (!collectionItem || !album) {
    throw new Error("Collection item and album are required.");
  }

  return {
    album: normalizeCloudAlbum(album),
    collection: normalizeCloudCollection(collectionItem)
  };
}

function normalizeCloudCollectionPayload(payload = {}, seedAlbums = []) {
  const seedIds = new Set(seedAlbums.map((album) => album.id));
  const rawOwner = payload.owner || { id: "", displayName: DEFAULT_PROFILE_NAME, avatarUrl: null };
  const owner = {
    ...rawOwner,
    displayName: cleanDisplayName(rawOwner.displayName) || DEFAULT_PROFILE_NAME
  };
  const albums = (payload.albums || []).map(toLocalAlbum);
  const manualAlbums = albums.filter((album) => !seedIds.has(album.id));
  const collectionItems = (payload.collectionItems || []).map(toLocalCollectionItem);

  return {
    owner,
    albums,
    manualAlbums,
    collectionItems
  };
}

function applyCloudCollectionPayload(app, payload, seedAlbums = []) {
  if (!app || !app.globalData || !payload) {
    return null;
  }

  const normalized = normalizeCloudCollectionPayload(payload, seedAlbums);
  const currentProfile = app.globalData.userProfile || {};
  const ownerDisplayName = cleanDisplayName(normalized.owner.displayName);
  const shouldUseOwnerName = ownerDisplayName && (
    currentProfile.name === DEFAULT_PROFILE_NAME || ownerDisplayName !== DEFAULT_PROFILE_NAME
  );
  app.globalData.userId = normalized.owner.id || app.globalData.userId;
  app.globalData.userProfile = {
    ...currentProfile,
    name: shouldUseOwnerName ? ownerDisplayName : currentProfile.name || DEFAULT_PROFILE_NAME,
    avatar: normalized.owner.avatarUrl || currentProfile.avatar || ""
  };
  app.globalData.manualAlbums = normalized.manualAlbums;
  app.globalData.collectionItems = normalized.collectionItems;
  app.globalData.photoWallOrder = buildPhotoWallOrder(
    app.globalData.photoWallOrder || [],
    normalized.collectionItems
  );

  if (typeof app.refreshUserLabel === "function") {
    app.refreshUserLabel();
  }

  return normalized;
}

function buildPhotoWallOrder(existingOrder, collectionItems) {
  const collectedIds = new Set((collectionItems || []).map((item) => item.albumId));
  const kept = (existingOrder || []).filter((albumId) => collectedIds.has(albumId));
  const missing = (collectionItems || [])
    .map((item) => item.albumId)
    .filter((albumId) => albumId && !kept.includes(albumId));
  return [...kept, ...missing].slice(0, 9);
}

function toLocalAlbum(album) {
  const coverUrl = stripLeadingSlash(album.coverUrl || "");
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.year || album.releaseYear || undefined,
    region: album.region || "未记录",
    style: album.style || album.genre || "未分类",
    coverUrl,
    cover: toImageSrc(coverUrl),
    tracks: normalizeTracks(album.tracks || [])
  };
}

function toLocalCollectionItem(item) {
  return {
    id: item.id,
    userId: item.userId,
    albumId: item.albumId,
    collectionDate: item.collectionDate || today(),
    source: item.source || "",
    quantity: Number(item.quantity || 1),
    condition: item.condition || "NM",
    mediumKey: item.mediumKey || "vinyl",
    price: item.price === undefined ? undefined : Number(item.price || 0),
    notes: item.notes || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function normalizeTracks(tracks) {
  return (tracks || []).slice(0, CLOUD_FIELD_LIMITS.trackCount).map((track, index) => {
    if (typeof track === "string") {
      return { position: index + 1, title: limitString(track, CLOUD_FIELD_LIMITS.trackTitle) };
    }
    if (track && typeof track === "object") {
      return {
        position: Number(track.position || index + 1),
        title: limitString(track.title, CLOUD_FIELD_LIMITS.trackTitle)
      };
    }
    return { position: index + 1, title: "" };
  }).filter((track) => track.title);
}

function stripLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function normalizeCloudAlbum(album = {}) {
  return {
    id: requiredLimitedString(
      album.id || buildFallbackAlbumId(album),
      CLOUD_FIELD_LIMITS.albumId,
      buildFallbackAlbumId(album)
    ),
    title: requiredLimitedString(album.title, CLOUD_FIELD_LIMITS.albumTitle, FALLBACK_ALBUM_TITLE),
    artist: requiredLimitedString(album.artist, CLOUD_FIELD_LIMITS.artist, FALLBACK_ARTIST_NAME),
    year: album.year === undefined ? album.releaseYear || null : album.year,
    region: optionalLimitedString(album.region, CLOUD_FIELD_LIMITS.region),
    style: optionalLimitedString(album.style || album.genre, CLOUD_FIELD_LIMITS.style),
    coverUrl: optionalLimitedString(stripLeadingSlash(album.coverUrl || album.cover || ""), CLOUD_FIELD_LIMITS.coverUrl),
    tracks: normalizeTracks(album.tracks || album.tracksPreview || [])
  };
}

function normalizeCloudCollection(collectionItem = {}) {
  return {
    collectionDate: collectionItem.collectionDate || today(),
    source: optionalLimitedString(collectionItem.source, CLOUD_FIELD_LIMITS.source) || "",
    quantity: normalizePositiveNumber(collectionItem.quantity, 1),
    condition: optionalLimitedString(collectionItem.condition, CLOUD_FIELD_LIMITS.condition) || "NM",
    mediumKey: optionalLimitedString(collectionItem.mediumKey, CLOUD_FIELD_LIMITS.mediumKey) || "vinyl",
    price: normalizeOptionalNumber(collectionItem.price),
    notes: optionalLimitedString(collectionItem.notes, CLOUD_FIELD_LIMITS.notes) || ""
  };
}

function requiredLimitedString(value, maxLength, fallback) {
  return limitString(value, maxLength) || limitString(fallback, maxLength);
}

function optionalLimitedString(value, maxLength) {
  const text = limitString(value, maxLength);
  return text || null;
}

function limitString(value, maxLength) {
  const text = toSafeString(value);
  if (!text) return "";
  return Array.from(text).slice(0, maxLength).join("");
}

function toSafeString(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function buildFallbackAlbumId(album = {}) {
  const source = `${album.title || ""}-${album.artist || ""}`;
  return `manual-${hashString(source)}`;
}

function hashString(value) {
  const text = String(value || "album");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36) || "album";
}

function cleanDisplayName(value) {
  const name = toSafeString(value);
  return PLACEHOLDER_PROFILE_NAMES.has(name) ? "" : name;
}

function throwCloudApiError(prefix, statusCode, responseData) {
  const error = new Error(buildCloudApiErrorMessage(prefix, statusCode, responseData));
  error.statusCode = statusCode;
  error.responseData = responseData;
  throw error;
}

function rejectCloudApiError(reject, prefix, statusCode, responseData) {
  const error = new Error(buildCloudApiErrorMessage(prefix, statusCode, responseData));
  error.statusCode = statusCode;
  error.responseData = responseData;
  reject(error);
}

function buildCloudApiErrorMessage(prefix, statusCode, responseData) {
  const detail = responseData && typeof responseData === "object"
    ? responseData.message || responseData.error || ""
    : "";
  return detail
    ? `${prefix} with ${statusCode}: ${detail}`
    : `${prefix} with ${statusCode}.`;
}

function toImageSrc(value) {
  const cover = String(value || "");
  if (!cover) return "";
  if (/^(https?:|wxfile:|cloud:|data:)/.test(cover)) {
    return cover;
  }
  return `/${cover.replace(/^\/+/, "")}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  DEFAULT_CLOUD_CONFIG,
  applyCloudCollectionPayload,
  buildCloudCollectionRequest,
  callCloudApi,
  callCloudContainer,
  callPublicApi,
  deleteCollectionFromCloud,
  deleteCollectionsFromCloud,
  fetchMyCloudCollection,
  fetchSharedCloudCollection,
  initWechatCloud,
  isWechatCloudAvailable,
  loginWithCloudIdentity,
  normalizeCloudCollectionPayload,
  normalizeMeResponse,
  resolveCloudConfig,
  saveCollectionToCloud,
  saveCollectionsToCloud
};
