const { EASTER_ALBUM_METADATA } = require("../data/easter-metadata.js");
const { MEDIA_FORMATS } = require("./media-format-service.js");

const LEGACY_REGIONS = new Set(["", "\u9690\u85cf\u5e93", "\u672a\u8bb0\u5f55"]);
const LEGACY_STYLES = new Set(["", "\u672a\u5206\u7c7b"]);
const MEDIA_LABELS = new Set(MEDIA_FORMATS.map((item) => String(item.label || "").toLowerCase()));

function normalizeEasterAlbumId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^easter-/, "");
}

function getEasterAlbumMetadata(album = {}) {
  const id = normalizeEasterAlbumId(album.id || album.sourceId);
  const metadata = EASTER_ALBUM_METADATA[id];
  if (!metadata) {
    return null;
  }

  return {
    region: metadata[0],
    style: metadata[1]
  };
}

function repairLegacyEasterAlbumMetadata(album = {}) {
  const reference = getEasterAlbumMetadata(album);
  if (!reference) {
    return album;
  }

  const region = String(album.region || "").trim();
  const style = String(album.style || album.genre || "").trim();
  const hasLegacyRegion = LEGACY_REGIONS.has(region);
  const hasLegacyStyle = LEGACY_STYLES.has(style) || MEDIA_LABELS.has(style.toLowerCase());

  if (!hasLegacyRegion && !hasLegacyStyle) {
    return album;
  }

  return {
    ...album,
    region: hasLegacyRegion ? reference.region : region,
    style: hasLegacyRegion || hasLegacyStyle ? reference.style : style
  };
}

module.exports = {
  getEasterAlbumMetadata,
  normalizeEasterAlbumId,
  repairLegacyEasterAlbumMetadata
};
