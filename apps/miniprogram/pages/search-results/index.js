const { albums } = require("../../data/seed.js");
const {
  coverToImageSrc,
  fetchCatalogAlbumDetail,
  normalizeCatalogQuery,
  searchCatalogAlbums
} = require("../../services/catalog-api.js");
const {
  createManualAlbumCandidate,
  getDefaultSelectedAlbumIds,
  rankBatchCatalogCandidates,
  toggleSelected
} = require("../../services/import-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

const INITIAL_CATALOG_LIMIT = 20;
const CATALOG_LIMIT_STEP = 40;
const MAX_CATALOG_LIMIT = 300;
const BATCH_SEARCH_CONCURRENCY = 4;

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

function markSelected(candidates, selectedIds) {
  const selectedSet = new Set(selectedIds);
  return candidates.map((album) => ({
    ...album,
    selected: selectedSet.has(album.id)
  }));
}

function buildProviderNotice(result = {}) {
  return result.providers && result.providers.failed && result.providers.failed.length
    ? "部分资料源暂不可用，已显示可用结果"
    : "";
}

Page({
  data: {
    query: "",
    candidates: [],
    selectedIds: [],
    selectedCount: 0,
    loading: false,
    loadingMore: false,
    hydrating: false,
    searchLimit: INITIAL_CATALOG_LIMIT,
    hasMoreResults: false,
    resultNotice: "",
    errorMessage: "",
    providerNotice: ""
  },
  onLoad(options = {}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadCandidates(options.query || "");
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  loadCandidates(query) {
    const normalizedQuery = normalizeCatalogQuery(query);
    const app = getApp();
    const draft = app.globalData.importDraft;
    if (draft && draft.source === "batch" && draft.parsed && draft.parsed.entries) {
      this.loadBatchCatalogResults(draft);
      return;
    }

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

    this.loadCatalogResults(normalizedQuery, INITIAL_CATALOG_LIMIT, {
      draft,
      reset: true
    });
  },
  loadBatchCatalogResults(draft = {}) {
    const app = getApp();
    const entries = draft.parsed && draft.parsed.entries ? draft.parsed.entries : [];
    if (!entries.length) {
      this.applyCandidates("", [], {
        draft,
        selectedLimit: 0,
        source: "batch",
        errorMessage: "批量输入为空"
      });
      return;
    }

    this.setData({
      query: "批量匹配",
      candidates: [],
      selectedIds: [],
      selectedCount: 0,
      loading: true,
      loadingMore: false,
      searchLimit: entries.length,
      hasMoreResults: false,
      resultNotice: "",
      errorMessage: "",
      providerNotice: ""
    });

    this.runBatchCatalogSearches(entries, draft)
      .then((matches) => {
        const candidates = uniqueAlbums(matches.flatMap((match) => match.candidates));
        const candidateIds = new Set(candidates.map((album) => album.id));
        const selectedIds = getDefaultSelectedAlbumIds(matches)
          .filter((albumId) => candidateIds.has(albumId));
        const manualCount = matches.filter((match) => match.manualFallback).length;

        this.applyCandidates("批量匹配", candidates, {
          draft: {
            ...draft,
            matches
          },
          selectedIds,
          selectedLimit: 0,
          source: "batch",
          hasMoreResults: false,
          searchLimit: entries.length,
          resultNotice: manualCount
            ? `有 ${manualCount} 行没有找到在线资料，已自动生成待补全唱片`
            : "已完成批量在线匹配"
        });
      })
      .catch(() => {
        const fallbackMatches = entries.map((entry, index) =>
          buildBatchFallbackMatch(entry, index, draft.matches && draft.matches[index])
        );
        const candidates = uniqueAlbums(fallbackMatches.flatMap((match) => match.candidates));
        this.applyCandidates("批量匹配", candidates, {
          draft: {
            ...draft,
            matches: fallbackMatches
          },
          selectedIds: getDefaultSelectedAlbumIds(fallbackMatches),
          selectedLimit: 0,
          source: "batch",
          hasMoreResults: false,
          searchLimit: entries.length,
          errorMessage: "在线批量搜索暂时失败，已按输入生成待补全唱片"
        });
      });
  },
  runBatchCatalogSearches(entries, draft = {}) {
    const matches = new Array(entries.length);
    let nextIndex = 0;
    const workerCount = Math.min(BATCH_SEARCH_CONCURRENCY, entries.length);

    const runNext = () => {
      if (nextIndex >= entries.length) {
        return Promise.resolve();
      }

      const index = nextIndex;
      nextIndex += 1;
      return this.searchBatchEntry(entryAt(entries, index), index, draft.matches && draft.matches[index])
        .then((match) => {
          matches[index] = match;
        })
        .then(runNext);
    };

    return Promise.all(Array.from({ length: workerCount }, runNext))
      .then(() => matches);
  },
  searchBatchEntry(entry, index, localMatch) {
    const app = getApp();
    const primaryQuery = entry.query || entry.inputLine || entry.title;
    const relaxedQuery = entry.title && entry.title !== primaryQuery ? entry.title : "";
    const searchOptions = { limit: 10, country: "CN", artistFallback: "always" };

    const requests = [
      searchCatalogAlbums(primaryQuery, searchOptions, app.globalData.cloud)
    ];
    if (relaxedQuery) {
      requests.push(searchCatalogAlbums(relaxedQuery, searchOptions, app.globalData.cloud));
    }

    return Promise.allSettled(requests)
      .then((results) => {
        const remoteCandidates = rankBatchCatalogCandidates(
          entry,
          uniqueAlbums(results.flatMap((result) =>
            result.status === "fulfilled" ? (result.value.albums || []) : []
          ))
        );
        if (remoteCandidates.length) {
          return {
            inputLine: entry.inputLine,
            candidates: remoteCandidates,
            selectedAlbumId: remoteCandidates[0].id,
            alreadyCollected: Boolean(localMatch && localMatch.alreadyCollected),
            manualFallback: false
          };
        }
        return buildBatchFallbackMatch(entry, index, localMatch);
      })
      .catch(() => buildBatchFallbackMatch(entry, index, localMatch));
  },
  loadCatalogResults(query, limit, options = {}) {
    const app = getApp();
    const reset = options.reset !== false;
    const currentCandidates = reset ? [] : this.data.candidates;
    const currentSelectedIds = reset ? [] : this.data.selectedIds;

    this.setData(reset ? {
      loading: true,
      loadingMore: false,
      searchLimit: limit,
      hasMoreResults: false,
      resultNotice: "",
      errorMessage: "",
      providerNotice: ""
    } : {
      loadingMore: true,
      resultNotice: "",
      errorMessage: ""
    });

    searchCatalogAlbums(
      query,
      { limit, country: "CN", artistFallback: "always" },
      app.globalData.cloud
    )
      .then((result) => {
        const remoteAlbums = uniqueAlbums(result.albums || []);
        if (reset && !remoteAlbums.length) {
          this.applyCandidates(query, uniqueAlbums(searchLocalAlbums(query)), {
            draft: options.draft,
            selectedLimit: 3,
            source: "local",
            hasMoreResults: false,
            searchLimit: limit,
            errorMessage: "在线资料没有匹配结果，已显示本地结果"
          });
          return;
        }

        const nextCandidates = reset
          ? remoteAlbums
          : uniqueAlbums(currentCandidates.concat(remoteAlbums));
        const newCount = nextCandidates.length - currentCandidates.length;
        const hasMoreResults = nextCandidates.length >= limit && limit < MAX_CATALOG_LIMIT && (reset || newCount > 0);
        const resultNotice = !hasMoreResults && nextCandidates.length
          ? "已显示全部可获取结果"
          : "";

        this.applyCandidates(query, nextCandidates, {
          draft: reset ? options.draft : app.globalData.importDraft,
          selectedLimit: reset ? 1 : 0,
          selectedIds: reset ? undefined : currentSelectedIds,
          source: "catalog",
          hasMoreResults,
          searchLimit: limit,
          resultNotice,
          providerNotice: buildProviderNotice(result)
        });
      })
      .catch(() => {
        if (reset) {
          this.applyCandidates(query, uniqueAlbums(searchLocalAlbums(query)), {
            draft: options.draft,
            selectedLimit: 3,
            source: "local",
            hasMoreResults: false,
            searchLimit: limit,
            errorMessage: "在线搜索失败，已显示本地结果"
          });
          return;
        }

        this.setData({
          loadingMore: false,
          hasMoreResults: false,
          resultNotice: "暂时没有获取到更多结果"
        });
      });
  },
  loadMoreResults() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMoreResults) {
      return;
    }

    const nextLimit = Math.min(
      (this.data.searchLimit || INITIAL_CATALOG_LIMIT) + CATALOG_LIMIT_STEP,
      MAX_CATALOG_LIMIT
    );
    this.loadCatalogResults(this.data.query, nextLimit, { reset: false });
  },
  onReachBottom() {
    this.loadMoreResults();
  },
  applyCandidates(query, baseCandidates, options = {}) {
    const app = getApp();
    const candidateIds = new Set(baseCandidates.map((album) => album.id));
    const selectedLimit = options.selectedLimit === undefined ? 1 : options.selectedLimit;
    const selectedIds = options.selectedIds
      ? options.selectedIds.filter((id) => candidateIds.has(id))
      : baseCandidates.slice(0, selectedLimit).map((album) => album.id);
    const candidates = markSelected(baseCandidates, selectedIds);

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
      loadingMore: false,
      hydrating: false,
      searchLimit: options.searchLimit || this.data.searchLimit || INITIAL_CATALOG_LIMIT,
      hasMoreResults: Boolean(options.hasMoreResults),
      resultNotice: options.resultNotice || "",
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
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});

function buildBatchFallbackMatch(entry, index, localMatch = {}) {
  const nonManualCandidates = (localMatch.candidates || []).filter((album) => !album.manualDraft);
  const candidates = nonManualCandidates.length
    ? nonManualCandidates
    : [createManualAlbumCandidate(entry, index)];
  return {
    inputLine: entry.inputLine,
    candidates,
    selectedAlbumId: candidates[0] ? candidates[0].id : undefined,
    alreadyCollected: Boolean(localMatch.alreadyCollected),
    manualFallback: !nonManualCandidates.length
  };
}

function entryAt(entries, index) {
  return entries[index] || {};
}
