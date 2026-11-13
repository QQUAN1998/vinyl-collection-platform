const { mergeAlbumLibraries, toAlbumImageSrc } = require("./album-library-service.js");
const { getMediaFormat } = require("./media-format-service.js");
const { getAlbumRarity } = require("./rarity-service.js");
const { normalizeTrackDisplayList } = require("./track-display-service.js");

function decadeOf(year) {
  return `${Math.floor(Number(year || 0) / 10) * 10}s`;
}

function normalizeProfileType(type) {
  return ["all", "style", "artist"].includes(type) ? type : "artist";
}

function buildArchiveAlbumView(album, collectionItem = {}) {
  const price = collectionItem.price || 0;
  const rarity = getAlbumRarity(price);
  const medium = getMediaFormat(collectionItem.mediumKey);
  return {
    ...album,
    price,
    collectionDate: collectionItem.collectionDate || "\u672a\u8bb0\u5f55",
    mediumLabel: medium.label,
    rarityCode: rarity.code,
    rarityLabel: rarity.label,
    rarityName: rarity.name,
    rarityClass: `rarity-${rarity.code.toLowerCase()}`,
    decade: decadeOf(album.year),
    cover: toAlbumImageSrc(album),
    styles: album.style,
    tracks: normalizeTrackDisplayList(album.tracks || [])
  };
}

function albumMatchesProfile(album, profileType, profileTitle) {
  if (profileType === "all") {
    return true;
  }
  if (profileType === "style") {
    return album.style === profileTitle;
  }
  return album.artist === profileTitle;
}

function buildArchiveProfile(input = {}) {
  const {
    seedAlbums = [],
    manualAlbums = [],
    collectionItems = [],
    profileType = "artist",
    profileTitle = ""
  } = input;
  const normalizedProfileType = normalizeProfileType(profileType);
  const sourceAlbums = mergeAlbumLibraries(seedAlbums, manualAlbums);
  const collectedIds = new Set(collectionItems.map((item) => item.albumId));
  const collectionByAlbumId = new Map(collectionItems.map((item) => [item.albumId, item]));
  const profileAlbums = sourceAlbums
    .filter((album) => collectedIds.has(album.id))
    .filter((album) => albumMatchesProfile(album, normalizedProfileType, profileTitle))
    .map((album) => buildArchiveAlbumView(album, collectionByAlbumId.get(album.id)));

  return {
    profileType: normalizedProfileType,
    profileTitle,
    profileAlbums,
    visibleAlbums: profileAlbums,
    artistFilters: [...new Set(profileAlbums.map((album) => album.artist))],
    styleFilters: [...new Set(profileAlbums.map((album) => album.style))],
    decadeFilters: [...new Set(profileAlbums.map((album) => album.decade))].sort((a, b) => b.localeCompare(a)),
    selectedArtist: "all",
    selectedStyle: "all",
    selectedDecade: "all"
  };
}

module.exports = {
  buildArchiveAlbumView,
  buildArchiveProfile
};
