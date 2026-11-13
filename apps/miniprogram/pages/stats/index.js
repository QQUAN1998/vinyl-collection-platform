const uiLocale=require("../../ui/locale-runtime");
const {refreshCollection}=require('../../ui/collection-refresh');
const {requireCloudAccount}=require('../../services/cloud-session');
const uiStats = require("../../ui/stats-model");
const uiSnapshot = require("../../ui/stats-snapshot");
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

Page(uiLocale.page({
  async uiCollectionShare(e){
    if(this.uiReadOnly||this.data.uiReadOnly||this.data.uiCollectionPreparing)return;
    const app=getApp();
    const ready=()=>!!(app.isCloudAccountReady?.()&&app.globalData.userId);
    this.setData({uiCollectionShareReady:ready(),uiShareSource:ready()?{ownerId:app.globalData.userId}:null});
    if(e.detail.passive||ready())return;
    this.setData({uiCollectionPreparing:true});
    try{await requireCloudAccount(app);this.setData({uiCollectionShareReady:ready(),uiShareSource:ready()?{ownerId:app.globalData.userId}:null});}
    catch(e){uiLocale.toast(wx,{title:'请先在我的页面登录',icon:'none'});}
    finally{this.setData({uiCollectionPreparing:false});}
  },
  data: {uiCollectionShareReady:false,uiCollectionPreparing:false,
    uiShareSource:null,uiShareLoading:false,uiShareError:"",uiRecords:[],uiOwner:"音乐收藏者",uiAvatar:"",uiReadOnly:false,uiSnapshotOptions:null,
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
  async onLoad(options={}) {
    if(!options.uiRef&&!options.uiSnapshot)return;
    this.uiReadOnly=true;
    this.uiStatsShare=null;
    this.setData({uiReadOnly:true,uiShareLoading:true,uiShareError:'',uiRecords:[]});
    try{
      const snap=options.uiRef?await uiSnapshot.readReference(options.uiRef):uiSnapshot.decode(options.uiSnapshot);
      if(this.uiDisposed)return;
      this.setData({uiRecords:snap.records,uiKind:snap.kind,uiOwner:snap.owner,uiAvatar:snap.avatar||'',uiReadOnly:true,uiShareSource:snap.source||null,uiSnapshotOptions:snap});
      try{this.uiStatsShare=uiSnapshot.message(snap);}catch(e){this.uiStatsShare=null;}
      if(!options.uiRef){
        const media=require('../../ui/stats-share-media');
        media.hydrate(snap,media.readShared).then(uiRecords=>{if(!this.uiDisposed)this.setData({uiRecords});}).catch(()=>{});
      }
    }catch(e){if(!this.uiDisposed)this.setData({uiShareError:'分享暂不可用，请稍后重试',uiStatsShare:null});}
    finally{if(!this.uiDisposed)this.setData({uiShareLoading:false});}
  },
  uiRetryShare(){return this.onLoad(this.options||{});},
  uiSelect(e) { if(this.uiReadOnly)return; this.openAlbumDetail({currentTarget:{dataset:{albumId:e.detail.id}}}); },
  uiShare(e) { this.uiStatsShare=e.detail.message; },
  onShow() {
    if(this.uiReadOnly)return;
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadStats();
    refreshCollection(app).then(payload => {
      if (payload && !this.uiDisposed) this.loadStats();
    }).catch(() => {});
  },
  onUnload() {this.uiDisposed=true;},
  loadStats() {
    const app = getApp();
    const collectionItems = app.globalData.collectionItems || [];
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const view={uiShareSource:app.isCloudAccountReady?.()&&app.globalData.userId?{ownerId:app.globalData.userId}:null,uiRecords:uiStats.vinylRecords(sourceAlbums,collectionItems),uiKind:"vinyl",uiOwner:app.globalData.userProfile?.name || "音乐收藏者",uiAvatar:app.globalData.userProfile?.avatar || ""};
    const signature=JSON.stringify(view);
    if(signature===this.uiStatsSignature)return;
    this.uiStatsSignature=signature;this.uiStatsShare=null;
    this.setData(view);
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
      uiLocale.toast(wx,{
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
  onShareAppMessage(event) {
    if(event?.target?.dataset?.scope==='all'&&!this.uiReadOnly&&!this.data.uiReadOnly){
      const app=getApp(),owner=app.isCloudAccountReady?.()?app.globalData.userId:'';
      return createShareMessage(owner?{title:(app.globalData.userProfile?.name||'音乐收藏者')+'的全部唱片收藏',path:'/pages/all-collection/index?ownerId='+encodeURIComponent(owner)}:{});
    }
    if(this.uiStatsShare)return this.uiStatsShare;
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
},"统计"));

