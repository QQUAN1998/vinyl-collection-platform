const RARITY_LEVELS = [
  { code: "N", label: "N CARD", name: "经典唱片", power: 1, maxExclusive: 300 },
  { code: "R", label: "R CARD", name: "珍珠唱片", power: 2, maxExclusive: 800 },
  { code: "SR", label: "SR CARD", name: "白银唱片", power: 3, maxExclusive: 1500 },
  { code: "SSR", label: "SSR CARD", name: "银钻唱片", power: 4, maxExclusive: 3000 },
  { code: "UR", label: "UR CARD", name: "金钻唱片", power: 5, maxExclusive: Infinity },
];

function normalizePrice(price) {
  const value = Number(price || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getAlbumRarity(price) {
  const value = normalizePrice(price);
  return RARITY_LEVELS.find((level) => value < level.maxExclusive) || RARITY_LEVELS[0];
}

function getAlbumRarityClass(price) {
  return `rarity-${getAlbumRarity(price).code.toLowerCase()}`;
}

module.exports = {
  RARITY_LEVELS,
  getAlbumRarity,
  getAlbumRarityClass,
};
