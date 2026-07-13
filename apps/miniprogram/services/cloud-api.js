const DEFAULT_CLOUD_CONFIG = {
  enabled: true,
  env: "prod",
  service: "express-i2ts"
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
  return callContainer({
    config: { env: resolved.env },
    path,
    method: options.method || "GET",
    data: options.data,
    header: {
      "X-WX-SERVICE": resolved.service,
      ...(options.header || {})
    }
  }).then((response) => response.data);
}

function fetchMyCloudCollection(config = {}, wxApi) {
  return callCloudContainer("/api/collections/me", { method: "GET" }, config, wxApi);
}

function fetchSharedCloudCollection(ownerId, config = {}, wxApi) {
  return callCloudContainer(
    `/api/collections/shared/${encodeURIComponent(ownerId)}`,
    { method: "GET" },
    config,
    wxApi
  );
}

function saveCollectionToCloud(collectionItem, album, config = {}, wxApi) {
  return callCloudContainer(
    "/api/collections",
    {
      method: "POST",
      data: buildCloudCollectionRequest(collectionItem, album)
    },
    config,
    wxApi
  );
}

function deleteCollectionFromCloud(collectionId, config = {}, wxApi) {
  if (!collectionId) {
    return Promise.resolve(null);
  }

  return callCloudContainer(
    `/api/collections/${encodeURIComponent(collectionId)}`,
    { method: "DELETE" },
    config,
    wxApi
  );
}

function buildCloudCollectionRequest(collectionItem, album) {
  if (!collectionItem || !album) {
    throw new Error("Collection item and album are required.");
  }

  return {
    album: {
      id: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year === undefined ? album.releaseYear || null : album.year,
      region: album.region || null,
      style: album.style || album.genre || null,
      coverUrl: stripLeadingSlash(album.coverUrl || album.cover || ""),
      tracks: normalizeTracks(album.tracks || album.tracksPreview || [])
    },
    collection: {
      collectionDate: collectionItem.collectionDate || today(),
      source: collectionItem.source || "",
      quantity: Number(collectionItem.quantity || 1),
      condition: collectionItem.condition || "NM",
      mediumKey: collectionItem.mediumKey || "vinyl",
      price: collectionItem.price === undefined ? undefined : Number(collectionItem.price || 0),
      notes: collectionItem.notes || ""
    }
  };
}

function normalizeCloudCollectionPayload(payload = {}, seedAlbums = []) {
  const seedIds = new Set(seedAlbums.map((album) => album.id));
  const owner = payload.owner || { id: "", displayName: "David", avatarUrl: null };
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
  app.globalData.userId = normalized.owner.id || app.globalData.userId;
  app.globalData.userProfile = {
    ...(app.globalData.userProfile || {}),
    name: normalized.owner.displayName || app.globalData.userProfile?.name || "David",
    avatar: normalized.owner.avatarUrl || app.globalData.userProfile?.avatar || ""
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
    cover: coverUrl ? `/${coverUrl}` : "",
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
  return (tracks || []).map((track, index) => {
    if (typeof track === "string") {
      return { position: index + 1, title: track };
    }
    return {
      position: Number(track.position || index + 1),
      title: track.title || ""
    };
  }).filter((track) => track.title);
}

function stripLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  DEFAULT_CLOUD_CONFIG,
  applyCloudCollectionPayload,
  buildCloudCollectionRequest,
  callCloudContainer,
  deleteCollectionFromCloud,
  fetchMyCloudCollection,
  fetchSharedCloudCollection,
  initWechatCloud,
  isWechatCloudAvailable,
  normalizeCloudCollectionPayload,
  resolveCloudConfig,
  saveCollectionToCloud
};
