const uiLocale=require("../../ui/locale-runtime");
const { albums } = require("../../data/seed.js");
const {
  COLLECTION_SEARCH_SCOPES,
  buildCollectionShowcase,
  buildCollectedAlbumViews,
  filterCollectedAlbumViews
} = require("../../services/collection-showcase-service.js");
const { removeCollectionItems } = require("../../services/collection-service.js");
const { requireCloudAccount, showCloudDeleteFailed } = require("../../services/cloud-session.js");
const { buildPhotoWallOrder } = require("../../services/photo-wall-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

function getSourceAlbums(app) {
  return [...albums, ...(app.globalData.manualAlbums || [])];
}

function decorateBatchSelection(albumList = [], selectedAlbumIds = []) {
  const selectedAlbumIdSet = new Set(selectedAlbumIds || []);
  return (albumList || []).map((album) => ({
    ...album,
    batchSelected: selectedAlbumIdSet.has(album.id)
  }));
}

Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  uiShowDetail(options){this.setData({uiDetailOptions:options,uiDetailOpen:true});},
  uiDismissDetail(){this.setData({uiDetailOpen:false});},
  uiDetailLeft(){this.setData({uiDetailOpen:false,uiDetailOptions:null});this.loadCollection();},

  async uiPrepareShare(){
    if(this.data.uiPreparingShare||!this.data.canManageCollection)return;
    this.setData({uiPreparingShare:true});
    try{const app=getApp(),me=await requireCloudAccount(app);if(me&&app.globalData.userId){this.loadLocalCollection();this.setData({uiShareReady:true});uiLocale.toast(wx,{title:'已就绪，点击分享',icon:'none'});}}catch(e){uiLocale.toast(wx,{title:'请先在我的页面登录',icon:'none'});}finally{this.setData({uiPreparingShare:false});}
  },
  data: {uiDetailOpen:false,uiDetailOptions:null,uiShareReady:false,uiPreparingShare:false,uiSharedError:false,uiCatalogAvatar:"",
    userName: "\u5531\u7247\u67dc\u7528\u6237",
    avatarInitial: "D",
    stats: {
      albumCount: 0,
      artistCount: 0,
      trackCount: 0,
      totalPriceLabel: "¥0"
    },
    query: "",
    searchScope: "all",
    searchScopes: COLLECTION_SEARCH_SCOPES.map((item, index) => ({ ...item, active: index === 0 })),
    collectedAlbums: [],
    visibleAlbums: [],
    ownerId: "",
    canManageCollection: true,
    batchDeleteMode: false,
    selectedAlbumIds: [],
    selectedCount: 0,
    allVisibleSelected: false,
    isBatchDeleting: false,
    albumCard: null,
    cardIndex: 0,
    cardPositionLabel: "0 / 0"
  },
  onLoad(options = {}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    const ownerId = options.ownerId || "";
    this.setData({
      ownerId,
      canManageCollection: !ownerId,
      batchDeleteMode: false,
      selectedAlbumIds: [],
      selectedCount: 0,
      allVisibleSelected: false
    });
    this.loadCollection();
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadCollection();
  },
  loadCollection() {
    const app = getApp();
    if (this.data.ownerId && typeof app.loadSharedCloudCollection === "function") {
      this.loadSharedCloudCollection(this.data.ownerId);
      return;
    }

    this.loadLocalCollection();
    if (typeof app.loadCloudCollection === "function") {
      app.loadCloudCollection().then((payload) => {
        if (payload) {
          this.loadLocalCollection();
        }
      });
    }
  },
  loadLocalCollection() {
    const app = getApp();
    const sourceAlbums = getSourceAlbums(app);
    const collectionItems = app.globalData.collectionItems || [];
    this.renderCollection(sourceAlbums, collectionItems, app.globalData.userProfile);
  },
  loadSharedCloudCollection(ownerId) {
    const app = getApp();
    app.loadSharedCloudCollection(ownerId).then((payload) => {
      if (!payload) {
        this.renderCollection([],[],{name:"收藏暂时不可用"});
        this.setData({uiSharedError:true});
        return;
      }
      this.setData({uiSharedError:false});

      this.renderCollection(
        [...albums, ...payload.manualAlbums],
        payload.collectionItems,
        {
          name: payload.owner.displayName,
          avatar: payload.owner.avatarUrl
        }
      );
    });
  },
  renderCollection(sourceAlbums, collectionItems, userProfile) {
    const showcase = buildCollectionShowcase(sourceAlbums, collectionItems, userProfile);
    const collectedAlbums = showcase.albums;

    this.setData({
      uiCatalogAvatar:getApp().globalData.userProfile?.avatar||"",
      uiShareReady:!!(this.data.canManageCollection&&getApp().isCloudAccountReady()&&getApp().globalData.userId),
      userName: showcase.userName,
      avatarInitial: showcase.avatarInitial,
      stats: showcase.stats,
      collectedAlbums,
      visibleAlbums: this.buildVisibleAlbums(collectedAlbums, this.data.query, this.data.searchScope)
    });
  },
  buildVisibleAlbums(collectedAlbums = this.data.collectedAlbums, query = this.data.query, scope = this.data.searchScope, selectedAlbumIds = this.data.selectedAlbumIds) {
    return decorateBatchSelection(
      filterCollectedAlbumViews(collectedAlbums, query, scope),
      selectedAlbumIds
    );
  },
  buildSelectionData(selectedAlbumIds = this.data.selectedAlbumIds, collectedAlbums = this.data.collectedAlbums, query = this.data.query, scope = this.data.searchScope) {
    const normalizedSelectedAlbumIds = selectedAlbumIds || [];
    const visibleAlbums = this.buildVisibleAlbums(collectedAlbums, query, scope, normalizedSelectedAlbumIds);
    const selectedAlbumIdSet = new Set(normalizedSelectedAlbumIds);
    const visibleAlbumIds = visibleAlbums.map((album) => album.id).filter(Boolean);
    return {
      selectedAlbumIds: normalizedSelectedAlbumIds,
      selectedCount: normalizedSelectedAlbumIds.length,
      allVisibleSelected: Boolean(visibleAlbumIds.length) && visibleAlbumIds.every((albumId) => selectedAlbumIdSet.has(albumId)),
      visibleAlbums
    };
  },
  applySearch() {
    this.setData({
      ...this.buildSelectionData(),
      searchScopes: COLLECTION_SEARCH_SCOPES.map((item) => ({
        ...item,
        active: item.key === this.data.searchScope
      }))
    });
  },
  handleQuery(event) {
    this.setData({
      query: event.detail.value
    }, () => {
      this.applySearch();
    });
  },
  clearQuery() {
    this.setData({
      query: ""
    }, () => {
      this.applySearch();
    });
  },
  selectSearchScope(event) {
    this.setData({
      searchScope: event.currentTarget.dataset.scope || "all"
    }, () => {
      this.applySearch();
    });
  },
  toggleBatchDeleteMode() {
    if (!this.data.canManageCollection) {
      uiLocale.toast(wx,{
        title: "分享页面不能删除",
        icon: "none"
      });
      return;
    }
    if (!this.data.collectedAlbums.length) {
      uiLocale.toast(wx,{
        title: "还没有可删除的唱片",
        icon: "none"
      });
      return;
    }

    const batchDeleteMode = !this.data.batchDeleteMode;
    this.setData({
      batchDeleteMode,
      selectedAlbumIds: [],
      selectedCount: 0,
      allVisibleSelected: false,
      albumCard: null
    }, () => {
      this.applySearch();
    });
  },
  handleAlbumRowTap(event) {
    if (this.data.batchDeleteMode) {
      this.toggleBatchSelection(event);
      return;
    }

    const albumId=event.currentTarget.dataset.albumId;if(albumId)this.uiShowDetail({albumId,...(this.data.ownerId?{ownerId:this.data.ownerId}:{})});
  },
  toggleBatchSelection(event) {
    if (!this.data.canManageCollection || !this.data.batchDeleteMode) {
      return;
    }

    const { albumId } = event.currentTarget.dataset;
    if (!albumId) {
      return;
    }

    const selectedAlbumIdSet = new Set(this.data.selectedAlbumIds || []);
    if (selectedAlbumIdSet.has(albumId)) {
      selectedAlbumIdSet.delete(albumId);
    } else {
      selectedAlbumIdSet.add(albumId);
    }

    const selectedAlbumIds = Array.from(selectedAlbumIdSet);
    this.setData({
      ...this.buildSelectionData(selectedAlbumIds)
    });
  },
  toggleSelectAllVisible() {
    if (!this.data.canManageCollection || !this.data.batchDeleteMode) {
      return;
    }

    const visibleAlbumIds = this.data.visibleAlbums.map((album) => album.id).filter(Boolean);
    if (!visibleAlbumIds.length) {
      uiLocale.toast(wx,{
        title: "当前没有可选择的唱片",
        icon: "none"
      });
      return;
    }

    const selectedAlbumIdSet = new Set(this.data.selectedAlbumIds || []);
    if (this.data.allVisibleSelected) {
      visibleAlbumIds.forEach((albumId) => selectedAlbumIdSet.delete(albumId));
    } else {
      visibleAlbumIds.forEach((albumId) => selectedAlbumIdSet.add(albumId));
    }

    this.setData({
      ...this.buildSelectionData(Array.from(selectedAlbumIdSet))
    });
  },
  clearBatchSelection() {
    this.setData({
      ...this.buildSelectionData([])
    });
  },
  confirmBatchDelete() {
    if (!this.data.canManageCollection) {
      uiLocale.toast(wx,{
        title: "分享页面不能删除",
        icon: "none"
      });
      return;
    }
    if (!this.data.selectedCount) {
      uiLocale.toast(wx,{
        title: "先选择要删除的唱片",
        icon: "none"
      });
      return;
    }

    uiLocale.modal(wx,{
      title: "批量删除唱片",
      content: `确定从收藏中删除已选择的 ${this.data.selectedCount} 张唱片吗？`,
      confirmText: "删除",
      confirmColor: "#b96d5b",
      success: (result) => {
        if (result.confirm) {
          this.deleteSelectedCollections();
        }
      }
    });
  },
  async deleteSelectedCollections() {
    if (this.data.isBatchDeleting || !this.data.canManageCollection) {
      return;
    }

    const app = getApp();
    const me = await requireCloudAccount(app);
    if (!me) {
      return;
    }

    let deleteResult;
    try {
      deleteResult = removeCollectionItems({
        collectionItems: app.globalData.collectionItems || [],
        albumIds: this.data.selectedAlbumIds
      });
    } catch (error) {
      uiLocale.toast(wx,{
        title: "这些唱片已不在收藏中",
        icon: "none"
      });
      this.clearBatchSelection();
      return;
    }

    const removedAlbumIds = new Set(deleteResult.removedItems.map((item) => item.albumId));
    const removedCollectionIds = deleteResult.removedItems.map((item) => item.id).filter(Boolean);
    const sourceAlbums = getSourceAlbums(app);
    app.globalData.collectionItems = (app.globalData.collectionItems || deleteResult.collectionItems)
      .filter((item) => !removedAlbumIds.has(item.albumId));
    app.globalData.photoWallOrder = buildPhotoWallOrder(
      sourceAlbums,
      app.globalData.collectionItems,
      app.globalData.photoWallOrder || []
    );
    if (typeof app.refreshUserLabel === "function") {
      app.refreshUserLabel();
    }

    this.setData({
      batchDeleteMode: false,
      selectedAlbumIds: [],
      selectedCount: 0,
      allVisibleSelected: false,
      albumCard: null
    }, () => {
      this.loadLocalCollection();
    });
    uiLocale.toast(wx,{
      title: `已删除${deleteResult.removedItems.length}张`,
      icon: "success"
    });

    this.syncBatchDeleteToCloud(removedCollectionIds);
  },
  syncBatchDeleteToCloud(collectionIds) {
    const app = getApp();
    if (!collectionIds.length || typeof app.deleteCollectionsFromCloud !== "function") {
      return;
    }

    this.setData({ isBatchDeleting: true });
    app.deleteCollectionsFromCloud(collectionIds)
      .then((payload) => {
        if (!payload) {
          showCloudDeleteFailed();
          return;
        }
        this.loadLocalCollection();
      })
      .finally(() => {
        this.setData({ isBatchDeleting: false });
      });
  },
  openAlbumCard(event) {
    const { albumId } = event.currentTarget.dataset;
    const cardIndex = this.data.visibleAlbums.findIndex((album) => album.id === albumId);
    if (cardIndex < 0) {
      return;
    }

    this.setData({
      albumCard: this.data.visibleAlbums[cardIndex],
      cardIndex,
      cardPositionLabel: `${cardIndex + 1} / ${this.data.visibleAlbums.length}`
    });
  },
  closeAlbumCard() {
    this.setData({
      albumCard: null
    });
  },
  moveAlbumCard(event) {
    const direction = Number(event.currentTarget.dataset.direction);
    const total = this.data.visibleAlbums.length;
    if (!total) {
      return;
    }

    const cardIndex = (this.data.cardIndex + direction + total) % total;
    this.setData({
      albumCard: this.data.visibleAlbums[cardIndex],
      cardIndex,
      cardPositionLabel: `${cardIndex + 1} / ${total}`
    });
  },
  openCardDetail() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    this.setData({
      albumCard: null
    }, () => {
      wx.navigateTo({
        url: `/pages/album-detail/index?albumId=${albumCard.id}${this.data.ownerId?"&ownerId="+encodeURIComponent(this.data.ownerId):""}`
      });
    });
  },
  noop() {},
  onShareAppMessage() {
    if(this.data.uiDetailOpen){const detail=this.selectComponent("#uiDetail");if(detail?.onShareAppMessage)return detail.onShareAppMessage();}
    const app = getApp();
    const ownerId = encodeURIComponent(this.data.ownerId || app.globalData.userId || "");
    return createShareMessage({
      title: `${this.data.userName}的全部唱片收藏`,
      path: ownerId ? `/pages/all-collection/index?ownerId=${ownerId}` : "/pages/all-collection/index"
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
}));
