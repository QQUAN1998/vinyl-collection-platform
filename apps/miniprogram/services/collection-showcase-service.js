const { getMediaFormat } = require("./media-format-service.js");
const { getAlbumRarity } = require("./rarity-service.js");
const { calculateCollectionStats } = require("./stats-service.js");
const { toAlbumImageSrc } = require("./album-library-service.js");
const { normalizeTrackDisplayList } = require("./track-display-service.js");

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function coverOf(album) {
  return toAlbumImageSrc(album);
}

const COLLECTION_SEARCH_SCOPES = [
  { key: "all", label: "全部" },
  { key: "album", label: "唱片" },
  { key: "artist", label: "艺人" },
  { key: "style", label: "风格" },
  { key: "year", label: "年份" }
];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function sortByPriceThenRarity(a, b) {
  return b.price - a.price
    || b.rarityPower - a.rarityPower
    || Number(b.year || 0) - Number(a.year || 0)
    || String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
}

function searchableFields(album, scope = "all") {
  if (scope === "album") {
    return [album.title];
  }
  if (scope === "artist") {
    return [album.artist];
  }
  if (scope === "style") {
    return [album.style, album.region, album.mediumLabel];
  }
  if (scope === "year") {
    return [album.year];
  }

  return [
    album.title,
    album.artist,
    album.region,
    album.style,
    album.year,
    album.mediumLabel,
    album.rarityCode,
    album.rarityName,
    album.priceLabel
  ];
}

function filterCollectedAlbumViews(collectedAlbums = [], query = "", scope = "all") {
  const normalized = normalize(query);
  if (!normalized) {
    return collectedAlbums;
  }

  return collectedAlbums.filter((album) => searchableFields(album, scope)
    .some((field) => normalize(field).includes(normalized)));
}

function buildCollectedAlbumViews(sourceAlbums = [], collectionItems = []) {
  const albumById = new Map(sourceAlbums.map((album) => [album.id, album]));

  return collectionItems
    .map((item) => {
      const album = albumById.get(item.albumId);
      if (!album) {
        return null;
      }

      const price = Number(item.price || 0);
      const rarity = getAlbumRarity(price);
      const medium = getMediaFormat(item.mediumKey);

      return {
        ...album,
        collectionId: item.id,
        price,
        priceLabel: formatMoney(price),
        collectionDate: item.collectionDate || "未记录",
        collectionDateLabel: item.collectionDate ? `收藏于 ${item.collectionDate.slice(0, 7)}` : "收藏于 未记录",
        mediumLabel: medium.label,
        conditionLabel: `${item.condition || "--"} / ${item.quantity || 1} 张`,
        rarityCode: rarity.code,
        rarityLabel: rarity.label,
        rarityName: rarity.name,
        rarityPower: rarity.power,
        rarityClass: `rarity-${rarity.code.toLowerCase()}`,
        cover: coverOf(album),
        styles: album.style,
        tracksPreview: normalizeTrackDisplayList(album.tracks || [])
      };
    })
    .filter(Boolean)
    .sort(sortByPriceThenRarity);
}

function buildCollectionShowcase(sourceAlbums = [], collectionItems = [], userProfile = {}) {
  const userName = userProfile.name || "\u5531\u7247\u67dc\u7528\u6237";
  const stats = calculateCollectionStats(sourceAlbums, collectionItems);

  return {
    userName,
    avatarInitial: userName.slice(0, 1).toUpperCase(),
    stats: {
      ...stats,
      totalPriceLabel: formatMoney(stats.totalPrice)
    },
    albums: buildCollectedAlbumViews(sourceAlbums, collectionItems)
  };
}

module.exports = {
  COLLECTION_SEARCH_SCOPES,
  buildCollectedAlbumViews,
  buildCollectionShowcase,
  filterCollectedAlbumViews,
  sortByPriceThenRarity
};
