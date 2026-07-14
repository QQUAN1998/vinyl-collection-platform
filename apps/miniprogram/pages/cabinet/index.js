const {
  albums,
  collectionItems,
  demoPricesByAlbumId,
  featuredAlbumId,
  recentAlbumIds
} = require("../../data/seed.js");
const { confirmSelectedAlbums, removeCollectionItem } = require("../../services/collection-service.js");
const { DEFAULT_MEDIUM_KEY, getMediaFormat } = require("../../services/media-format-service.js");
const {
  addAlbumToPhotoWall,
  buildPhotoWallAlbums,
  removeAlbumFromPhotoWall
} = require("../../services/photo-wall-service.js");
const { ensureCloudSession, showCloudDeleteFailed, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { getAlbumRarity } = require("../../services/rarity-service.js");
const { createShareMessage } = require("../../services/share.js");

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

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || `/${album.coverUrl}`,
    styles: album.style
  };
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
    tracksPreview: albumView.tracks || []
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

Page({
  data: {
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
    cardPositionLabel: ""
  },
  onLoad() {
    this.loadCabinet();
  },
  onShow() {
    this.loadCabinet();
    const app = getApp();
    if (typeof app.loadCloudCollection === "function") {
      app.loadCloudCollection().then((payload) => {
        if (payload) {
          this.loadCabinet();
        }
      });
    }
  },
  loadCabinet() {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectionByAlbumId = collectionMapByAlbumId(liveCollectionItems);
    const collectedAlbumIds = new Set(liveCollectionItems.map((item) => item.albumId));
    const recentAlbums = recentAlbumIds
      .filter((albumId) => collectedAlbumIds.has(albumId))
      .map((albumId) => findAlbum(albumId, sourceAlbums))
      .filter(Boolean);

    const catalogState = buildCatalogState(
      sourceAlbums,
      this.data.catalogSearch,
      this.data.catalogScope,
      liveCollectionItems.length
    );
    const albumCard = this.data.albumCard
      ? buildAlbumCard(
        findAlbum(this.data.albumCard.id, sourceAlbums),
        collectionByAlbumId.get(this.data.albumCard.id),
        app.globalData.photoWallOrder || []
      )
      : null;

    this.setData({
      userLabel: app.globalData.userLabel || "\u5531\u7247\u67dc\u7528\u6237 / \u00a50",
      collectionCount: liveCollectionItems.length,
      featuredAlbum: findAlbum(featuredAlbumId, sourceAlbums),
      photoWallAlbums: buildPhotoWallAlbums(
        sourceAlbums,
        liveCollectionItems,
        app.globalData.photoWallOrder || [],
        toAlbumView
      ),
      recentAlbums,
      albumCard,
      ...catalogState
    });
  },
  handleCatalogSearch(event) {
    const catalogSearch = event.detail.value;
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;

    this.setData({
      catalogSearch,
      ...buildCatalogState(sourceAlbums, catalogSearch, this.data.catalogScope, liveCollectionItems.length)
    });
  },
  clearCatalogSearch() {
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;

    this.setData({
      catalogSearch: "",
      ...buildCatalogState(sourceAlbums, "", this.data.catalogScope, liveCollectionItems.length)
    });
  },
  selectCatalogScope(event) {
    const catalogScope = event.currentTarget.dataset.scope || "all";
    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;

    this.setData({
      catalogScope,
      ...buildCatalogState(sourceAlbums, this.data.catalogSearch, catalogScope, liveCollectionItems.length)
    });
  },
  openAdd() {
    wx.navigateTo({
      url: "/pages/add/index"
    });
  },
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
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;
    const collectionByAlbumId = collectionMapByAlbumId(liveCollectionItems);
    const contextAlbums = context === "wall" ? this.data.photoWallAlbums : this.data.visibleAlbums;
    let cardAlbumIds = (contextAlbums || [])
      .filter((item) => !item.placeholder)
      .map((item) => item.id);

    if (!cardAlbumIds.includes(albumId)) {
      cardAlbumIds = sourceAlbums.map((item) => item.id);
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
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
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
    if (!ensureCloudSession(app)) {
      return;
    }

    const now = new Date().toISOString();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
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
      wx.showToast({
        title: "\u5df2\u5728\u6536\u85cf",
        icon: "success"
      });
      return;
    }

    wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
    app.saveCollectionToCloud(result.createdItems[0], albumCard)
      .then((payload) => {
        if (!payload) {
          showCloudSaveFailed();
          return;
        }

        this.loadCabinet();
        this.openAlbumCard(albumCard.id, this.data.cardContext);
        wx.showToast({
          title: "\u5df2\u52a0\u5165\u6536\u85cf",
          icon: "success"
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
    return;
  },
  handleCardStarAction() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    if (albumCard.isCollected) {
      const app = getApp();
      if (!ensureCloudSession(app)) {
        return;
      }

      const result = removeCollectionItem({
        collectionItems: app.globalData.collectionItems || [],
        albumId: albumCard.id
      });
      wx.showLoading({ title: "\u53d6\u6d88\u4e2d" });
      app.deleteCollectionFromCloud(result.removedItem.id)
        .then((payload) => {
          if (!payload) {
            showCloudDeleteFailed();
            return;
          }

          this.loadCabinet();
          this.openAlbumCard(albumCard.id, this.data.cardContext);
          wx.showToast({
            title: "\u5df2\u53d6\u6d88\u6536\u85cf",
            icon: "success"
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
      return;
      return;
    }

    this.handleCardCollectionAction();
  },
  handleWallAction() {
    const albumCard = this.data.albumCard;
    if (!albumCard) {
      return;
    }

    const app = getApp();
    const sourceAlbums = [...albums, ...(app.globalData.manualAlbums || [])];
    const liveCollectionItems = app.globalData.collectionItems || collectionItems;

    if (!albumCard.isCollected) {
      wx.showToast({
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
      wx.showToast({
        title: "照片墙已满",
        icon: "none"
      });
      return;
    }

    app.globalData.photoWallOrder = nextOrder;

    this.loadCabinet();
    this.openAlbumCard(albumCard.id, albumCard.isOnPhotoWall ? this.data.cardContext : "wall");
    wx.showToast({
      title: albumCard.isOnPhotoWall ? "已下墙" : "已上墙",
      icon: "success"
    });
  },
  noop() {},
  onShareAppMessage() {
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
  }
});
