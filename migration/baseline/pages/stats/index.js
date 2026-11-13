const { albums } = require("../../data/seed.js");
const {
  buildMediaFormatDistribution,
  getCollectionAmount,
  getCollectionQuantity,
  buildMonthlyCollectionEntries,
  buildMonthlyCollectionDistribution,
  calculateCollectionStats
} = require("../../services/stats-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || `/${album.coverUrl}`,
    styles: album.style
  };
}

function getCollectedAlbums(sourceAlbums, collectionItems) {
  const collectedIds = new Set(collectionItems.map((item) => item.albumId));
  return sourceAlbums.filter((album) => collectedIds.has(album.id)).map(toAlbumView);
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key] || "未知";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildArtistRanks(sourceAlbums, collectionItems) {
  const albumById = new Map(sourceAlbums.map((album) => [album.id, album]));
  const rankMap = new Map();

  for (const item of collectionItems) {
    const album = albumById.get(item.albumId);
    if (!album) {
      continue;
    }
    const current = rankMap.get(album.artist) || {
      name: album.artist,
      count: 0,
      amount: 0,
      avatar: album.cover || `/${album.coverUrl}`
    };
    current.count += getCollectionQuantity(item);
    current.amount += getCollectionAmount(item);
    rankMap.set(album.artist, current);
  }

  const ranks = Array.from(rankMap.values());
  return {
    byCount: [...ranks].sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 5),
    byAmount: [...ranks].sort((a, b) => b.amount - a.amount || b.count - a.count).slice(0, 5)
  };
}

function decorateRank(items, metric) {
  return items.map((item, index) => ({
    ...item,
    rank: index + 1,
    medalClass: index < 3 ? `medal-${index + 1}` : "",
    displayValue: metric === "count" ? `${item.count} 张` : `¥${item.amount}`
  }));
}

function findYearIndex(years, year) {
  const index = years.findIndex((item) => Number(item) === Number(year));
  return index >= 0 ? index : 0;
}

Page({
  data: {
    stats: {
      albumCount: 0,
      artistCount: 0,
      trackCount: 0,
      totalPrice: 0
    },
    statCards: [],
    artistProfiles: [],
    styleProfiles: [],
    artistRankByCount: [],
    artistRankByAmount: [],
    currentArtistRank: [],
    rankMetric: "count",
    availableYears: [],
    selectedYearIndex: 0,
    monthlyDistribution: {
      year: "",
      months: [],
      totalCount: 0
    },
    mediaFormatDistribution: {
      totalCount: 0,
      formats: []
    },
    mediaFormatSegments: [],
    visibleMediaFormats: [],
    monthDrawerVisible: false,
    monthDrawerTitle: "",
    monthCollectionItems: []
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadStats();
    if (typeof app.loadCloudCollection === "function") {
      app.loadCloudCollection().then((payload) => {
        if (payload) {
          this.loadStats();
        }
      });
    }
  },
  loadStats() {
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const stats = calculateCollectionStats(sourceAlbums, collectionItems);
    const collectedAlbums = getCollectedAlbums(sourceAlbums, collectionItems);
    const artistRanks = buildArtistRanks(sourceAlbums, collectionItems);
    const selectedYear = this.data.monthlyDistribution ? this.data.monthlyDistribution.year : undefined;
    const monthlyDistribution = buildMonthlyCollectionDistribution(collectionItems, selectedYear);
    const mediaFormatDistribution = buildMediaFormatDistribution(collectionItems);

    this.setData({
      stats,
      statCards: [
        { label: "唱片", value: stats.albumCount },
        { label: "艺人", value: stats.artistCount },
        { label: "曲目", value: stats.trackCount },
        { label: "投入", value: `¥${stats.totalPrice}` }
      ],
      artistProfiles: countBy(collectedAlbums, "artist").slice(0, 4),
      styleProfiles: countBy(collectedAlbums, "style").slice(0, 4),
      artistRankByCount: artistRanks.byCount,
      artistRankByAmount: artistRanks.byAmount,
      currentArtistRank: decorateRank(artistRanks.byCount, "count"),
      rankMetric: "count",
      availableYears: monthlyDistribution.availableYears,
      selectedYearIndex: findYearIndex(monthlyDistribution.availableYears, monthlyDistribution.year),
      monthlyDistribution,
      mediaFormatDistribution,
      mediaFormatSegments: mediaFormatDistribution.formats.filter((item) => item.count > 0),
      visibleMediaFormats: mediaFormatDistribution.formats.filter((item) => item.count > 0)
    });
  },
  handleYearChange(event) {
    const index = Number(event.detail.value || 0);
    const year = this.data.availableYears[index];
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    const monthlyDistribution = buildMonthlyCollectionDistribution(collectionItems, year);

    this.setData({
      selectedYearIndex: findYearIndex(monthlyDistribution.availableYears, monthlyDistribution.year),
      monthlyDistribution
    });
  },
  openMonthDetail(event) {
    const month = Number(event.currentTarget.dataset.month);
    const count = Number(event.currentTarget.dataset.count || 0);
    if (!count) {
      wx.showToast({
        title: "这个月暂无收藏",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const collectionItems = app.globalData.collectionItems || [];
    const year = this.data.monthlyDistribution.year;
    const entries = buildMonthlyCollectionEntries(collectionItems, sourceAlbums, year, month);
    const monthInfo = this.data.monthlyDistribution.months.find((item) => item.month === month);

    this.setData({
      monthDrawerVisible: true,
      monthDrawerTitle: `${year} ${monthInfo ? monthInfo.label : `${month}月`}`,
      monthCollectionItems: entries
    });
  },
  closeMonthDetail() {
    this.setData({
      monthDrawerVisible: false,
      monthCollectionItems: []
    });
  },
  openAlbumDetail(event) {
    const { albumId } = event.currentTarget.dataset;
    if (!albumId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${albumId}`
    });
  },
  toggleRank(event) {
    const { metric } = event.currentTarget.dataset;
    const source = metric === "amount" ? this.data.artistRankByAmount : this.data.artistRankByCount;
    this.setData({
      rankMetric: metric,
      currentArtistRank: decorateRank(source, metric)
    });
  },
  openProfile(event) {
    const { type, name } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/archive-profile/index?type=${type}&name=${encodeURIComponent(name)}`
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});

