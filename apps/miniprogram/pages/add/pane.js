const uiLocale=require("../../ui/locale-runtime");
// Presentation adapter; batch parsing/matching and account share paths reuse existing services.
const uiImport=require('../../services/import-service');
const uiAddMethods={
  uiMethod(e){this.cancelOnlineSearch();this.setData({uiMethod:e.currentTarget.dataset.method,uiError:''});},
  uiBatchInput(e){this.setData({uiBatchText:e.detail.value,uiError:''});},
  uiMatchBatch(){try{const app=getApp(),parsed=uiImport.parseBatchInput(this.data.uiBatchText||''),matches=uiImport.matchAlbumCandidates(parsed.entries,albums,app.globalData.collectionItems||[]);app.globalData.importDraft={source:'batch',batchText:this.data.uiBatchText,parsed,matches,selectedAlbumIds:uiImport.getDefaultSelectedAlbumIds(matches),candidates:matches.flatMap(match=>match.candidates)};wx.navigateTo({url:'/pages/search-results/index'});}catch(e){this.setData({uiError:e.message});}},
};

const { albums } = require("../../data/seed.js");
const {
  coverToImageSrc,
  fetchCatalogAlbumDetail,
  searchCatalogAlbums
} = require("../../services/catalog-api.js");
const { calculateCollectionStats } = require("../../services/stats-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || coverToImageSrc(album.coverUrl),
    styles: album.style
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function searchAlbums(sourceAlbums, query, limit = 4) {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  return sourceAlbums
    .filter((album) => [album.title, album.artist, album.region, album.style, String(album.year)]
      .some((field) => normalize(field).includes(normalized)))
    .slice(0, limit)
    .map(toAlbumView);
}

function uniqueAlbums(items) {
  const seen = new Set();
  const result = [];
  for (const album of items || []) {
    if (!album || !album.id || seen.has(album.id)) {
      continue;
    }
    seen.add(album.id);
    result.push(toAlbumView(album));
  }
  return result;
}

function recentAlbumsFrom(sourceAlbums, collectionItems = [], limit = 3) {
  const albumById = new Map((sourceAlbums || []).map((album) => [album.id, album]));
  const seen = new Set();
  return (collectionItems || [])
    .slice()
    .sort((left, right) => getCollectionTime(right) - getCollectionTime(left))
    .map((item) => {
      if (!item || !item.albumId || seen.has(item.albumId)) {
        return null;
      }
      seen.add(item.albumId);
      return albumById.get(item.albumId) || null;
    })
    .filter(Boolean)
    .slice(0, limit)
    .map(toAlbumView);
}

function getCollectionTime(item = {}) {
  const value = item.createdAt || item.collectionDate || item.updatedAt || "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

require('../../ui/primary-pane')({
  ...uiAddMethods,
  data: {
    uiMethod:"search",uiBatchPlaceholder:"伍佰 & China Blue - 浪人情歌\n伍佰 & China Blue - 白鸽\nAdele - 21",uiBatchText:"",uiError:"",uiAvatar:"",
    query: "",
    hasSearch: false,
    searchLoading: false,
    searchNotice: "",
    collectionCount: 0,
    recentAlbums: [],
    results: []
  },
  onLoad() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadAddPage();
  },
  loadAddPage() {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const collectionItems = app.globalData.collectionItems || [];
    const stats = calculateCollectionStats(sourceAlbums, collectionItems);
    const query = this.data.query;
    const hasSearch = Boolean(normalize(query));
    this.setData({
      uiAvatar:app.globalData.userProfile?.avatar||"",
      collectionCount: stats.albumCount,
      recentAlbums: recentAlbumsFrom(sourceAlbums, collectionItems),
      results: hasSearch ? this.data.results : [],
      hasSearch
    });

    if (hasSearch && !this.data.searchLoading) {
      this.scheduleOnlineSearch(query, 0);
    }
  },
  handleQuery(event) {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const query = event.detail.value;
    const hasSearch = Boolean(normalize(query));
    const localResults = searchAlbums(sourceAlbums, query);

    this.setData({
      query,
      hasSearch,
      results: localResults,
      searchNotice: hasSearch ? "正在搜索在线资料" : "",
      searchLoading: false
    });

    if (!hasSearch) {
      this.cancelOnlineSearch();
      return;
    }

    this.scheduleOnlineSearch(query, 350);
  },
  clearQuery() {
    this.cancelOnlineSearch();
    this.setData({
      query: "",
      hasSearch: false,
      searchLoading: false,
      searchNotice: "",
      results: []
    });
  },
  goSearch() {
    const query = this.data.query.trim();
    if (!query) {
      uiLocale.toast(wx,{
        title: "先输入唱片或艺人",
        icon: "none"
      });
      return;
    }
    this.cancelOnlineSearch();
    wx.navigateTo({
      url: `/pages/search-results/index?query=${encodeURIComponent(query)}`
    });
  },
  cancelOnlineSearch() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchRequestId = (this.searchRequestId || 0) + 1;
  },
  scheduleOnlineSearch(query, delay = 300) {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.performOnlineSearch(query);
    }, delay);
  },
  performOnlineSearch(query) {
    const normalizedQuery = String(query || "").trim();
    const app = getApp();
    if (!normalizedQuery) {
      return;
    }

    const requestId = (this.searchRequestId || 0) + 1;
    this.searchRequestId = requestId;
    this.setData({
      searchLoading: true,
      searchNotice: "正在搜索在线资料"
    });

    searchCatalogAlbums(normalizedQuery, { limit: 8, country: "CN", artistFallback: "always" }, app.globalData.cloud)
      .then((result) => {
        if (this.searchRequestId !== requestId) return;

        const remoteResults = uniqueAlbums(result.albums || []).slice(0, 8);
        if (remoteResults.length) {
          this.setData({
            results: remoteResults,
            searchNotice: result.providers && result.providers.failed && result.providers.failed.length
              ? "部分在线资料源暂不可用，已显示可用结果"
              : "已显示在线资料结果"
          });
          return;
        }

        const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
        this.setData({
          results: searchAlbums(sourceAlbums, normalizedQuery),
          searchNotice: "在线资料没有匹配结果，已显示本地结果"
        });
      })
      .catch(() => {
        if (this.searchRequestId !== requestId) return;

        const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
        this.setData({
          results: searchAlbums(sourceAlbums, normalizedQuery),
          searchNotice: "在线搜索失败，已显示本地结果"
        });
      })
      .finally(() => {
        if (this.searchRequestId === requestId) {
          this.setData({ searchLoading: false });
        }
      });
  },
  goBatchInput() {
    wx.navigateTo({
      url: "/pages/batch-input/index"
    });
  },
  goManualAdd() {
    wx.navigateTo({
      url: "/pages/manual-add/index"
    });
  },
  goAllCollection() {
    wx.navigateTo({
      url: "/pages/all-collection/index"
    });
  },
  openAlbum(event) {
    const { albumId } = event.currentTarget.dataset;
    if (!albumId) {
      return;
    }

    const album = (this.data.results || []).find((item) => item.id === albumId);
    if (album && album.catalogProvider && album.catalogProviderId) {
      this.openCatalogAlbum(album);
      return;
    }

    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${albumId}`
    });
  },
  openCatalogAlbum(album) {
    const app = getApp();
    const selectedId = album.id;
    const saveDraftAndContinue = (selectedAlbum) => {
      const candidates = (this.data.results || []).map((candidate) => ({
        ...(candidate.id === selectedId ? selectedAlbum : candidate),
        selected: candidate.id === selectedId
      }));

      app.globalData.importDraft = {
        source: "catalog",
        query: this.data.query,
        candidates,
        selectedAlbumIds: [selectedId]
      };

      wx.navigateTo({
        url: "/pages/batch-confirm/index"
      });
    };

    if (!app.globalData.cloud.ready) {
      saveDraftAndContinue(album);
      return;
    }

    uiLocale.loading(wx,{ title: "补全专辑信息" });
    fetchCatalogAlbumDetail(album, { country: "CN" }, app.globalData.cloud)
      .then(saveDraftAndContinue)
      .catch(() => saveDraftAndContinue(album))
      .finally(() => {
        wx.hideLoading();
      });
  },
  onShareAppMessage(event) {
    if(event?.target?.dataset?.uiAll){const app=getApp(),ownerId=encodeURIComponent(app.globalData.userId||"");return createShareMessage({title:(app.globalData.userProfile?.name||"音乐收藏者")+"的全部唱片收藏",path:ownerId?"/pages/all-collection/index?ownerId="+ownerId:"/pages/all-collection/index"});}
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
