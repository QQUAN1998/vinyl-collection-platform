const uiImageActions=require('../../ui/image-actions');
const uiTicketData=require('../../ui/ticket-data');
const uiLocale=require("../../ui/locale-runtime");
const {refreshCollection}=require('../../ui/collection-refresh');
const uiSpace=require('../../ui/space-navigation');
const {buildDeck:uiBuildDeck}=require("../../ui/deck-model");
const {
  albums,
  collectionItems,
  demoPricesByAlbumId,
  featuredAlbumId,
  recentAlbumIds
} = require("../../data/seed.js");
const { confirmSelectedAlbums, removeCollectionItem } = require("../../services/collection-service.js");
const {
  buildCollectedAlbumLibrary,
  mergeAlbumLibraries,
  toAlbumView
} = require("../../services/album-library-service.js");
const { DEFAULT_MEDIUM_KEY, getMediaFormat } = require("../../services/media-format-service.js");
const {
  addAlbumToPhotoWall,
  buildPhotoWallAlbums,
  removeAlbumFromPhotoWall
} = require("../../services/photo-wall-service.js");
const { requireCloudAccount, showCloudDeleteFailed, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { getAlbumRarity } = require("../../services/rarity-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const { normalizeTrackDisplayList } = require("../../services/track-display-service.js");
const {
  getPreviewPlayerState,
  subscribePreviewPlayer,
  togglePreviewPlayback
} = require("../../services/preview-player-service.js");
const { fetchCatalogAlbumDetail } = require("../../services/catalog-api.js");
const {
  buildDailyRecommendationFallback,
  getRecommendationDateKey,
  loadDailyRecommendation,
  readFastStoredDailyRecommendation
} = require("../../services/daily-recommendation-service.js");

const CATALOG_SCOPES = [
  { key: "all", label: "全部" },
  { key: "album", label: "唱片" },
  { key: "artist", label: "艺人" },
  { key: "style", label: "风格" },
  { key: "decade", label: "年代" }
];

function formatMoney(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function collectionMapByAlbumId(items) {
  return new Map((items || []).map((item) => [item.albumId, item]));
}

function formatCollectionDate(collectionItem) {
  if (!collectionItem?.collectionDate) {
    return "资料库示例";
  }

  return `收藏于 ${collectionItem.collectionDate.slice(0, 7)}`;
}

function buildAlbumCard(album, collectionItem, photoWallOrder = []) {
  if (!album) {
    return null;
  }

  const price = Number(collectionItem?.price || demoPricesByAlbumId[album.id] || 0);
  const rarity = getAlbumRarity(price);
  const isCollected = Boolean(collectionItem);
  const medium = getMediaFormat(collectionItem?.mediumKey);
  const albumView = toAlbumView(album);

  return {
    ...albumView,
    price,
    priceLabel: isCollected ? formatMoney(price) : `参考 ${formatMoney(price)}`,
    collectionStatus: isCollected ? "已收藏" : "未收藏",
    collectionDateLabel: formatCollectionDate(collectionItem),
    mediumLabel: isCollected ? medium.label : "默认黑胶",
    conditionLabel: isCollected ? `${collectionItem.condition || "--"} / ${collectionItem.quantity || 1} 张` : "可从资料库加入",
    actionLabel: isCollected ? "编辑收藏" : "加入收藏",
    isCollected,
    isOnPhotoWall: photoWallOrder.includes(album.id),
    wallActionLabel: photoWallOrder.includes(album.id) ? "下墙" : "上墙",
    rarityCode: rarity.code,
    rarityLabel: rarity.label,
    rarityName: rarity.name,
    rarityClass: `rarity-${rarity.code.toLowerCase()}`,
    tracksPreview: normalizeTrackDisplayList(albumView.tracks || [])
  };
}

function findAlbum(albumId, sourceAlbums = albums) {
  const album = sourceAlbums.find((item) => item.id === albumId) || albums.find((item) => item.id === albumId);
  return album ? toAlbumView(album) : null;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function decadeOf(year) {
  if (!year) return "";
  return `${Math.floor(Number(year) / 10) * 10}s`;
}

function filterAlbums(sourceAlbums, query, scope = "all") {
  const normalized = normalizeSearch(query);
  const visibleAlbums = sourceAlbums.map(toAlbumView);
  if (!normalized) {
    return visibleAlbums;
  }

  return visibleAlbums.filter((album) => (
    (scope === "album" ? [album.title]
      : scope === "artist" ? [album.artist]
        : scope === "style" ? [album.style, album.region]
          : scope === "decade" ? [String(album.year), decadeOf(album.year)]
            : [album.title, album.artist, album.region, album.style, String(album.year), decadeOf(album.year)])
      .some((field) => normalizeSearch(field).includes(normalized))
  ));
}

function buildCatalogState(sourceAlbums, query, scope, collectionCount) {
  const visibleAlbums = filterAlbums(sourceAlbums, query, scope);
  const hasSearch = Boolean(normalizeSearch(query));

  return {
    visibleAlbums,
    catalogCountLabel: hasSearch ? `${visibleAlbums.length} 条结果` : `${collectionCount} 张收藏`,
    catalogScopes: CATALOG_SCOPES.map((item) => ({
      ...item,
      active: item.key === scope
    }))
  };
}

function buildRecommendationLoadKey(sourceAlbums = [], collectionItems = []) {
  const albumIds = (collectionItems || [])
    .map((item) => item && item.albumId)
    .filter(Boolean)
    .sort()
    .join("|");
  return `${getRecommendationDateKey()}:${sourceAlbums.length}:${albumIds}`;
}

function formatPreviewPlayerState(state = {}) {
  if (!state.visible || !state.albumId) {
    return null;
  }

  return {
    ...state,
    playStateLabel: state.isPlaying ? "\u6682\u505c\u8bd5\u542c" : "\u7ee7\u7eed\u8bd5\u542c"
  };
}

const uiPrimaryTabs=require('../../ui/primary-tabs');
Page(uiLocale.page({uiImageActions(){const d=this.data;uiImageActions.openImage(d.albumCard?.cover);},

  ...uiPrimaryTabs,
  uiShowDetail(options){this.setData({uiDetailOptions:options,uiDetailOpen:true});},
  uiDismissDetail(){this.setData({uiDetailOpen:false});},
  uiDetailLeft(){this.setData({uiDetailOpen:false,uiDetailOptions:null});this.loadCabinet();},

  uiAllCollection(){wx.navigateTo({url:"/pages/all-collection/index"});},
  data: {uiTab:'home',uiMounted:{add:false,stats:false},uiDetailOpen:false,uiDetailOptions:null,
    uiLife:{},
    deckAlbums:[],deckCollections:[],deckOwner:"",deckAvatar:"",
    userLabel: "\u5531\u7247\u67dc\u7528\u6237 / \u00a50",
    collectionCount: 0,
    collectionUnit: "张唱片",
    featuredAlbum: null,
    photoWallAlbums: [],
    recentAlbums: [],
    catalogSearch: "",
    catalogScope: "all",
    catalogScopes: CATALOG_SCOPES.map((item, index) => ({ ...item, active: index === 0 })),
    catalogCountLabel: "0 \u5f20\u6536\u85cf",
    visibleAlbums: [],
    albumCard: null,
    cardAlbumIds: [],
    cardIndex: 0,
    cardContext: "catalog",
    cardPositionLabel: "",
    previewPlayer: null,
    dailyRecommendation: buildDailyRecommendationFallback("loading")
  },
  onLoad(options={}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.unsubscribePreviewPlayer = subscribePreviewPlayer((state) => {
      this.syncPreviewPlayerState(state);
    });
    if(['add','stats'].includes(options.tab))this.uiPrimary(options.tab);
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadCabinet();
    this.syncPreviewPlayerState();
    refreshCollection(app).then(payload => {
      if (payload && !this.uiDisposed) this.loadCabinet();
    }).catch(() => {});
  },
  onUnload() {
    this.uiDisposed = true;
    if (this.unsubscribePreviewPlayer) {
      this.unsubscribePreviewPlayer();
      this.unsubscribePreviewPlayer = null;
    }
  },
  loadCabinet() {
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectedAlbums = buildCollectedAlbumLibrary(sourceAlbums, liveCollectionItems);
    const view = {
      collectionCount: liveCollectionItems.length,
      deckAlbums: collectedAlbums.map(({id,title,artist,cover,coverUrl,year})=>({id,title,artist,cover,coverUrl,year})),
      deckCollections: liveCollectionItems.map(({albumId,collectionDate,price,quantity})=>({albumId,collectionDate,price,quantity})),
      deckOwner: app.globalData.userProfile?.name || "",
      deckAvatar: app.globalData.userProfile?.avatar || ""
    };
    const signature = JSON.stringify(view);
    if (signature !== this.uiCabinetSignature) {
      this.uiCabinetSignature = signature;
      this.setData(view);
    }
    // New UI has no daily recommendation; collection and audio detail services stay unchanged.
  },
  refreshDailyRecommendation(sourceAlbums, liveCollectionItems) {
    const loadKey = buildRecommendationLoadKey(sourceAlbums, liveCollectionItems);
    const current = this.data.dailyRecommendation;
    if (this.dailyRecommendationLoadKey === loadKey && current && !current.loading) {
      return;
    }
    if (this.dailyRecommendationRequestKey === loadKey) {
      return;
    }

    const app = getApp();
    const dateKey = getRecommendationDateKey();
    const fastRecommendation = readFastStoredDailyRecommendation({
      sourceAlbums,
      collectionItems: liveCollectionItems,
      wxApi: wx,
      now: new Date()
    });
    this.dailyRecommendationRequestKey = loadKey;
    if (!current || current.dateKey !== dateKey) {
      this.setData({
        dailyRecommendation: fastRecommendation || buildDailyRecommendationFallback("loading", dateKey)
      });
    }

    loadDailyRecommendation({
      sourceAlbums,
      collectionItems: liveCollectionItems,
      cloudConfig: app.globalData.cloud || {},
      wxApi: wx
    })
      .then((dailyRecommendation) => {
        if (this.dailyRecommendationRequestKey !== loadKey) {
          return;
        }
        this.dailyRecommendationLoadKey = loadKey;
        this.dailyRecommendationRequestKey = "";
        this.setData({
          dailyRecommendation: dailyRecommendation.action === "recommendation"
            ? dailyRecommendation
            : (fastRecommendation || dailyRecommendation)
        });
      })
      .catch(() => {
        if (this.dailyRecommendationRequestKey !== loadKey) {
          return;
        }
        this.dailyRecommendationLoadKey = loadKey;
        this.dailyRecommendationRequestKey = "";
        this.setData({
          dailyRecommendation: fastRecommendation || buildDailyRecommendationFallback("unavailable", dateKey)
        });
      });
  },
  syncPreviewPlayerState(state = getPreviewPlayerState()) {
    this.setData({
      previewPlayer: formatPreviewPlayerState(state)
    });
  },
  openPreviewPlayerDetail() {
    const previewPlayer = this.data.previewPlayer;
    if (!previewPlayer || !previewPlayer.albumId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/album-detail/index?albumId=${previewPlayer.albumId}`
    });
  },
  togglePreviewPlayer() {
    togglePreviewPlayback();
    this.syncPreviewPlayerState();
  },
  openDailyRecommendation() {
    const dailyRecommendation = this.data.dailyRecommendation;
    if (!dailyRecommendation || dailyRecommendation.loading) {
      return;
    }
    if (!dailyRecommendation.album || dailyRecommendation.action !== "recommendation") {
      wx.navigateTo({
        url: "/pages/add/index"
      });
      return;
    }

    const app = getApp();
    const album = dailyRecommendation.album;
    const openRecommendationDetail = (selectedAlbum = album) => {
      const albumView = toAlbumView(selectedAlbum);
      const recommendationAlbums = app.globalData.recommendationAlbums || [];
      app.globalData.recommendationAlbums = [
        albumView,
        ...recommendationAlbums.filter((item) => item && item.id !== albumView.id)
      ].slice(0, 12);

      wx.navigateTo({
        url: `/pages/album-detail/index?albumId=${albumView.id}`
      });
    };

    if (!album.catalogProvider || !album.catalogProviderId) {
      openRecommendationDetail(album);
      return;
    }

    uiLocale.loading(wx,{ title: "补全专辑信息" });
    fetchCatalogAlbumDetail(album, { country: "CN" }, app.globalData.cloud || {}, wx)
      .then(openRecommendationDetail)
      .catch(() => openRecommendationDetail(album))
      .finally(() => {
        wx.hideLoading();
      });
  },
  handleCatalogSearch(event) {
    const catalogSearch = event.detail.value;
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectedAlbums = buildCollectedAlbumLibrary(sourceAlbums, liveCollectionItems);

    this.setData({
      catalogSearch,
      ...buildCatalogState(collectedAlbums, catalogSearch, this.data.catalogScope, liveCollectionItems.length)
    });
  },
  clearCatalogSearch() {
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectedAlbums = buildCollectedAlbumLibrary(sourceAlbums, liveCollectionItems);

    this.setData({
      catalogSearch: "",
      ...buildCatalogState(collectedAlbums, "", this.data.catalogScope, liveCollectionItems.length)
    });
  },
  selectCatalogScope(event) {
    const catalogScope = event.currentTarget.dataset.scope || "all";
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectedAlbums = buildCollectedAlbumLibrary(sourceAlbums, liveCollectionItems);

    this.setData({
      catalogScope,
      ...buildCatalogState(collectedAlbums, this.data.catalogSearch, catalogScope, liveCollectionItems.length)
    });
  },
  openAdd() {this.uiPrimary('add');},
  togglePhotoWall() { this.setData({ photoWallExpanded: !this.data.photoWallExpanded }); },
  openHomeAlbum(event) {const albumId=event.detail.id;if(this.data.deckAlbums.some(row=>row.id===albumId))this.openAlbumCard(albumId,"home");},
  openUiAccount() { wx.navigateTo({ url: "/pages/account/index" }); },
  openAlbum(event) {
    const { placeholder } = event.currentTarget.dataset;
    if (placeholder === true || placeholder === "true") {
      this.openAdd();
      return;
    }
    const album = event.detail.album || event.currentTarget.dataset.album;
    const albumId = album && album.id ? album.id : event.currentTarget.dataset.albumId;
    const context = event.currentTarget.dataset.context || "catalog";
    if (!albumId) {
      return;
    }

    this.openAlbumCard(albumId, context);
  },
  openAlbumCard(albumId, context = "catalog") {
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectedAlbums = buildCollectedAlbumLibrary(sourceAlbums, liveCollectionItems);
    const collectionByAlbumId = collectionMapByAlbumId(liveCollectionItems);
    const contextAlbums = context === "home" ? this.data.deckAlbums : context === "wall" ? this.data.photoWallAlbums : this.data.visibleAlbums;
    let cardAlbumIds = (contextAlbums || [])
      .filter((item) => !item.placeholder)
      .map((item) => item.id);

    if (!cardAlbumIds.includes(albumId)) {
      cardAlbumIds = collectedAlbums.map((item) => item.id);
    }

    const cardIndex = Math.max(0, cardAlbumIds.indexOf(albumId));
    const currentAlbumId = cardAlbumIds[cardIndex] || albumId;
    const album = findAlbum(currentAlbumId, sourceAlbums);
    const albumCard = buildAlbumCard(album, collectionByAlbumId.get(currentAlbumId), app.globalData.photoWallOrder || []);
    if (!albumCard) {
      return;
    }

    this.setData({
      albumCard,
      cardAlbumIds,
      cardIndex,
      cardContext: context,
      cardPositionLabel: `${cardIndex + 1} / ${cardAlbumIds.length || 1}`
    });
  },
  closeAlbumCard() {
    this.setData({
      albumCard: null
    });
  },
  moveAlbumCard(event) {
    const direction = Number(event.currentTarget.dataset.direction);
    const total = this.data.cardAlbumIds.length;
    if (!total) {
      return;
    }

    const cardIndex = (this.data.cardIndex + direction + total) % total;
    const albumId = this.data.cardAlbumIds[cardIndex];
    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectionByAlbumId = collectionMapByAlbumId(liveCollectionItems);
    const albumCard = buildAlbumCard(
      findAlbum(albumId, sourceAlbums),
      collectionByAlbumId.get(albumId),
      app.globalData.photoWallOrder || []
    );

    this.setData({
      albumCard,
      cardIndex,
      cardPositionLabel: `${cardIndex + 1} / ${total}`
    });
  },
  openCardDetail() {
    if (!this.data.albumCard) {
      return;
    }

    const albumId = this.data.albumCard.id;
    this.setData({
      albumCard: null
    }, () => {
      wx.navigateTo({
        url: `/pages/album-detail/index?albumId=${albumId}`
      });
    });
  },
  handleCardCollectionAction() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    if (albumCard.isCollected) {
      this.setData({
        albumCard: null
      }, () => {
        wx.navigateTo({
          url: `/pages/collection-edit/index?albumId=${albumCard.id}`
        });
      });
      return;
    }

    const app = getApp();
    requireCloudAccount(app).then((me) => {
      if (!me) {
        return;
      }

      const now = new Date().toISOString();
      const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
      const result = confirmSelectedAlbums({
        selectedAlbumIds: [albumCard.id],
        albums: sourceAlbums,
        existingCollectionItems: app.globalData.collectionItems || [],
        defaults: {
          userId: app.globalData.userId || "",
          collectionDate: now.slice(0, 10),
          source: "资料库添加",
          quantity: 1,
          condition: "NM",
          mediumKey: DEFAULT_MEDIUM_KEY,
          notes: ""
        },
        pricesByAlbumId: demoPricesByAlbumId,
        now
      });

      if (!result.createdItems.length) {
        this.loadCabinet();
        this.openAlbumCard(albumCard.id, this.data.cardContext);
        uiLocale.toast(wx,{
          title: "\u5df2\u5728\u6536\u85cf",
          icon: "success"
        });
        return;
      }

      uiLocale.loading(wx,{ title: "\u4fdd\u5b58\u4e2d" });
      app.saveCollectionToCloud(result.createdItems[0], albumCard)
        .then((payload) => {
          if (!payload) {
            showCloudSaveFailed();
            return;
          }

          this.loadCabinet();
          this.openAlbumCard(albumCard.id, this.data.cardContext);
          uiLocale.toast(wx,{
            title: "\u5df2\u52a0\u5165\u6536\u85cf",
            icon: "success"
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
    });
    return;
  },
  handleCardDeleteAction() {
    const albumCard = this.data.albumCard;
    if (!albumCard || !albumCard.isCollected) {
      return;
    }

    uiLocale.modal(wx,{
      title: "删除唱片",
      content: `确认从收藏中删除《${albumCard.title}》吗？`,
      confirmText: "删除",
      confirmColor: "#b96d5b",
      success: (result) => {
        if (result.confirm) {
          this.deleteCollectedAlbum(albumCard.id);
        }
      }
    });
  },
  deleteCollectedAlbum(albumId) {
    const app = getApp();
    requireCloudAccount(app).then((me) => {
      if (!me) {
        return;
      }

      const result = removeCollectionItem({
        collectionItems: app.globalData.collectionItems || [],
        albumId
      });
      uiLocale.loading(wx,{ title: "\u5220\u9664\u4e2d" });
      app.deleteCollectionFromCloud(result.removedItem.id)
        .then((payload) => {
          if (!payload) {
            showCloudDeleteFailed();
            return;
          }

          this.loadCabinet();
          this.setData({ albumCard: null });
          uiLocale.toast(wx,{
            title: "\u5df2\u5220\u9664",
            icon: "success"
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
    });
  },
  handleWallAction() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    const app = getApp();
    const sourceAlbums = mergeAlbumLibraries(albums, app.globalData.manualAlbums || []);
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;

    if (!albumCard.isCollected) {
      uiLocale.toast(wx,{
        title: "先加入收藏",
        icon: "none"
      });
      return;
    }

    const currentOrder = app.globalData.photoWallOrder || [];
    const nextOrder = albumCard.isOnPhotoWall
      ? removeAlbumFromPhotoWall(currentOrder, albumCard.id, sourceAlbums, liveCollectionItems)
      : addAlbumToPhotoWall(currentOrder, albumCard.id, sourceAlbums, liveCollectionItems);

    if (!albumCard.isOnPhotoWall && nextOrder.length === currentOrder.length) {
      uiLocale.toast(wx,{
        title: "照片墙已满",
        icon: "none"
      });
      return;
    }

    app.globalData.photoWallOrder = nextOrder;

    this.loadCabinet();
    this.openAlbumCard(albumCard.id, albumCard.isOnPhotoWall ? this.data.cardContext : "wall");
    uiLocale.toast(wx,{
      title: albumCard.isOnPhotoWall ? "已下墙" : "已上墙",
      icon: "success"
    });
  },
  uiTicketShare(){const ticket=uiTicketData.vinyl(this.data.albumCard,this.data.deckAlbums,this.data.deckCollections,this.data.deckOwner,this.data.deckAvatar);if(ticket)this.setData({uiTicket:ticket});},
  uiTicketClose(){this.setData({uiTicket:null});},
  noop() {},
  onShareAppMessage(event) {
    const paneMessage=this.uiPaneShare(event);if(paneMessage)return paneMessage;
    if(this.data.uiDetailOpen){const detail=this.selectComponent("#uiDetail");if(detail?.onShareAppMessage)return detail.onShareAppMessage();}
    const app = getApp();
    const name = app.globalData.userProfile?.name || "\u5531\u7247\u67dc\u7528\u6237";
    const album = this.data.albumCard;
    if (album) {
      return createShareMessage({
        title: `${name}的唱片卡片 · ${album.title}`,
        path: `/pages/album-detail/index?albumId=${album.id}`,
        imageUrl: album.cover
      });
    }

    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
},"唱片柜"));
