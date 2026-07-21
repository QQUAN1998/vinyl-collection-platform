const { easterAlbums } = require("../../data/easter-library.js");
const {
  buildEasterAlbumListViews,
  buildEasterCollectionItems,
  filterEasterAlbums,
  getUncollectedEasterAlbumIds,
  toEasterAlbum
} = require("../../services/easter-library-service.js");
const { requireCloudAccount, showCloudSaveFailed } = require("../../services/cloud-session.js");
const { triggerTvSync } = require("../../services/tv-sync-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

const EASTER_PASSWORD = "0816";
const SAVE_CONCURRENCY = 3;

function uniqueIds(ids = []) {
  return Array.from(new Set(ids.filter(Boolean)));
}

Page({
  data: {
    unlocked: false,
    password: "",
    query: "",
    visibleAlbums: [],
    totalCount: easterAlbums.length,
    visibleCount: 0,
    selectedIds: [],
    selectedCount: 0,
    uncollectedCount: 0,
    saving: false,
    progressText: ""
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    if (this.data.unlocked) {
      this.refreshAlbums();
    }
  },
  handlePasswordInput(event) {
    this.setData({ password: event.detail.value });
  },
  unlockLibrary() {
    if (String(this.data.password || "").trim() !== EASTER_PASSWORD) {
      wx.showToast({
        title: "密码不对",
        icon: "none"
      });
      return;
    }

    this.setData({
      unlocked: true,
      password: ""
    });
    this.refreshAlbums();
  },
  handleQueryInput(event) {
    this.setData({ query: event.detail.value });
    this.refreshAlbums({ query: event.detail.value });
  },
  clearQuery() {
    this.setData({ query: "" });
    this.refreshAlbums({ query: "" });
  },
  refreshAlbums(options = {}) {
    const app = getApp();
    const query = options.query === undefined ? this.data.query : options.query;
    const collectionItems = app.globalData.collectionItems || [];
    const filteredAlbums = filterEasterAlbums(query, easterAlbums);
    const uncollectedIds = getUncollectedEasterAlbumIds(easterAlbums, collectionItems);
    const selectedIds = this.data.selectedIds.filter((id) => uncollectedIds.includes(id));

    this.setData({
      query,
      selectedIds,
      selectedCount: selectedIds.length,
      uncollectedCount: uncollectedIds.length,
      visibleAlbums: buildEasterAlbumListViews({
        albums: filteredAlbums,
        collectionItems,
        selectedIds
      }),
      visibleCount: filteredAlbums.length
    });
  },
  toggleAlbum(event) {
    const album = event.detail.album;
    if (!album || album.collected || this.data.saving) {
      return;
    }

    const selected = new Set(this.data.selectedIds);
    if (selected.has(album.id)) {
      selected.delete(album.id);
    } else {
      selected.add(album.id);
    }

    const selectedIds = Array.from(selected);
    this.setData({
      selectedIds,
      selectedCount: selectedIds.length
    });
    this.refreshAlbums();
  },
  selectVisibleAlbums() {
    if (this.data.saving) {
      return;
    }
    const ids = this.data.visibleAlbums
      .filter((album) => !album.collected)
      .map((album) => album.id);
    const selectedIds = uniqueIds(this.data.selectedIds.concat(ids));
    this.setData({
      selectedIds,
      selectedCount: selectedIds.length
    });
    this.refreshAlbums();
  },
  clearSelection() {
    if (this.data.saving) {
      return;
    }
    this.setData({
      selectedIds: [],
      selectedCount: 0
    });
    this.refreshAlbums();
  },
  collectSelected() {
    this.confirmAndSave(this.data.selectedIds, "已选唱片");
  },
  collectAll() {
    const app = getApp();
    this.confirmAndSave(
      getUncollectedEasterAlbumIds(easterAlbums, app.globalData.collectionItems || []),
      "全部未收藏唱片"
    );
  },
  async confirmAndSave(albumIds, label) {
    if (this.data.saving) {
      return;
    }

    const selectedAlbumIds = uniqueIds(albumIds);
    if (!selectedAlbumIds.length) {
      wx.showToast({
        title: "请先选择唱片",
        icon: "none"
      });
      return;
    }

    const app = getApp();
    const me = await requireCloudAccount(app);
    if (!me) {
      wx.showToast({
        title: "微信登录失败，请重试",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "加入收藏",
      content: `确认把${label}中的 ${selectedAlbumIds.length} 张加入你的唱片柜？`,
      confirmText: "加入",
      cancelText: "取消",
      success: (result) => {
        if (result.confirm) {
          this.saveAlbums(selectedAlbumIds, { skipLogin: true });
        }
      }
    });
  },
  async saveAlbums(selectedAlbumIds, options = {}) {
    const app = getApp();
    if (!options.skipLogin) {
      const me = await requireCloudAccount(app);
      if (!me) {
        wx.showToast({
          title: "微信登录失败，请重试",
          icon: "none"
        });
        return;
      }
    }

    const userId = app.globalData.userId || "";
    const result = buildEasterCollectionItems({
      selectedAlbumIds,
      albums: easterAlbums,
      existingCollectionItems: app.globalData.collectionItems || [],
      userId
    });

    if (!result.createdItems.length) {
      wx.showToast({
        title: "都已经收藏过了",
        icon: "none"
      });
      this.refreshAlbums();
      return;
    }

    this.setData({
      saving: true,
      progressText: `准备加入 ${result.createdItems.length} 张`
    });
    wx.showLoading({ title: "加入收藏中" });

    const albumsById = new Map(easterAlbums.map(toEasterAlbum).map((album) => [album.id, album]));
    const saveEntries = result.createdItems
      .map((collectionItem) => ({
        collectionItem,
        album: albumsById.get(collectionItem.albumId)
      }))
      .filter((entry) => entry.album);
    const batchPayload = saveEntries.length > 1 && typeof app.saveCollectionsToCloud === "function"
      ? await this.saveCollectionsToCloud(saveEntries, app)
      : null;
    const failedItems = batchPayload
      ? []
      : await this.saveQueue(result.createdItems, albumsById, app);
    wx.hideLoading();

    if (failedItems.length) {
      this.setData({
        saving: false,
        progressText: ""
      });
      showCloudSaveFailed();
      return;
    }

    app.globalData.tvBindings = triggerTvSync(app.globalData.tvBindings || [], userId).bindings;
    if (!batchPayload) {
      await app.loadCloudCollection({ force: true });
    }
    this.setData({
      selectedIds: [],
      selectedCount: 0,
      saving: false,
      progressText: ""
    });
    this.refreshAlbums();
    wx.showToast({
      title: `已加入 ${result.createdItems.length} 张`,
      icon: "success"
    });
  },
  saveCollectionsToCloud(entries, app) {
    this.setData({ progressText: `正在批量加入 ${entries.length} 张` });
    return app.saveCollectionsToCloud(entries);
  },
  saveQueue(items, albumsById, app) {
    let nextIndex = 0;
    let completed = 0;
    const failedItems = [];
    const total = items.length;

    const runNext = () => {
      if (nextIndex >= items.length) {
        return Promise.resolve();
      }

      const item = items[nextIndex];
      nextIndex += 1;
      return app.saveCollectionToCloud(item, albumsById.get(item.albumId))
        .then((payload) => {
          if (!payload) {
            failedItems.push(item);
          }
        })
        .catch(() => {
          failedItems.push(item);
        })
        .then(() => {
          completed += 1;
          this.setData({ progressText: `正在加入 ${completed}/${total}` });
        })
        .then(runNext);
    };

    const workerCount = Math.min(SAVE_CONCURRENCY, items.length);
    return Promise.all(Array.from({ length: workerCount }, runNext))
      .then(() => failedItems);
  },
  onShareAppMessage() {
    return createShareMessage({
      title: "唱片柜隐藏收藏库",
      path: "/pages/user-guide/index"
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
