const { MEDIA_FORMATS, getMediaFormat } = require("./media-format-service.js");

const MONTH_LABELS = [
  "\u4e00\u6708",
  "\u4e8c\u6708",
  "\u4e09\u6708",
  "\u56db\u6708",
  "\u4e94\u6708",
  "\u516d\u6708",
  "\u4e03\u6708",
  "\u516b\u6708",
  "\u4e5d\u6708",
  "\u5341\u6708",
  "\u5341\u4e00\u6708",
  "\u5341\u4e8c\u6708"
];

function decadeOf(year) {
  if (!year) return "未知";
  return `${Math.floor(year / 10) * 10}s`;
}

function getCollectionQuantity(item) {
  const quantity = Number(item && item.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function calculateCollectionStats(albums, collectionItems) {
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const artists = new Set();
  const decadeDistribution = {};
  let trackCount = 0;
  let totalPrice = 0;

  for (const item of collectionItems) {
    const album = albumById.get(item.albumId);
    if (!album) continue;
    artists.add(album.artist);
    trackCount += Array.isArray(album.tracks) ? album.tracks.length : 0;
    totalPrice += Number(item.price || 0);
    const decade = decadeOf(album.year);
    decadeDistribution[decade] = (decadeDistribution[decade] || 0) + 1;
  }

  return {
    albumCount: collectionItems.length,
    artistCount: artists.size,
    trackCount,
    totalPrice,
    decadeDistribution
  };
}

function getCollectionYear(item) {
  const dateText = item && item.collectionDate;
  if (!dateText) return null;
  const year = Number(String(dateText).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function buildMonthlyCollectionDistribution(collectionItems, selectedYear) {
  const years = Array.from(
    new Set(collectionItems.map(getCollectionYear).filter((year) => year !== null)),
  ).sort((a, b) => b - a);
  const year = Number(selectedYear) || years[0] || new Date().getFullYear();
  const counts = Array.from({ length: 12 }, () => 0);

  for (const item of collectionItems) {
    if (getCollectionYear(item) !== year) {
      continue;
    }

    const month = Number(String(item.collectionDate || "").slice(5, 7));
    if (month >= 1 && month <= 12) {
      counts[month - 1] += getCollectionQuantity(item);
    }
  }

  const maxCount = Math.max(...counts, 0);
  const months = counts.map((count, index) => {
    let tone = "empty";
    if (count > 0 && maxCount > 0) {
      const ratio = count / maxCount;
      tone = ratio >= 0.75 ? "high" : ratio >= 0.45 ? "medium" : "low";
    }

    return {
      month: index + 1,
      label: MONTH_LABELS[index],
      count,
      tone
    };
  });

  return {
    year,
    availableYears: years.length ? years : [year],
    months,
    totalCount: counts.reduce((sum, count) => sum + count, 0),
    maxCount
  };
}

function buildMediaFormatDistribution(collectionItems) {
  const counts = new Map(MEDIA_FORMATS.map((format) => [format.key, 0]));
  let totalCount = 0;

  for (const item of collectionItems) {
    const format = getMediaFormat(item && item.mediumKey);
    const quantity = getCollectionQuantity(item);
    counts.set(format.key, (counts.get(format.key) || 0) + quantity);
    totalCount += quantity;
  }

  const formats = MEDIA_FORMATS.map((format) => {
    const count = counts.get(format.key) || 0;
    const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    return {
      ...format,
      count,
      percent,
      width: `${percent}%`
    };
  });

  return {
    totalCount,
    formats
  };
}

function buildMonthlyCollectionEntries(collectionItems, albums, selectedYear, selectedMonth) {
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const year = Number(selectedYear);
  const month = Number(selectedMonth);

  return collectionItems
    .filter((item) => {
      const dateText = String(item.collectionDate || "");
      const itemYear = Number(dateText.slice(0, 4));
      const itemMonth = Number(dateText.slice(5, 7));
      return itemYear === year && itemMonth === month;
    })
    .map((item) => {
      const album = albumById.get(item.albumId);
      if (!album) {
        return null;
      }
      return {
        id: item.id,
        albumId: item.albumId,
        title: album.title,
        artist: album.artist,
        cover: album.cover || (album.coverUrl ? `/${album.coverUrl}` : ""),
        collectionDate: item.collectionDate,
        quantity: getCollectionQuantity(item),
        mediumLabel: getMediaFormat(item.mediumKey).label,
        price: Number(item.price || 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.collectionDate.localeCompare(b.collectionDate) || a.title.localeCompare(b.title));
}

module.exports = {
  buildMediaFormatDistribution,
  buildMonthlyCollectionEntries,
  buildMonthlyCollectionDistribution,
  calculateCollectionStats
};
