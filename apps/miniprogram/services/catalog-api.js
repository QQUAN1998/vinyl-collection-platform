const { callCloudContainer } = require("./cloud-api.js");

const DEFAULT_CATALOG_LIMIT = 8;

function searchCatalogAlbums(query, options = {}, config = {}, wxApi) {
  const parsed = parseSearchQuery(query);
  const params = {
    q: parsed.title || parsed.query,
    artist: parsed.artist,
    limit: options.limit || DEFAULT_CATALOG_LIMIT,
    country: options.country || "CN",
    includeUnofficial: options.includeUnofficial !== false
  };

  return callCloudContainer(buildCatalogSearchPath(params), { method: "GET" }, config, wxApi)
    .then(normalizeCatalogSearchResponse);
}

function fetchCatalogAlbumDetail(album, options = {}, config = {}, wxApi) {
  if (!album || !album.catalogProvider || !album.catalogProviderId) {
    return Promise.resolve(album);
  }

  const query = buildQueryString({
    country: options.country || "CN",
    includeUnofficial: options.includeUnofficial !== false
  });
  const path = `/api/catalog/albums/${encodeURIComponent(album.catalogProvider)}/${encodeURIComponent(album.catalogProviderId)}?${query}`;

  return callCloudContainer(path, { method: "GET" }, config, wxApi)
    .then((candidate) => catalogCandidateToAlbum(candidate, album));
}

function normalizeCatalogSearchResponse(response = {}) {
  return {
    query: response.query || "",
    artist: response.artist || "",
    providers: response.providers || { enabled: [], failed: [] },
    albums: (response.data || []).map((candidate) => catalogCandidateToAlbum(candidate))
  };
}

function catalogCandidateToAlbum(candidate = {}, previousAlbum = {}) {
  const provider = candidate.provider || previousAlbum.catalogProvider || "CATALOG";
  const providerId = String(candidate.providerId || previousAlbum.catalogProviderId || candidate.id || "");
  const id = candidate.id || previousAlbum.id || `catalog:${provider.toLowerCase()}:${providerId}`;
  const coverUrl = candidate.coverUrl || previousAlbum.coverUrl || "";
  const coverThumbUrl = candidate.coverThumbUrl || candidate.coverUrl || previousAlbum.coverThumbUrl || coverUrl;

  return {
    ...previousAlbum,
    id,
    title: candidate.title || previousAlbum.title || "",
    artist: candidate.artist || previousAlbum.artist || "",
    year: candidate.year || previousAlbum.year || undefined,
    region: candidate.region || previousAlbum.region || providerLabel(provider),
    style: candidate.style || candidate.genre || previousAlbum.style || candidate.format || "未分类",
    coverUrl,
    coverThumbUrl,
    cover: coverToImageSrc(coverThumbUrl || coverUrl),
    tracks: normalizeCatalogTracks(candidate.tracks || previousAlbum.tracks || []),
    catalogProvider: provider,
    catalogProviderId: providerId,
    catalogExternalUrl: candidate.externalUrl || previousAlbum.catalogExternalUrl || "",
    catalogScore: candidate.score || previousAlbum.catalogScore || 0,
    providerRefs: candidate.providerRefs || previousAlbum.providerRefs || []
  };
}

function normalizeCatalogTracks(tracks) {
  return (tracks || [])
    .map((track, index) => {
      if (typeof track === "string") {
        return { position: index + 1, title: track };
      }
      return {
        position: Number(track.position || index + 1),
        title: track.title || ""
      };
    })
    .filter((track) => track.title);
}

function buildCatalogSearchPath(params) {
  return `/api/catalog/search?${buildQueryString(params)}`;
}

function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join("&");
}

function parseSearchQuery(query) {
  const text = normalizeCatalogQuery(query);
  const parts = text.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      query: text,
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim()
    };
  }
  return { query: text, artist: "", title: text };
}

function normalizeCatalogQuery(query) {
  const text = String(query || "").trim();
  if (!text.includes("%")) {
    return text;
  }

  try {
    return decodeURIComponent(text).trim();
  } catch (error) {
    return text;
  }
}

function coverToImageSrc(value) {
  const cover = String(value || "");
  if (!cover) return "";
  if (/^(https?:|wxfile:|cloud:|data:)/.test(cover)) {
    return cover;
  }
  return `/${cover.replace(/^\/+/, "")}`;
}

function providerLabel(provider) {
  switch (provider) {
    case "NETEASE":
      return "网易云音乐";
    case "QQMUSIC":
      return "QQ 音乐";
    case "ITUNES":
      return "Apple Music";
    case "MUSICBRAINZ":
      return "MusicBrainz";
    case "DISCOGS":
      return "Discogs";
    default:
      return "在线资料";
  }
}

module.exports = {
  buildCatalogSearchPath,
  catalogCandidateToAlbum,
  coverToImageSrc,
  fetchCatalogAlbumDetail,
  normalizeCatalogQuery,
  normalizeCatalogSearchResponse,
  parseSearchQuery,
  providerLabel,
  searchCatalogAlbums
};
