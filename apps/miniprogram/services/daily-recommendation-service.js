const { searchCatalogAlbums } = require("./catalog-api.js");
const { toAlbumView } = require("./album-library-service.js");

const DAILY_RECOMMENDATION_STORAGE_KEY = "vinyl.dailyRecommendation.v1";
const DAILY_RECOMMENDATION_SEARCH_LIMIT = 18;
const MAX_RECOMMENDATION_ARTISTS = 2;

function getRecommendationDateKey(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRecommendationText(value) {
  let text = String(value || "").trim().toLowerCase();
  try {
    text = text.normalize("NFKC");
  } catch (error) {
    // Older mini-program runtimes may not expose String#normalize.
  }

  return text.replace(/[\s_\-–—·・.。,，:：'’"“”()（）[\]【】/\\&]+/g, "");
}

function albumIdentityKey(album = {}) {
  const artist = normalizeRecommendationText(album.artist);
  const title = normalizeRecommendationText(album.title);
  return artist && title ? `${artist}::${title}` : "";
}

function providerIdentityKey(album = {}) {
  if (!album.catalogProvider || !album.catalogProviderId) {
    return "";
  }

  return `${String(album.catalogProvider).toUpperCase()}:${String(album.catalogProviderId)}`;
}

function buildAlbumById(sourceAlbums = [], collectionItems = []) {
  const albumById = new Map((sourceAlbums || [])
    .filter((album) => album && album.id)
    .map((album) => [album.id, album]));

  for (const item of collectionItems || []) {
    if (!item || !item.albumId || albumById.has(item.albumId)) {
      continue;
    }
    const embeddedAlbum = item.album || item.albumSnapshot;
    if (embeddedAlbum && embeddedAlbum.title && embeddedAlbum.artist) {
      albumById.set(item.albumId, { ...embeddedAlbum, id: item.albumId });
    }
  }

  return albumById;
}

function buildCollectedAlbums(sourceAlbums = [], collectionItems = []) {
  const albumById = buildAlbumById(sourceAlbums, collectionItems);
  const seen = new Set();
  return (collectionItems || [])
    .map((item) => {
      if (!item || !item.albumId || seen.has(item.albumId)) {
        return null;
      }
      seen.add(item.albumId);
      return albumById.get(item.albumId) || null;
    })
    .filter(Boolean);
}

function buildArtistRecommendationQueue(sourceAlbums = [], collectionItems = [], now = new Date()) {
  const artistStats = new Map();
  buildCollectedAlbums(sourceAlbums, collectionItems).forEach((album, index) => {
    const artist = String(album.artist || "").trim();
    const artistKey = normalizeRecommendationText(artist);
    if (!artistKey) {
      return;
    }
    const stat = artistStats.get(artistKey) || {
      artist,
      count: 0,
      firstIndex: index
    };
    stat.count += 1;
    artistStats.set(artistKey, stat);
  });

  const artists = Array.from(artistStats.values())
    .sort((left, right) =>
      right.count - left.count
      || left.firstIndex - right.firstIndex
      || left.artist.localeCompare(right.artist, "zh-Hans-CN")
    )
    .map((item) => item.artist);

  if (artists.length <= 1) {
    return artists;
  }

  const seed = Number(getRecommendationDateKey(now).replace(/-/g, "")) || 0;
  const offset = seed % artists.length;
  return [...artists.slice(offset), ...artists.slice(0, offset)];
}

function buildOwnership(sourceAlbums = [], collectionItems = []) {
  const ownedAlbumIds = new Set();
  const identityKeys = new Set();
  const providerKeys = new Set();

  for (const item of collectionItems || []) {
    if (item && item.albumId) {
      ownedAlbumIds.add(item.albumId);
    }
  }

  for (const album of buildCollectedAlbums(sourceAlbums, collectionItems)) {
    if (album.id) {
      ownedAlbumIds.add(album.id);
    }
    const identity = albumIdentityKey(album);
    if (identity) {
      identityKeys.add(identity);
    }
    const providerKey = providerIdentityKey(album);
    if (providerKey) {
      providerKeys.add(providerKey);
    }
    for (const ref of album.providerRefs || []) {
      const key = providerIdentityKey({
        catalogProvider: ref.provider,
        catalogProviderId: ref.providerId
      });
      if (key) {
        providerKeys.add(key);
      }
    }
  }

  return {
    ownedAlbumIds,
    identityKeys,
    providerKeys
  };
}

function isNetEaseCandidate(album = {}) {
  return album.catalogProvider === "NETEASE" || String(album.id || "").startsWith("netease:");
}

function isOwnedAlbumCandidate(album = {}, ownership = {}) {
  if (!album) {
    return true;
  }
  if (album.id && ownership.ownedAlbumIds && ownership.ownedAlbumIds.has(album.id)) {
    return true;
  }

  const identity = albumIdentityKey(album);
  if (identity && ownership.identityKeys && ownership.identityKeys.has(identity)) {
    return true;
  }

  const providerKey = providerIdentityKey(album);
  return Boolean(providerKey && ownership.providerKeys && ownership.providerKeys.has(providerKey));
}

function candidateMatchesArtist(album = {}, sourceArtist = "") {
  const candidateArtist = normalizeRecommendationText(album.artist);
  const targetArtist = normalizeRecommendationText(sourceArtist);
  if (!targetArtist || !candidateArtist) {
    return true;
  }

  return candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist);
}

function buildDailyRecommendationView(album, sourceArtist, dateKey) {
  const albumView = toAlbumView(album);
  const artist = sourceArtist || albumView.artist || "收藏艺人";
  return {
    visible: true,
    loading: false,
    action: "recommendation",
    actionLabel: "GO!",
    label: "今日推荐",
    title: albumView.title || "今日推荐",
    meta: `根据 ${artist} 推荐 · 网易云音乐`,
    cover: albumView.cover,
    providerLabel: "网易云音乐",
    sourceArtist: artist,
    dateKey,
    album: albumView
  };
}

function buildDailyRecommendationFallback(type = "loading", dateKey = getRecommendationDateKey()) {
  if (type === "empty") {
    return {
      visible: true,
      loading: false,
      action: "add",
      actionLabel: "去添加",
      label: "今日推荐",
      title: "收藏更多唱片后推荐",
      meta: "会按你收藏的艺人每日更新",
      providerLabel: "网易云音乐",
      dateKey
    };
  }

  if (type === "unavailable") {
    return {
      visible: true,
      loading: false,
      action: "search",
      actionLabel: "去搜索",
      label: "今日推荐",
      title: "今日暂未找到推荐",
      meta: "只推荐网易云可用专辑，明天再刷新",
      providerLabel: "网易云音乐",
      dateKey
    };
  }

  return {
    visible: true,
    loading: true,
    action: "loading",
    actionLabel: "",
    label: "今日推荐",
    title: "正在挑选今日推荐",
    meta: "根据你的收藏艺人生成",
    providerLabel: "网易云音乐",
    dateKey
  };
}

function pickDailyRecommendationCandidate({
  sourceAlbums = [],
  collectionItems = [],
  artist = "",
  candidates = [],
  dateKey = getRecommendationDateKey()
} = {}) {
  const ownership = buildOwnership(sourceAlbums, collectionItems);
  const album = (candidates || []).find((candidate) =>
    isNetEaseCandidate(candidate)
    && candidateMatchesArtist(candidate, artist)
    && !isOwnedAlbumCandidate(candidate, ownership)
  );

  return album ? buildDailyRecommendationView(album, artist, dateKey) : null;
}

function getWxApi(wxApi) {
  return wxApi || (typeof wx === "undefined" ? null : wx);
}

function readStoredDailyRecommendation(
  wxApi,
  dateKey,
  sourceAlbums = [],
  collectionItems = [],
  artistQueue = [],
  options = {}
) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.getStorageSync !== "function") {
    return null;
  }

  let cached;
  try {
    cached = api.getStorageSync(DAILY_RECOMMENDATION_STORAGE_KEY);
  } catch (error) {
    return null;
  }

  if (!cached || !cached.album || !isNetEaseCandidate(cached.album)) {
    return null;
  }

  if (!options.allowStale && cached.dateKey !== dateKey) {
    return null;
  }

  const normalizedArtists = new Set(artistQueue.map(normalizeRecommendationText));
  if (normalizedArtists.size && !normalizedArtists.has(normalizeRecommendationText(cached.sourceArtist))) {
    return null;
  }

  if (isOwnedAlbumCandidate(cached.album, buildOwnership(sourceAlbums, collectionItems))) {
    return null;
  }

  return buildDailyRecommendationView(cached.album, cached.sourceArtist, dateKey);
}

function readFastStoredDailyRecommendation({
  sourceAlbums = [],
  collectionItems = [],
  wxApi,
  now = new Date()
} = {}) {
  const artistQueue = buildArtistRecommendationQueue(sourceAlbums, collectionItems, now);
  if (!artistQueue.length) {
    return null;
  }

  return readStoredDailyRecommendation(
    wxApi,
    getRecommendationDateKey(now),
    sourceAlbums,
    collectionItems,
    artistQueue,
    { allowStale: true }
  );
}

function writeStoredDailyRecommendation(recommendation, wxApi) {
  const api = getWxApi(wxApi);
  if (!recommendation || !recommendation.album || !api || typeof api.setStorageSync !== "function") {
    return;
  }

  try {
    api.setStorageSync(DAILY_RECOMMENDATION_STORAGE_KEY, {
      dateKey: recommendation.dateKey,
      sourceArtist: recommendation.sourceArtist,
      album: recommendation.album
    });
  } catch (error) {
    // Storage is a cache only; recommendation should still render without it.
  }
}

function loadDailyRecommendation({
  sourceAlbums = [],
  collectionItems = [],
  cloudConfig = {},
  wxApi,
  now = new Date(),
  searchCatalog = searchCatalogAlbums
} = {}) {
  const dateKey = getRecommendationDateKey(now);
  const artistQueue = buildArtistRecommendationQueue(sourceAlbums, collectionItems, now);
  if (!artistQueue.length) {
    return Promise.resolve(buildDailyRecommendationFallback("empty", dateKey));
  }

  const cached = readStoredDailyRecommendation(wxApi, dateKey, sourceAlbums, collectionItems, artistQueue);
  if (cached) {
    return Promise.resolve(cached);
  }

  if (typeof searchCatalog !== "function") {
    return Promise.resolve(buildDailyRecommendationFallback("unavailable", dateKey));
  }

  const artists = artistQueue.slice(0, MAX_RECOMMENDATION_ARTISTS);
  const searchArtist = (index) => {
    if (index >= artists.length) {
      return Promise.resolve(buildDailyRecommendationFallback("unavailable", dateKey));
    }

    const artist = artists[index];
    return searchCatalog(
      artist,
      { limit: DAILY_RECOMMENDATION_SEARCH_LIMIT, country: "CN", artistFallback: "always" },
      cloudConfig,
      wxApi
    )
      .then((result) => pickDailyRecommendationCandidate({
        sourceAlbums,
        collectionItems,
        artist,
        candidates: result.albums || [],
        dateKey
      }))
      .catch(() => null)
      .then((recommendation) => {
        if (recommendation) {
          writeStoredDailyRecommendation(recommendation, wxApi);
          return recommendation;
        }
        return searchArtist(index + 1);
      });
  };

  return searchArtist(0);
}

module.exports = {
  DAILY_RECOMMENDATION_STORAGE_KEY,
  buildArtistRecommendationQueue,
  buildDailyRecommendationFallback,
  getRecommendationDateKey,
  loadDailyRecommendation,
  normalizeRecommendationText,
  pickDailyRecommendationCandidate,
  readFastStoredDailyRecommendation,
  readStoredDailyRecommendation,
  writeStoredDailyRecommendation
};
