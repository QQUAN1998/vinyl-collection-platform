const { albums } = require("../../data/seed.js");
const {
  coverToImageSrc,
  fetchCatalogAlbumDetail,
  normalizeCatalogQuery,
  searchCatalogAlbums
} = require("../../services/catalog-api.js");
const { toggleSelected } = require("../../services/import-service.js");
const { createShareMessage } = require("../../services/share.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: album.cover || coverToImageSrc(album.coverUrl),
    styles: album.style || album.genre || album.region
  };
}

function uniqueAlbums(items) {
  const seen = new Set();
  const result = [];
  for (const album of items) {
    if (!album || seen.has(album.id)) {
      continue;
    }
    seen.add(album.id);
    result.push(toAlbumView(album));
  }
  return result;
}

function searchLocalAlbums(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return albums.filter((album) => {
    return [album.title, album.artist, album.region, album.style].some((field) =>
      String(field || "").toLowerCase().includes(normalized)
    );
  });
}

Page({
  data: {
    query: "",
    candidates: [],
    selectedIds: [],
    selectedCount: 0,
    loading: false,
    hydrating: false,
    errorMessage: "",
    providerNotice: ""
  },
  onLoad(options = {}) {
    this.loadCandidates(options.query || "");
  },
  loadCandidates(query) {
    const normalizedQuery = normalizeCatalogQuery(query);
    const app = getApp();
    const draft = app.globalData.importDraft;
    const draftCandidates = draft && draft.matches
      ? draft.matches.flatMap((match) => match.candidates)
      : [];

    if (draftCandidates.length) {
      this.applyCandidates(normalizedQuery, uniqueAlbums(draftCandidates), {
        draft,
        selectedLimit: 3,
        source: "batch"
      });
      return;
    }

    this.setData({
      loading: true,
      errorMessage: "",
      providerNotice: ""
    });

    searchCatalogAlbums(normalizedQuery, { limit: 8, country: "CN" }, app.globalData.cloud)
      .then((result) => {
        const remoteAlbums = uniqueAlbums(result.albums || []);
        if (!remoteAlbums.length) {
          this.applyCandidates(normalizedQuery, uniqueAlbums(searchLocalAlbums(normalizedQuery)), {
            draft,
            selectedLimit: 3,
            source: "local",
            errorMessage: "在线资料没有匹配结果，已显示本地结果"
          });
          return;
        }

        this.applyCandidates(normalizedQuery, remoteAlbums, {
          draft,
          selectedLimit: 1,
          source: "catalog",
          providerNotice: result.providers && result.providers.failed && result.providers.failed.length
            ? "部分资料源暂不可用，已显示可用结果"
            : ""
        });
      })
      .catch(() => {
        this.applyCandidates(normalizedQuery, uniqueAlbums(searchLocalAlbums(normalizedQuery)), {
          draft,
          selectedLimit: 3,
          source: "local",
          errorMessage: "在线搜索失败，已显示本地结果"
        });
      });
  },
  applyCandidates(query, baseCandidates, options = {}) {
    const app = getApp();
    const selectedLimit = options.selectedLimit || 1;
    const selectedIds = baseCandidates.slice(0, selectedLimit).map((album) => album.id);
    const candidates = baseCandidates.map((album, index) => ({
      ...album,
      selected: index < selectedLimit
    }));

    app.globalData.importDraft = {
      ...(options.draft || {}),
      source: options.source || "search",
      query,
      candidates,
      selectedAlbumIds: selectedIds
    };

    this.setData({
      query,
      candidates,
      selectedIds,
      selectedCount: selectedIds.length,
      loading: false,
      hydrating: false,
      errorMessage: options.errorMessage || "",
      providerNotice: options.providerNotice || ""
    });
  },
  toggleAlbum(event) {
    const album = event.detail.album;
    const nextSelected = toggleSelected(new Set(this.data.selectedIds), album.id);
    const selectedIds = Array.from(nextSelected);
    const app = getApp();

    app.globalData.importDraft = {
      ...(app.globalData.importDraft || {}),
      selectedAlbumIds: selectedIds
    };

    this.setData({
      selectedIds,
      selectedCount: selectedIds.length,
      candidates: this.data.candidates.map((candidate) => ({
        ...candidate,
        selected: selectedIds.includes(candidate.id)
      }))
    });
  },
  goConfirm() {
    if (!this.data.selectedIds.length) {
      wx.showToast({
        title: "请先选择唱片",
        icon: "none"
      });
      return;
    }

    this.hydrateSelectedAlbums().then(() => {
      wx.navigateTo({
        url: "/pages/batch-confirm/index"
      });
    });
  },
  hydrateSelectedAlbums() {
    const app = getApp();
    const selectedSet = new Set(this.data.selectedIds);
    const candidates = this.data.candidates || [];
    const selectedCandidates = candidates.filter((album) => selectedSet.has(album.id));
    if (!selectedCandidates.some((album) => album.catalogProvider && album.catalogProviderId)) {
      return Promise.resolve();
    }

    this.setData({ hydrating: true });
    wx.showLoading({ title: "补全专辑信息" });

    return Promise.all(selectedCandidates.map((album) =>
      fetchCatalogAlbumDetail(album, { country: "CN" }, app.globalData.cloud).catch(() => album)
    ))
      .then((details) => {
        const byId = new Map(details.map((album) => [album.id, toAlbumView(album)]));
        const nextCandidates = candidates.map((album) => ({
          ...(byId.get(album.id) || album),
          selected: selectedSet.has(album.id)
        }));

        app.globalData.importDraft = {
          ...(app.globalData.importDraft || {}),
          candidates: nextCandidates,
          selectedAlbumIds: this.data.selectedIds
        };

        this.setData({ candidates: nextCandidates });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ hydrating: false });
      });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
