const { albums } = require("../../data/seed.js");
const {
  buildMediaFormatDistribution,
  buildMonthlyCollectionEntries,
  buildMonthlyCollectionDistribution,
  calculateCollectionStats
} = require("../../services/stats-service.js");
const { createShareMessage } = require("../../services/share.js");

const POSTER_CANVAS_ID = "statsPosterCanvas";
const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1500;

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
    current.count += Number(item.quantity || 1);
    current.amount += Number(item.price || 0);
    rankMap.set(album.artist, current);
  }

  const ranks = Array.from(rankMap.values());
  return {
    byCount: [...ranks].sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 5),
    byAmount: [...ranks].sort((a, b) => b.amount - a.amount || b.count - a.count).slice(0, 5)
  };
}

function buildTopValueAlbums(sourceAlbums, collectionItems) {
  const albumById = new Map(sourceAlbums.map((album) => [album.id, album]));
  return collectionItems
    .map((item) => {
      const album = albumById.get(item.albumId);
      if (!album) return null;
      return {
        id: album.id,
        title: album.title,
        artist: album.artist,
        cover: album.cover || `/${album.coverUrl}`,
        price: Number(item.price || 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.price - a.price || a.title.localeCompare(b.title))
    .slice(0, 3);
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

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, color) {
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.setFillStyle(color);
  ctx.fill();
}

function drawText(ctx, text, x, y, size, color, align = "left") {
  ctx.setFillStyle(color);
  ctx.setTextAlign(align);
  ctx.setFontSize(size);
  ctx.fillText(String(text), x, y);
}

function drawTextLine(ctx, text, x, y, maxLength, size, color, align = "left") {
  const value = String(text || "");
  const line = value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  drawText(ctx, line, x, y, size, color, align);
}

function getCanvasImagePath(src) {
  return new Promise((resolve) => {
    if (!src || typeof wx.getImageInfo !== "function") {
      resolve(src || "");
      return;
    }

    wx.getImageInfo({
      src,
      success: (result) => resolve(result.path || src),
      fail: () => resolve(src)
    });
  });
}

function drawImageCover(ctx, imagePath, x, y, size, radius = 14) {
  fillRoundRect(ctx, x, y, size, size, radius, "#efede6");
  if (!imagePath) return;
  ctx.save();
  drawRoundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(imagePath, x, y, size, size);
  ctx.restore();
}

function drawPosterStat(ctx, card, x, y, width, color, textColor = "#1a1a1a") {
  fillRoundRect(ctx, x, y, width, 128, 16, color);
  drawText(ctx, card.value, x + 22, y + 55, card.value.length > 6 ? 31 : 38, textColor);
  drawText(ctx, card.label, x + 22, y + 98, 21, textColor === "#ffffff" ? "#f4f1e8" : "#686a63");
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
    topValueAlbums: [],
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
    monthCollectionItems: [],
    posterImage: "",
    posterVisible: false,
    posterGenerating: false,
    posterStatusLabel: "未生成"
  },
  onShow() {
    this.loadStats();
    const app = getApp();
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
    const topValueAlbums = buildTopValueAlbums(sourceAlbums, collectionItems);
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
      topValueAlbums,
      rankMetric: "count",
      availableYears: monthlyDistribution.availableYears,
      selectedYearIndex: findYearIndex(monthlyDistribution.availableYears, monthlyDistribution.year),
      monthlyDistribution,
      mediaFormatDistribution,
      mediaFormatSegments: mediaFormatDistribution.formats.filter((item) => item.count > 0),
      visibleMediaFormats: mediaFormatDistribution.formats.filter((item) => item.count > 0),
      posterImage: ""
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
  drawStatsPoster(ctx, userName, posterImages = {}) {
    const { stats, topValueAlbums, artistRankByCount } = this.data;
    const valueAlbums = topValueAlbums.slice(0, 3);
    const topArtists = artistRankByCount.slice(0, 3);
    const today = new Date();
    const dateText = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
    const avatarText = String(userName || "D").slice(0, 1).toUpperCase();

    ctx.setFillStyle("#f7f3ea");
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

    fillRoundRect(ctx, 34, 34, POSTER_WIDTH - 68, POSTER_HEIGHT - 68, 30, "#edf5ec");
    fillRoundRect(ctx, 54, 54, POSTER_WIDTH - 108, POSTER_HEIGHT - 108, 22, "#fffdf7");
    fillRoundRect(ctx, 54, 54, POSTER_WIDTH - 108, 196, 22, "#1a1a1a");
    fillRoundRect(ctx, 54, 194, POSTER_WIDTH - 108, 56, 0, "#1a1a1a");

    ctx.setFillStyle("#f1e8c3");
    ctx.beginPath();
    ctx.arc(120, 136, 42, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, avatarText, 120, 152, 42, "#1a1a1a", "center");

    drawText(ctx, `${userName} 的唱片柜`, 184, 124, 31, "#fffdf7");
    drawText(ctx, `${userName} / ¥${stats.totalPrice}`, 184, 160, 22, "#dfe8d3");
    drawText(ctx, dateText, 628, 142, 22, "#f1e8c3", "right");

    ctx.setStrokeStyle("#d8d5cc");
    ctx.setLineWidth(2);
    ctx.beginPath();
    ctx.moveTo(88, 278);
    ctx.lineTo(662, 278);
    ctx.stroke();

    drawText(ctx, "我的唱片收藏报告", 88, 360, 52, "#1a1a1a");

    drawPosterStat(ctx, { label: "张唱片", value: String(stats.albumCount) }, 88, 404, 178, "#dfe8d3");
    drawPosterStat(ctx, { label: "位艺人", value: String(stats.artistCount) }, 286, 404, 178, "#f1e8c3");
    drawPosterStat(ctx, { label: "收藏投入", value: `¥${stats.totalPrice}` }, 484, 404, 178, "#b96d5b", "#ffffff");

    fillRoundRect(ctx, 88, 574, 574, 2, 1, "#d8d5cc");
    drawText(ctx, "最有价值 TOP 3", 88, 626, 26, "#1a1a1a");
    valueAlbums.forEach((item, index) => {
      const x = 88 + index * 194;
      fillRoundRect(ctx, x - 10, 654, 184, 260, 16, "#fbfaf6");
      drawImageCover(ctx, posterImages.valueImages && posterImages.valueImages[index], x, 674, 164, 12);
      fillRoundRect(ctx, x + 10, 684, 34, 34, 8, "rgba(17, 20, 24, 0.78)");
      drawText(ctx, index + 1, x + 27, 708, 20, "#ffffff", "center");
      drawTextLine(ctx, item.title, x, 864, 9, 22, "#1a1a1a");
      drawText(ctx, `¥${item.price}`, x, 892, 19, "#9a7520");
    });

    drawText(ctx, "收藏艺人 TOP 3", 88, 1000, 26, "#1a1a1a");
    topArtists.forEach((item, index) => {
      const x = 88 + index * 194;
      fillRoundRect(ctx, x - 10, 1030, 184, 158, 16, "#f4f1e8");
      drawImageCover(ctx, posterImages.artistImages && posterImages.artistImages[index], x + 46, 1050, 72, 12);
      drawTextLine(ctx, item.name, x + 82, 1150, 7, 21, "#1a1a1a", "center");
      drawText(ctx, `${item.count} 张`, x + 82, 1177, 18, "#65764d", "center");
    });

    fillRoundRect(ctx, 88, 1266, 574, 2, 1, "#d8d5cc");
    drawText(ctx, "扫码查看我的唱片柜", 88, 1328, 25, "#1a1a1a");
    drawText(ctx, "来自唱片柜小程序 · 可同步电视端展示", 88, 1362, 19, "#686a63");
    fillRoundRect(ctx, 520, 1300, 132, 132, 18, "#efede6");
    fillRoundRect(ctx, 538, 1318, 96, 96, 12, "#fffdf7");
    ctx.setStrokeStyle("#65764d");
    ctx.setLineWidth(7);
    ctx.strokeRect(562, 1342, 48, 48);
    ctx.setLineWidth(4);
    ctx.beginPath();
    ctx.moveTo(584, 1328);
    ctx.lineTo(622, 1328);
    ctx.moveTo(584, 1404);
    ctx.lineTo(622, 1404);
    ctx.stroke();
  },
  async generatePoster() {
    if (this.data.posterGenerating) {
      return;
    }

    this.setData({
      posterGenerating: true,
      posterStatusLabel: "生成中"
    });

    try {
      const app = getApp();
      const userName = (app.globalData.userProfile && app.globalData.userProfile.name) || "\u5531\u7247\u67dc\u7528\u6237";
      const valueImages = await Promise.all(this.data.topValueAlbums.slice(0, 3).map((item) => getCanvasImagePath(item.cover)));
      const artistImages = await Promise.all(this.data.artistRankByCount.slice(0, 3).map((item) => getCanvasImagePath(item.avatar)));
      const ctx = wx.createCanvasContext(POSTER_CANVAS_ID, this);
      this.drawStatsPoster(ctx, userName, { valueImages, artistImages });
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: POSTER_CANVAS_ID,
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
          destWidth: POSTER_WIDTH * 2,
          destHeight: POSTER_HEIGHT * 2,
          success: (result) => {
            this.setData({
              posterImage: result.tempFilePath,
              posterGenerating: false,
              posterStatusLabel: "已生成"
            });
          },
          fail: () => {
            this.setData({
              posterGenerating: false,
              posterStatusLabel: "生成失败"
            });
            wx.showToast({
              title: "海报生成失败",
              icon: "none"
            });
          }
        }, this);
      });
    } catch (error) {
      this.setData({
        posterGenerating: false,
        posterStatusLabel: "生成失败"
      });
      wx.showToast({
        title: "海报生成失败",
        icon: "none"
      });
    }
  },
  openPoster() {
    this.setData({
      posterVisible: true
    });
    if (!this.data.posterImage) {
      this.generatePoster();
    }
  },
  closePoster() {
    this.setData({
      posterVisible: false
    });
  },
  noop() {
    return undefined;
  },
  previewPoster() {
    if (!this.data.posterImage) {
      return;
    }
    wx.previewImage({
      current: this.data.posterImage,
      urls: [this.data.posterImage]
    });
  },
  savePoster() {
    if (!this.data.posterImage) {
      wx.showToast({
        title: this.data.posterGenerating ? "海报生成中" : "请先生成海报",
        icon: "none"
      });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => {
        wx.showToast({
          title: "已保存",
          icon: "success"
        });
      },
      fail: () => {
        wx.showToast({
          title: "保存失败，请检查相册权限",
          icon: "none"
        });
      }
    });
  },
  sharePosterImage() {
    if (!this.data.posterImage) {
      wx.showToast({
        title: this.data.posterGenerating ? "海报生成中" : "请先生成海报",
        icon: "none"
      });
      return;
    }

    if (typeof wx.showShareImageMenu === "function") {
      wx.showShareImageMenu({
        path: this.data.posterImage,
        fail: () => {
          wx.previewImage({
            current: this.data.posterImage,
            urls: [this.data.posterImage]
          });
        }
      });
      return;
    }

    wx.previewImage({
      current: this.data.posterImage,
      urls: [this.data.posterImage]
    });
    wx.showToast({
      title: "当前微信版本请长按图片分享",
      icon: "none"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});

