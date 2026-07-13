const { albums } = require("../../data/seed.js");
const { toggleSelected } = require("../../services/import-service.js");
const { createShareMessage } = require("../../services/share.js");

function toAlbumView(album) {
  return {
    ...album,
    cover: `/${album.coverUrl}`,
    styles: album.style
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

function searchAlbums(query) {
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
    selectedCount: 0
  },
  onLoad(options = {}) {
    this.loadCandidates(options.query || "");
  },
  loadCandidates(query) {
    const app = getApp();
    const draft = app.globalData.importDraft;
    const draftCandidates = draft && draft.matches
      ? draft.matches.flatMap((match) => match.candidates)
      : [];
    const baseCandidates = uniqueAlbums(draftCandidates.length ? draftCandidates : searchAlbums(query));
    const selectedIds = baseCandidates.slice(0, 3).map((album) => album.id);
    const candidates = baseCandidates.map((album, index) => ({
      ...album,
      selected: index < 3
    }));

    app.globalData.importDraft = {
      ...(draft || {}),
      source: draft && draft.source ? draft.source : "search",
      query,
      candidates,
      selectedAlbumIds: selectedIds
    };

    this.setData({
      query,
      candidates,
      selectedIds,
      selectedCount: selectedIds.length
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

    wx.navigateTo({
      url: "/pages/batch-confirm/index"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
