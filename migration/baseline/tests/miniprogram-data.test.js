const assert = require("node:assert/strict");
const test = require("node:test");

const { albums, collectionItems, demoPricesByAlbumId } = require("../data/seed.js");
const { confirmSelectedAlbums, removeCollectionItem, removeCollectionItems } = require("../services/collection-service.js");
const {
  getDefaultSelectedAlbumIds,
  parseBatchInput,
  matchAlbumCandidates,
  rankBatchCatalogCandidates,
} = require("../services/import-service.js");
const {
  buildCollectionMarkdown,
  buildMarkdownFileName,
} = require("../services/collection-export-service.js");
const { MEDIA_FORMATS, getMediaFormat } = require("../services/media-format-service.js");
const {
  addAlbumToPhotoWall,
  buildPhotoWallAlbums,
  buildPhotoWallOrder,
  removeAlbumFromPhotoWall
} = require("../services/photo-wall-service.js");
const { getAlbumRarity, getAlbumRarityClass } = require("../services/rarity-service.js");
const {
  buildCollectedAlbumViews,
  filterCollectedAlbumViews
} = require("../services/collection-showcase-service.js");
const {
  buildCollectedAlbumLibrary,
  findAlbumInLibrary,
  toAlbumImageSrc,
} = require("../services/album-library-service.js");
const {
  buildMediaFormatDistribution,
  buildMonthlyCollectionEntries,
  buildMonthlyCollectionDistribution,
  calculateCollectionStats
} = require("../services/stats-service.js");
const {
  buildArchiveProfile,
} = require("../services/archive-profile-service.js");
const { createShareMessage, createShareTimeline, enableFriendShare } = require("../services/share.js");
const {
  buildWechatProfile,
  cleanProfileNameValue,
  formatProfileDisplayName,
  hasWechatProfileInfo,
} = require("../services/account-profile-service.js");
const {
  AUTH_STATE_STORAGE_KEY,
  hasStoredAuthAccount,
  readStoredAuthState,
  writeStoredAuthState,
} = require("../services/auth-state-service.js");
const {
  EASTER_CLOUD_COVER_BASE_URL,
  easterAlbums,
} = require("../data/easter-library.js");
const { EASTER_ALBUM_METADATA } = require("../data/easter-metadata.js");
const {
  buildEasterAlbumListViews,
  buildEasterCollectionItems,
  filterEasterAlbums,
  getUncollectedEasterAlbumIds,
} = require("../services/easter-library-service.js");
const {
  applyCloudCollectionPayload,
  buildCloudCollectionRequest,
  deleteCollectionsFromCloud,
  fetchMyCloudCollection,
  loginWithCloudIdentity,
  normalizeMeResponse,
  normalizeCloudCollectionPayload,
  saveCollectionsToCloud,
} = require("../services/cloud-api.js");
const {
  SESSION_REQUIRED_TITLE,
  ensureCloudSession,
  isCloudSessionReady,
} = require("../services/cloud-session.js");
const {
  markOnboardingSeen,
  shouldShowNewUserOnboarding,
} = require("../services/onboarding-service.js");
const {
  buildTvLoginConfirmPayload,
  confirmTvLoginWithQr,
  compactTvLoginPayload,
  MAX_TV_COMPACT_TRACKS,
  MAX_TV_LOGIN_TRACKS,
  measureTvLoginPayloadBytes,
  parseTvLoginQr,
} = require("../services/tv-login-service.js");
const {
  bindTvLoginSession,
  unbindTvLoginSession,
} = require("../services/tv-sync-service.js");
const {
  buildCatalogSearchPath,
  catalogCandidateToAlbum,
  fetchTrackPreview,
  normalizeCatalogQuery,
  normalizeCatalogSearchResponse,
  parseSearchQuery,
  searchCatalogAlbums,
} = require("../services/catalog-api.js");
const {
  formatTrackDuration,
  normalizeTrackDisplayList,
} = require("../services/track-display-service.js");
const {
  getPreviewPlayerState,
  playPreviewAudio: startPreviewAudio,
  resetPreviewPlayer,
  subscribePreviewPlayer,
  togglePreviewPlayback,
} = require("../services/preview-player-service.js");
const {
  DAILY_RECOMMENDATION_STORAGE_KEY,
  buildArtistRecommendationQueue,
  buildDailyRecommendationFallback,
  loadDailyRecommendation,
  pickDailyRecommendationCandidate,
  readFastStoredDailyRecommendation,
} = require("../services/daily-recommendation-service.js");
const {
  THEME_STORAGE_KEY,
  applyThemeChrome,
  buildThemeViewData,
  normalizeThemeSetting,
  readStoredThemeSetting,
  writeStoredThemeSetting,
} = require("../services/theme-service.js");
const {
  TV_PACKAGE_FILE_NAME,
  TV_PACKAGE_CLOUD_FILE_ID,
  TV_PACKAGE_PUBLIC_URL,
  downloadAndShareTvApk,
  formatTvApkDownloadError,
} = require("../services/tv-apk-service.js");
const { TV_PACKAGE_BASE64 } = require("../services/tv-package-data.js");

test("bundled TV package matches the verified ZIP artifact", () => {
  const bytes = Buffer.from(TV_PACKAGE_BASE64, "base64");
  const hash = require("node:crypto").createHash("sha256").update(bytes).digest("hex").toUpperCase();

  assert.equal(bytes.length, 337_570);
  assert.equal(hash, "E56B535A31103BD5AA68DCDE72E9BF031B75A87C09160964037E861CAE24A06C");
});

test("TV package uses its bundled ZIP without making a network request", async () => {
  const calls = [];
  const wxApi = {
    env: { USER_DATA_PATH: "wxfile://user" },
    getFileSystemManager() {
      return {
        writeFile(options) {
          calls.push({ type: "write", options });
          options.success({});
        },
      };
    },
    downloadFile() {
      assert.fail("public download must not run for the bundled ZIP");
    },
    shareFileMessage(options) {
      calls.push({ type: "share", options });
      options.success({});
    },
  };

  await downloadAndShareTvApk({}, wxApi);

  assert.equal(calls[0].options.filePath, "wxfile://user/唱片柜-TV.zip");
  assert.equal(calls[0].options.encoding, "base64");
  assert.equal(calls[0].options.data, TV_PACKAGE_BASE64);
  assert.equal(calls[1].options.filePath, "wxfile://user/唱片柜-TV.zip");
});

test("TV package opens file sharing inside the original user tap gesture", async () => {
  let tapGestureActive = true;
  const calls = [];
  const wxApi = {
    env: { USER_DATA_PATH: "wxfile://user" },
    getFileSystemManager() {
      return {
        writeFileSync(filePath, data, encoding) {
          calls.push({ type: "write-sync", filePath, data, encoding });
        },
      };
    },
    shareFileMessage(options) {
      assert.equal(tapGestureActive, true, "shareFileMessage must run before the tap handler returns");
      calls.push({ type: "share", options });
      options.success({});
    },
  };

  const resultPromise = downloadAndShareTvApk({}, wxApi);
  tapGestureActive = false;
  await resultPromise;

  assert.equal(calls[0].type, "write-sync");
  assert.equal(calls[0].filePath, "wxfile://user/唱片柜-TV.zip");
  assert.equal(calls[0].encoding, "base64");
  assert.equal(calls[1].type, "share");
});

test("TV package download prefers WeChat cloud storage and bypasses domain whitelists", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      downloadFile(options) {
        calls.push({ type: "cloud-download", options });
        options.success({ tempFilePath: "wxfile://temp/cloud-tv-zip" });
        return { onProgressUpdate() {} };
      },
    },
    downloadFile() {
      assert.fail("public download must not run when WeChat cloud storage is available");
    },
    shareFileMessage(options) {
      calls.push({ type: "share", options });
      options.success({});
    },
  };

  await downloadAndShareTvApk({}, wxApi);

  assert.equal(calls[0].options.fileID, TV_PACKAGE_CLOUD_FILE_ID);
  assert.equal(calls[0].options.url, undefined);
  assert.equal(calls[1].options.filePath, "wxfile://temp/cloud-tv-zip");
});

test("TV APK download can share a temporary file without requiring the user data directory", async () => {
  const calls = [];
  const wxApi = {
    downloadFile(options) {
      calls.push({ type: "download", options });
      options.success({ statusCode: 200, tempFilePath: "wxfile://temp/tv-apk" });
      return { onProgressUpdate() {} };
    },
    shareFileMessage(options) {
      calls.push({ type: "share", options });
      options.success({});
    },
  };

  await downloadAndShareTvApk({}, wxApi);

  assert.equal(calls[0].options.filePath, undefined);
  assert.equal(calls[1].options.filePath, "wxfile://temp/tv-apk");
  assert.equal(calls[1].options.fileName, TV_PACKAGE_FILE_NAME);
});

test("TV APK download formats domain failures as visible diagnostics", () => {
  const failure = formatTvApkDownloadError({
    errMsg: "downloadFile:fail url not in domain list",
  });

  assert.equal(failure.title, "下载通道未启用");
  assert.match(failure.message, /下载域名/);
  assert.match(failure.detail, /domain list/);
});

test("TV package identifies an expired user tap gesture without blaming the WeChat version", () => {
  const failure = formatTvApkDownloadError({
    errMsg: "shareFileMessage:fail can only be invoked by user TAP gesture.",
  });

  assert.equal(failure.title, "请重新点击按钮");
  assert.match(failure.message, /文件已准备好/);
});

test("TV package download keeps the ZIP suffix and shares it to WeChat", async () => {
  const calls = [];
  const wxApi = {
    env: { USER_DATA_PATH: "wxfile://user" },
    downloadFile(options) {
      calls.push({ type: "download", options });
      options.success({ statusCode: 200, tempFilePath: "wxfile://temp/tv-apk" });
      return { onProgressUpdate() {} };
    },
    shareFileMessage(options) {
      calls.push({ type: "share", options });
      options.success({});
    },
  };

  const result = await downloadAndShareTvApk({}, wxApi);

  assert.equal(calls[0].options.url, TV_PACKAGE_PUBLIC_URL);
  assert.equal(calls[0].options.filePath, undefined);
  assert.equal(calls[1].options.filePath, "wxfile://temp/tv-apk");
  assert.equal(calls[1].options.fileName, TV_PACKAGE_FILE_NAME);
  assert.equal(result.fileName, "唱片柜-TV.zip");
});

test("TV APK download rejects an unavailable installer instead of sharing an error page", async () => {
  const wxApi = {
    env: { USER_DATA_PATH: "wxfile://user" },
    downloadFile(options) {
      options.success({ statusCode: 404, tempFilePath: "wxfile://temp/error" });
      return { onProgressUpdate() {} };
    },
    shareFileMessage() {
      assert.fail("shareFileMessage must not run for a failed APK download");
    },
  };

  await assert.rejects(
    downloadAndShareTvApk({}, wxApi),
    /TV package download failed with status 404/,
  );
});

function createFakePreviewAudio() {
  const handlers = {};
  return {
    handlers,
    playCount: 0,
    pauseCount: 0,
    stopCount: 0,
    destroyCount: 0,
    onPlay(callback) {
      handlers.play = callback;
    },
    onPause(callback) {
      handlers.pause = callback;
    },
    onStop(callback) {
      handlers.stop = callback;
    },
    onEnded(callback) {
      handlers.ended = callback;
    },
    onError(callback) {
      handlers.error = callback;
    },
    play() {
      this.playCount += 1;
      if (handlers.play) handlers.play();
    },
    pause() {
      this.pauseCount += 1;
      if (handlers.pause) handlers.pause();
    },
    stop() {
      this.stopCount += 1;
      if (handlers.stop) handlers.stop();
    },
    destroy() {
      this.destroyCount += 1;
    },
  };
}

function loadMiniProgramAppDefinition(wxApi) {
  const appPath = require.resolve("../app.js");
  const previousApp = global.App;
  const previousWx = global.wx;
  let definition = null;

  delete require.cache[appPath];
  global.App = (config) => {
    definition = config;
  };
  global.wx = wxApi;

  try {
    require(appPath);
  } finally {
    global.App = previousApp;
    global.wx = previousWx;
    delete require.cache[appPath];
  }

  return definition;
}

function createMiniProgramAppInstance(definition) {
  return {
    ...definition,
    globalData: JSON.parse(JSON.stringify(definition.globalData))
  };
}

test("David seed library contains searchable album metadata", () => {
  assert.equal(albums.length, 9);
  assert.ok(albums.every((album) => album.id && album.title && album.artist && album.coverUrl));
  assert.ok(albums.some((album) => album.title === "21" && album.artist === "Adele"));
  assert.ok(albums.some((album) => album.artist === "伍佰 & China Blue"));
});

test("easter library packages the fixed backup collection with cloud-hosted covers", () => {
  assert.equal(easterAlbums.length, 385);
  assert.ok(easterAlbums.every((album) => album.id.startsWith("easter-")));
  assert.ok(EASTER_CLOUD_COVER_BASE_URL.includes("tcloudbaseapp.com/easter/v1/covers"));
  assert.ok(easterAlbums.every((album) => album.coverUrl.startsWith(EASTER_CLOUD_COVER_BASE_URL)));
  assert.ok(easterAlbums.every((album) => album.cover.startsWith(EASTER_CLOUD_COVER_BASE_URL)));
  assert.ok(easterAlbums.some((album) => album.artist.includes("刘德华")));
  assert.ok(easterAlbums.some((album) => (album.tracks || []).length > 0));
  assert.ok(easterAlbums.every((album) => !String(album.region + album.style).includes("?")));
});

test("compact easter metadata index covers the complete backup library", () => {
  assert.equal(Object.keys(EASTER_ALBUM_METADATA).length, easterAlbums.length);
  easterAlbums.forEach((album) => {
    const id = String(album.sourceId || album.id).toLowerCase().replace(/^easter-/, "");
    assert.deepEqual(EASTER_ALBUM_METADATA[id], [album.region, album.style]);
  });
});

test("easter library keeps music genres separate from physical media", () => {
  const mediaLabels = new Set([
    "\u9ed1\u80f6",
    "\u5f69\u80f6",
    "CD",
    "SACD",
    "\u78c1\u5e26",
  ]);
  const styles = new Set(easterAlbums.map((album) => album.style));

  assert.ok(easterAlbums.every((album) => !mediaLabels.has(album.style)));
  assert.ok(styles.size >= 8);
  assert.equal(
    easterAlbums.find((album) => album.sourceId === "E55E796E-890B-482B-A3E9-ADFAF767BACF").style,
    "\u53e4\u5178",
  );
  assert.equal(
    easterAlbums.find((album) => album.sourceId === "3194F893-28B3-436A-BBB0-C1B41FDA4B7C").style,
    "\u7535\u5f71/\u6e38\u620f\u539f\u58f0",
  );
});

test("easter library merges confirmed duplicate artist aliases", () => {
  const artistNames = new Set(easterAlbums.map((album) => album.artist));
  const aliases = [
    "\u4f0d\u4f70 & China Blue",
    "China Blue & \u4f0d\u4f70",
    "\u7af9\u5185\u739b\u5229\u4e9a",
    "Various  Artists",
    "CoCo\u674e\u739f",
    "\u4e2d\u5cf6\u307f\u3086\u304d",
    "\u9f9a\u7433",
    "Morelenbaum\u00b2 & \u5742\u672c\u9f99\u4e00",
    "Royal Philharmonic Orchestra & \u4e45\u77f3\u8ba9",
    "\u7f57\u5927\u4f51 \uff06 \u6625\u9f99\u4ea4\u54cd\u4e50\u56e2",
    "\u88d8\u5fb7 & \u8bb8\u54f2\u73ee",
    "\u5d14\u5065 & \u738b\u8679",
    "\u5f20\u56fd\u8363 & \u67cf\u5b89\u59ae",
    "C\u00e9line Dion & James Horner",
    "BEYOND & \u8881\u51e4\u745b",
    "BEYOND & Hungarian Choir & \u5f71\u89c6\u539f\u58f0 & \u9648\u5149\u8363",
    "\u6f58\u8d8a\u4e91 & \u9f50\u8c6b",
  ];
  const canonicalNames = [
    "\u4f0d\u4f70",
    "\u7af9\u5185\u739b\u8389\u4e9a",
    "Various Artists",
    "\u674e\u739f",
    "\u4e2d\u5c9b\u7f8e\u96ea",
    "\u9f9a\u7433\u5a1c",
    "\u5742\u672c\u9f99\u4e00",
    "\u4e45\u77f3\u8ba9",
    "\u7f57\u5927\u4f51",
    "\u88d8\u5fb7",
    "\u5d14\u5065",
    "\u5f20\u56fd\u8363",
    "C\u00e9line Dion",
    "BEYOND",
    "\u9f50\u8c6b",
  ];

  for (const alias of aliases) {
    assert.equal(artistNames.has(alias), false, `${alias} should be merged`);
  }
  for (const canonical of canonicalNames) {
    assert.equal(artistNames.has(canonical), true, `${canonical} should remain`);
  }
});

test("easter library can search and save selected albums to the current user collection", () => {
  const matches = filterEasterAlbums("刘德华");
  assert.ok(matches.length > 0);

  const album = matches[0];
  const result = buildEasterCollectionItems({
    selectedAlbumIds: [album.id],
    albums: easterAlbums,
    existingCollectionItems: [],
    userId: "user-1",
    now: "2026-07-15T12:00:00.000Z",
  });

  assert.equal(result.createdItems.length, 1);
  assert.equal(result.createdItems[0].albumId, album.id);
  assert.equal(result.createdItems[0].userId, "user-1");
  assert.equal(result.createdItems[0].mediumKey, "vinyl");
  assert.equal(result.collectionItems.length, 1);
});

test("easter library uses corrected quantity-aware investment defaults", () => {
  const result = buildEasterCollectionItems({
    selectedAlbumIds: easterAlbums.map((album) => album.id),
    albums: easterAlbums,
    existingCollectionItems: [],
    userId: "user-easter",
    now: "2026-07-15T12:00:00.000Z",
  });
  const stats = calculateCollectionStats(easterAlbums, result.createdItems);
  const memories = result.createdItems.find((item) =>
    item.albumId === "easter-6adc32ce-a7d1-4057-860d-0698cb2cf547"
  );

  assert.equal(result.createdItems.length, 385);
  assert.equal(stats.totalPrice, 184198);
  assert.equal(memories.price, 9700);
  assert.equal(memories.quantity, 1);
});

test("easter library marks collected albums and skips duplicates", () => {
  const album = easterAlbums[0];
  const existing = [{ id: "collection-existing", albumId: album.id }];
  const views = buildEasterAlbumListViews({
    albums: [album],
    collectionItems: existing,
    selectedIds: [album.id],
  });
  const result = buildEasterCollectionItems({
    selectedAlbumIds: [album.id],
    albums: easterAlbums,
    existingCollectionItems: existing,
    userId: "user-1",
  });

  assert.equal(views[0].collected, true);
  assert.equal(views[0].meta, "已收藏");
  assert.equal(views[0].region, album.region);
  assert.equal(views[0].style, album.style);
  assert.equal(result.createdItems.length, 0);
  assert.equal(result.skippedItems.length, 1);
  assert.equal(getUncollectedEasterAlbumIds([album], existing).length, 0);
});

test("batch search matches album and artist queries from the prototype", () => {
  const parsed = parseBatchInput("Adele - 21\n伍佰 - 白鸽");
  const matched = matchAlbumCandidates(parsed.entries, albums, collectionItems);

  assert.equal(matched[0].selectedAlbumId, "adele21");
  assert.equal(matched[1].selectedAlbumId, "dove");
  assert.equal(matched[0].alreadyCollected, true);
});

test("batch input accepts album-title slash artist lines for manual importing", () => {
  const parsed = parseBatchInput("Memories / 刘德华\n范特西 / 周杰伦");

  assert.deepEqual(parsed.entries.map((entry) => ({
    title: entry.title,
    artist: entry.artist,
    query: entry.query,
  })), [
    { title: "Memories", artist: "刘德华", query: "刘德华 - Memories" },
    { title: "范特西", artist: "周杰伦", query: "周杰伦 - 范特西" },
  ]);
});

test("batch input accepts artist and album in one relaxed line", () => {
  const parsed = parseBatchInput("周杰伦 范特西\n刘德华 Memories");

  assert.deepEqual(parsed.entries.map((entry) => ({
    inputLine: entry.inputLine,
    artist: entry.artist,
    title: entry.title,
    query: entry.query,
  })), [
    {
      inputLine: "周杰伦 范特西",
      artist: "周杰伦",
      title: "范特西",
      query: "周杰伦 - 范特西",
    },
    {
      inputLine: "刘德华 Memories",
      artist: "刘德华",
      title: "Memories",
      query: "刘德华 - Memories",
    },
  ]);
});

test("batch catalog ranking keeps album matches even when artist is not exact", () => {
  const entry = parseBatchInput("伍佰 白鸽").entries[0];
  const ranked = rankBatchCatalogCandidates(entry, [
    {
      id: "netease:wubai-dove",
      title: "白鸽",
      artist: "伍佰 & China Blue",
      year: 1999,
      catalogProvider: "NETEASE",
    },
    {
      id: "itunes:dove-other",
      title: "白鸽",
      artist: "其他艺人",
      year: 2001,
      catalogProvider: "ITUNES",
    },
  ]);

  assert.deepEqual(ranked.map((album) => album.id), [
    "netease:wubai-dove",
    "itunes:dove-other",
  ]);
});

test("batch import creates manual draft albums when no candidate is found", () => {
  const parsed = parseBatchInput("不存在的冷门碟 / 独立艺人");
  const matches = matchAlbumCandidates(parsed.entries, albums, []);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].manualFallback, true);
  assert.equal(matches[0].candidates[0].title, "不存在的冷门碟");
  assert.equal(matches[0].candidates[0].artist, "独立艺人");
  assert.equal(matches[0].candidates[0].manualDraft, true);
  assert.deepEqual(getDefaultSelectedAlbumIds(matches), [matches[0].candidates[0].id]);
});

test("collection stats are calculated from the local David collection", () => {
  const stats = calculateCollectionStats(albums, collectionItems);

  assert.equal(stats.albumCount, 4);
  assert.equal(stats.artistCount, 4);
  assert.equal(stats.trackCount, 20);
  assert.equal(stats.totalPrice, 10463);
});

test("collection stats include quantity in investment totals", () => {
  const stats = calculateCollectionStats([
    { id: "album-a", title: "Album A", artist: "Artist A", year: 2024, tracks: [] },
    { id: "album-b", title: "Album B", artist: "Artist B", year: 2024, tracks: [] },
  ], [
    { albumId: "album-a", price: 600, quantity: 3 },
    { albumId: "album-b", price: 302, quantity: 4 },
  ]);

  assert.equal(stats.totalPrice, 3008);
});

test("collection stats build monthly quantity distribution by year", () => {
  const distribution = buildMonthlyCollectionDistribution(collectionItems, 2025);

  assert.equal(distribution.year, 2025);
  assert.equal(distribution.months.length, 12);
  assert.deepEqual(
    distribution.months.map((item) => item.count),
    [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  );
  assert.equal(distribution.totalCount, 2);
  assert.equal(distribution.availableYears[0], 2025);
});

test("collection stats expose the albums collected in a selected month", () => {
  const entries = buildMonthlyCollectionEntries(collectionItems, albums, 2025, 5);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].albumId, "memories");
  assert.equal(entries[0].mediumLabel, "\u9ed1\u80f6");
  assert.equal(entries[0].quantity, 1);
});

test("archive profile includes collected manual albums from artist ranking links", () => {
  const onlineAlbum = {
    id: "catalog-liu-memories",
    title: "Memories",
    artist: "\u5218\u5fb7\u534e",
    year: 2002,
    region: "CHN",
    style: "\u7ca4\u8bed\u6d41\u884c",
    coverUrl: "https://example.com/memories.jpg",
    tracks: [
      { position: 1, title: "\u7ec3\u4e60" },
    ],
  };
  const profile = buildArchiveProfile({
    seedAlbums: albums,
    manualAlbums: [onlineAlbum],
    collectionItems: [
      {
        id: "collection-liu-memories",
        albumId: "catalog-liu-memories",
        collectionDate: "2026-07-16",
        mediumKey: "vinyl",
        price: 418,
      },
    ],
    profileType: "artist",
    profileTitle: "\u5218\u5fb7\u534e",
  });

  assert.equal(profile.visibleAlbums.length, 1);
  assert.equal(profile.visibleAlbums[0].title, "Memories");
  assert.equal(profile.visibleAlbums[0].artist, "\u5218\u5fb7\u534e");
  assert.equal(profile.visibleAlbums[0].cover, "https://example.com/memories.jpg");
  assert.equal(profile.visibleAlbums[0].tracks[0].title, "\u7ec3\u4e60");
  assert.deepEqual(profile.artistFilters, ["\u5218\u5fb7\u534e"]);
});

test("collection stats build media format share distribution", () => {
  const distribution = buildMediaFormatDistribution(collectionItems);

  assert.equal(distribution.totalCount, 4);
  assert.equal(distribution.formats.length, MEDIA_FORMATS.length);
  assert.equal(distribution.formats.find((item) => item.key === "vinyl").count, 3);
  assert.equal(distribution.formats.find((item) => item.key === "cd").percent, 25);
  assert.equal(distribution.formats.find((item) => item.key === "md").count, 0);
  assert.deepEqual(
    distribution.formats.filter((item) => item.count > 0).map((item) => item.key),
    ["vinyl", "cd"],
  );
});

test("album card rarity levels follow prototype price thresholds", () => {
  assert.equal(getAlbumRarity(230).code, "N");
  assert.equal(getAlbumRarity(650).code, "R");
  assert.equal(getAlbumRarity(1200).code, "SR");
  assert.equal(getAlbumRarity(demoPricesByAlbumId.live).code, "SSR");
  assert.equal(getAlbumRarity(demoPricesByAlbumId.memories).code, "UR");
  assert.equal(getAlbumRarity(demoPricesByAlbumId.live).name, "银钻唱片");
  assert.equal(getAlbumRarityClass(demoPricesByAlbumId.memories), "rarity-ur");
});

test("all collection showcase sorts collected albums by price", () => {
  const sorted = buildCollectedAlbumViews(albums, collectionItems);

  assert.deepEqual(
    sorted.map((album) => album.id),
    ["memories", "request", "adele21", "journey"],
  );
  assert.deepEqual(
    sorted.map((album) => album.rarityCode),
    ["UR", "N", "N", "N"],
  );
  assert.equal(sorted[0].priceLabel, "¥9,700");
  assert.equal(sorted[0].mediumLabel, "黑胶");
});

test("all collection showcase searches only collected albums by scope", () => {
  const sorted = buildCollectedAlbumViews(albums, collectionItems);

  assert.deepEqual(
    filterCollectedAlbumViews(sorted, "伍佰", "artist").map((album) => album.id),
    [],
  );
  assert.deepEqual(
    filterCollectedAlbumViews(sorted, "Adele", "artist").map((album) => album.id),
    ["adele21"],
  );
  assert.deepEqual(
    filterCollectedAlbumViews(sorted, "1987", "year").map((album) => album.id),
    ["request"],
  );
  assert.deepEqual(
    filterCollectedAlbumViews(sorted, "华语", "style").map((album) => album.id),
    ["memories"],
  );
});

test("cabinet album library only shows albums collected by the current user", () => {
  const onlineAlbum = {
    id: "netease:online-wubai",
    title: "成功之路摇滚歌剧原声带",
    artist: "伍佰 & China Blue",
    year: 2024,
    style: "摇滚",
    coverUrl: "https://example.com/wubai.jpg",
  };
  const library = buildCollectedAlbumLibrary([...albums, onlineAlbum], [
    {
      id: "collection-online-wubai",
      albumId: "netease:online-wubai",
      collectionDate: "2026-07-15",
    },
  ]);

  assert.deepEqual(library.map((album) => album.id), ["netease:online-wubai"]);
  assert.equal(library[0].title, "成功之路摇滚歌剧原声带");
});

test("collection edit can resolve online albums and preserve remote cover URLs", () => {
  const onlineAlbum = {
    id: "qqmusic:wubai-rockstar",
    title: "成功之路摇滚歌剧原声带",
    artist: "伍佰 & China Blue",
    year: 2024,
    style: "摇滚",
    coverUrl: "https://example.com/wubai.jpg",
  };

  assert.equal(findAlbumInLibrary("qqmusic:wubai-rockstar", albums, [onlineAlbum]).title, onlineAlbum.title);
  assert.equal(toAlbumImageSrc(onlineAlbum), "https://example.com/wubai.jpg");
});

test("photo wall follows user custom order instead of price ranking", () => {
  const customOrder = ["journey", "request", "memories", "adele21"];
  const wallAlbums = buildPhotoWallAlbums(albums, collectionItems, customOrder);

  assert.equal(wallAlbums.length, 9);
  assert.deepEqual(
    wallAlbums.slice(0, 4).map((album) => album.id),
    ["journey", "request", "memories", "adele21"],
  );
  assert.equal(wallAlbums.filter((album) => album.placeholder).length, 5);
  assert.equal(wallAlbums[0].id, "journey");
  assert.equal(demoPricesByAlbumId.memories > demoPricesByAlbumId.journey, true);
});

test("photo wall supports direct up-wall and down-wall actions", () => {
  const afterDownWall = removeAlbumFromPhotoWall(
    ["journey", "memories", "adele21", "request"],
    "memories",
    albums,
    collectionItems,
  );
  assert.deepEqual(afterDownWall, ["journey", "adele21", "request"]);

  const afterUpWall = addAlbumToPhotoWall(afterDownWall, "memories", albums, collectionItems);
  assert.deepEqual(afterUpWall, ["journey", "adele21", "request", "memories"]);
  assert.deepEqual(
    buildPhotoWallOrder(albums, collectionItems, afterUpWall),
    ["journey", "adele21", "request", "memories"],
  );
});

test("unfavoriting an album removes its collection item and wall presence", () => {
  const result = removeCollectionItem({
    collectionItems,
    albumId: "memories",
  });
  const nextWallOrder = removeAlbumFromPhotoWall(
    ["journey", "memories", "adele21", "request"],
    "memories",
    albums,
    result.collectionItems,
  );

  assert.equal(result.removedItem.albumId, "memories");
  assert.equal(result.collectionItems.some((item) => item.albumId === "memories"), false);
  assert.deepEqual(nextWallOrder, ["journey", "adele21", "request"]);
});

test("batch deleting collected albums removes every selected record and wall presence", () => {
  const result = removeCollectionItems({
    collectionItems,
    albumIds: ["memories", "adele21"],
  });
  const nextWallOrder = removeAlbumFromPhotoWall(
    removeAlbumFromPhotoWall(
      ["journey", "memories", "adele21", "request"],
      "memories",
      albums,
      result.collectionItems,
    ),
    "adele21",
    albums,
    result.collectionItems,
  );

  assert.deepEqual(result.removedItems.map((item) => item.albumId), ["memories", "adele21"]);
  assert.equal(result.collectionItems.some((item) => item.albumId === "memories"), false);
  assert.equal(result.collectionItems.some((item) => item.albumId === "adele21"), false);
  assert.deepEqual(nextWallOrder, ["journey", "request"]);
});

test("collection media formats include all eleven selectable forms", () => {
  assert.deepEqual(
    MEDIA_FORMATS.map((item) => item.label),
    ["黑胶", "CD", "VCD", "DVD", "蓝光", "磁带", "USB", "数字专辑", "LD", "VHS", "MD"],
  );
  assert.equal(MEDIA_FORMATS.find((item) => item.key === "vinyl").color, "#b96d5b");
  assert.equal(getMediaFormat("vhs").label, "VHS");
  assert.equal(getMediaFormat("unknown").label, "黑胶");
});

test("uncollected library albums can be added from detail flow defaults", () => {
  const result = confirmSelectedAlbums({
    selectedAlbumIds: ["live"],
    albums,
    existingCollectionItems: collectionItems,
    defaults: {
      userId: "david",
      collectionDate: "2026-07-12",
      source: "资料库添加",
      quantity: 1,
      condition: "NM",
      mediumKey: "md",
      notes: ""
    },
    pricesByAlbumId: { live: 2200 },
    now: "2026-07-12T00:00:00.000Z"
  });

  assert.equal(result.createdItems.length, 1);
  assert.equal(result.createdItems[0].albumId, "live");
  assert.equal(result.createdItems[0].price, 2200);
  assert.equal(result.createdItems[0].mediumKey, "md");
  assert.equal(result.collectionItems.length, collectionItems.length + 1);
});

test("share service enables official WeChat sharing and returns cabinet defaults", () => {
  let options;
  global.wx = {
    showShareMenu(input) {
      options = input;
    },
  };

  enableFriendShare();
  assert.deepEqual(options, {
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"],
  });
  assert.deepEqual(createShareMessage(), {
    title: "唱片柜",
    path: "/pages/cabinet/index",
  });
  assert.deepEqual(createShareTimeline({
    title: "我的唱片柜",
    path: "/pages/album-detail/index?albumId=album-1",
    imageUrl: "https://example.com/cover.jpg",
  }), {
    title: "我的唱片柜",
    query: "albumId=album-1",
    imageUrl: "https://example.com/cover.jpg",
  });

  delete global.wx;
});

test("cloud session gate blocks collection writes until WeChat identity is ready", () => {
  let toast;
  const wxApi = {
    showToast(input) {
      toast = input;
    },
  };

  assert.equal(isCloudSessionReady({ globalData: { cloud: { ready: false } } }), false);
  assert.equal(ensureCloudSession({ globalData: { cloud: { ready: false } } }, wxApi), false);
  assert.deepEqual(toast, {
    title: SESSION_REQUIRED_TITLE,
    icon: "none",
  });
  assert.equal(ensureCloudSession({ globalData: { cloud: { ready: true } } }, wxApi), true);
});

test("share title follows the current WeChat profile name", () => {
  global.getApp = () => ({
    globalData: {
      userProfile: { name: "唱片朋友" },
    },
  });

  assert.deepEqual(createShareMessage(), {
    title: "唱片朋友的唱片柜",
    path: "/pages/cabinet/index",
  });

  delete global.getApp;
});

test("collection markdown export contains owned album rows", () => {
  const markdown = buildCollectionMarkdown({
    ownerName: "唱片朋友",
    albums,
    collectionItems,
    now: "2026-07-15T10:00:00.000Z",
  });

  assert.match(markdown, /^# 唱片朋友 的唱片柜/m);
  assert.match(markdown, /2\. \*\*Memories\*\* - 刘德华/);
  assert.match(markdown, /价格：¥9,700/);
  assert.match(markdown, /导出时间：2026-07-15/);
  assert.equal(buildMarkdownFileName("2026-07-15T10:00:00.000Z"), "唱片柜收藏-2026-07-15.md");
});

test("TV QR login parser accepts APK session URLs", () => {
  const parsed = parseTvLoginQr("https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/ABCD1234?deviceName=客厅电视");

  assert.equal(parsed.code, "ABCD1234");
  assert.equal(
    parsed.confirmUrl,
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/ABCD1234/confirm",
  );
});

test("TV QR login can create a local binding before remote confirmation succeeds", () => {
  const parsed = parseTvLoginQr("https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/ABCD1234?deviceName=%E5%AE%A2%E5%8E%85%E7%94%B5%E8%A7%86");
  const first = bindTvLoginSession([], "user-1", parsed, "2026-07-15T10:00:00.000Z");
  const second = bindTvLoginSession(first.bindings, "user-1", parsed, "2026-07-15T10:01:00.000Z");

  assert.equal(first.binding.deviceCode, "ABCD1234");
  assert.equal(first.binding.deviceName, "\u5ba2\u5385\u7535\u89c6");
  assert.equal(first.binding.status, "active");
  assert.equal(second.bindings.length, 1);
  assert.equal(second.bindings[0].lastSyncedAt, "2026-07-15T10:01:00.000Z");
});

test("cloud collection request keeps local album and collection semantics", () => {
  const album = albums.find((item) => item.id === "memories");
  const collectionItem = collectionItems.find((item) => item.albumId === "memories");
  const request = buildCloudCollectionRequest(collectionItem, album);

  assert.equal(request.album.id, "memories");
  assert.equal(request.album.year, album.year);
  assert.equal(request.album.coverUrl, album.coverUrl);
  assert.equal(request.collection.collectionDate, collectionItem.collectionDate);
  assert.equal(request.collection.mediumKey, collectionItem.mediumKey);
  assert.equal(request.collection.price, collectionItem.price);
});

test("cloud collection request sanitizes online album fields before saving", () => {
  const request = buildCloudCollectionRequest(
    {
      collectionDate: "2026-07-16",
      source: "s".repeat(100),
      quantity: "2",
      condition: "C".repeat(40),
      mediumKey: "m".repeat(40),
      price: "",
      notes: "n".repeat(2100),
    },
    {
      id: "i".repeat(230),
      title: "t".repeat(210),
      artist: "a".repeat(170),
      year: 2026,
      region: "r".repeat(90),
      style: "g".repeat(90),
      coverUrl: `/${"c".repeat(2100)}`,
      tracks: Array.from({ length: 90 }, (_, index) => ({
        position: index + 1,
        title: "x".repeat(230),
      })),
    },
  );

  assert.equal(request.album.id.length, 191);
  assert.equal(request.album.title.length, 200);
  assert.equal(request.album.artist.length, 160);
  assert.equal(request.album.region.length, 80);
  assert.equal(request.album.style.length, 80);
  assert.equal(request.album.coverUrl.length, 2048);
  assert.equal(request.album.coverUrl.startsWith("/"), false);
  assert.equal(request.album.tracks.length, 80);
  assert.equal(request.album.tracks[0].title.length, 200);
  assert.equal(request.collection.source.length, 80);
  assert.equal(request.collection.condition.length, 32);
  assert.equal(request.collection.mediumKey.length, 32);
  assert.equal(request.collection.price, undefined);
  assert.equal(request.collection.notes.length, 2000);
});

test("cloud collection batch upsert sends selected albums in one request", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      callContainer(options) {
        calls.push(options);
        return Promise.resolve({
          statusCode: 200,
          data: {
            owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
            albums: [],
            collectionItems: [],
          },
        });
      },
    },
  };
  const firstAlbum = albums.find((item) => item.id === "memories");
  const secondAlbum = albums.find((item) => item.id === "adele21");

  const payload = await saveCollectionsToCloud(
    [
      {
        album: firstAlbum,
        collectionItem: {
          albumId: firstAlbum.id,
          collectionDate: "2026-07-16",
          source: "彩蛋库导入",
          quantity: 1,
          condition: "NM",
          mediumKey: "vinyl",
          price: 9700,
          notes: "",
        },
      },
      {
        album: secondAlbum,
        collectionItem: {
          albumId: secondAlbum.id,
          collectionDate: "2026-07-16",
          source: "彩蛋库导入",
          quantity: 1,
          condition: "NM",
          mediumKey: "vinyl",
          price: 230,
          notes: "",
        },
      },
    ],
    { env: "test", service: "express-i2ts" },
    wxApi,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/collections/batch-upsert");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].data.items.length, 2);
  assert.equal(calls[0].data.items[0].album.id, "memories");
  assert.equal(calls[0].data.items[1].album.id, "adele21");
  assert.equal(payload.owner.id, "user-1");
});

test("cloud collection payload can be merged back into local page data", () => {
  const payload = normalizeCloudCollectionPayload({
    owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
    albums: [
      {
        id: "manual-cloud",
        title: "Cloud Album",
        artist: "Cloud Artist",
        year: 2026,
        region: "Japan",
        style: "City Pop",
        coverUrl: "assets/covers/manual.webp",
        tracks: [],
      },
    ],
    collectionItems: [
      {
        id: "collection-1",
        userId: "user-1",
        albumId: "manual-cloud",
        collectionDate: "2026-07-12",
        source: "手动添加",
        quantity: 1,
        condition: "NM",
        mediumKey: "vinyl",
        price: 500,
        notes: "",
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
      },
    ],
  }, albums);

  assert.equal(payload.owner.id, "user-1");
  assert.equal(payload.manualAlbums[0].id, "manual-cloud");
  assert.equal(payload.manualAlbums[0].cover, "/assets/covers/manual.webp");
  assert.equal(payload.collectionItems[0].price, 500);
});

test("cloud collection payload repairs legacy easter album genre metadata", () => {
  const referenceAlbum = easterAlbums.find(
    (album) => album.sourceId === "1AF92540-96EE-4BE7-B482-D3C312DD78E4",
  );
  const payload = normalizeCloudCollectionPayload({
    owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
    albums: [{
      ...referenceAlbum,
      region: "\u672a\u8bb0\u5f55",
      style: "\u9ed1\u80f6",
    }],
    collectionItems: [],
  }, albums);

  assert.equal(payload.manualAlbums[0].region, referenceAlbum.region);
  assert.equal(payload.manualAlbums[0].style, referenceAlbum.style);
});

test("stored cloud collection repairs legacy easter album genre metadata", () => {
  const referenceAlbum = easterAlbums.find(
    (album) => album.sourceId === "ED5E08B3-20CF-4CA1-A18B-E91266A86FC7",
  );
  const definition = loadMiniProgramAppDefinition({});
  const app = createMiniProgramAppInstance(definition);

  app.restoreStoredCloudCollection({
    manualAlbums: [{
      ...referenceAlbum,
      region: "\u672a\u8bb0\u5f55",
      style: "\u9ed1\u80f6",
    }],
    collectionItems: [],
    photoWallOrder: [],
  });

  assert.equal(app.globalData.manualAlbums[0].region, referenceAlbum.region);
  assert.equal(app.globalData.manualAlbums[0].style, referenceAlbum.style);
});

test("cloud collection payload keeps remote cover URLs usable", () => {
  const payload = normalizeCloudCollectionPayload({
    owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
    albums: [
      {
        id: "qqmusic:000I5jJB3blWeN",
        title: "范特西",
        artist: "周杰伦",
        year: 2001,
        region: "CN",
        style: "R&B",
        coverUrl: "https://y.gtimg.cn/music/photo_new/T002R800x800M000000I5jJB3blWeN.jpg",
        tracks: [],
      },
    ],
    collectionItems: [],
  }, albums);

  assert.equal(
    payload.manualAlbums[0].cover,
    "https://y.gtimg.cn/music/photo_new/T002R800x800M000000I5jJB3blWeN.jpg",
  );
});

test("cloud collection payload keeps user overrides for seed albums", () => {
  const seedAlbum = albums[0];
  const unchangedSeedAlbum = albums[1];
  const cloudCover = "cloud://prod.bucket/album-covers/user-1/custom.jpg";
  const payload = normalizeCloudCollectionPayload({
    owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
    albums: [
      unchangedSeedAlbum,
      {
        id: seedAlbum.id,
        title: seedAlbum.title,
        artist: seedAlbum.artist,
        year: seedAlbum.year,
        region: "日本",
        style: "原声音乐",
        coverUrl: cloudCover,
        tracks: [],
      },
    ],
    collectionItems: [],
  }, albums);

  assert.equal(payload.manualAlbums.length, 1);
  assert.equal(payload.manualAlbums[0].id, seedAlbum.id);
  assert.equal(payload.manualAlbums[0].style, "原声音乐");
  assert.equal(payload.manualAlbums[0].cover, cloudCover);
  assert.equal(payload.manualAlbums.some((album) => album.id === unchangedSeedAlbum.id), false);
});

test("cloud collection payload does not overwrite a synced profile with dash placeholders", () => {
  const app = {
    globalData: {
      userId: "",
      userProfile: {
        name: "Alice",
        avatar: "https://example.com/avatar.jpg",
      },
      manualAlbums: [],
      collectionItems: [],
      photoWallOrder: [],
    },
    refreshUserLabel() {},
  };

  applyCloudCollectionPayload(app, {
    owner: { id: "user-1", displayName: "-", avatarUrl: null },
    albums: [],
    collectionItems: [],
  }, albums);

  assert.equal(app.globalData.userId, "user-1");
  assert.equal(app.globalData.userProfile.name, "Alice");
  assert.equal(app.globalData.userProfile.avatar, "https://example.com/avatar.jpg");
});

test("cloud account helper registers users with WeChat profile only", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      callContainer(input) {
        calls.push(input);
        return Promise.resolve({
          data: {
            user: {
              id: "user-1",
              displayName: "Alice",
              avatarUrl: null,
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        });
      },
    },
  };

  const login = await loginWithCloudIdentity({ nickName: "Alice" }, {}, wxApi);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/auth/cloud-login");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].data, { displayName: "Alice" });
  assert.equal(login.user.displayName, "Alice");
  assert.equal(login.user.phoneNumberMasked, undefined);
});

test("cloud account helper omits empty WeChat profile fields", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      callContainer(input) {
        calls.push(input);
        return Promise.resolve({
          data: {
            user: {
              id: "user-1",
              displayName: "唱片柜用户",
              avatarUrl: null,
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        });
      },
    },
  };

  const login = await loginWithCloudIdentity({}, {}, wxApi);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/auth/cloud-login");
  assert.deepEqual(calls[0].data, {});
  assert.equal(login.user.id, "user-1");
});

test("cloud account helper prefers WeChat cloud identity in mini program runtime", async () => {
  const requests = [];
  const calls = [];
  const wxApi = {
    login() {
      throw new Error("wx.login should not be needed when cloud container login works");
    },
    request(options) {
      requests.push(options);
      throw new Error("public login should not be needed when cloud container login works");
    },
    cloud: {
      callContainer(input) {
        calls.push(input);
        return Promise.resolve({
          data: {
            user: {
              id: "user-cloud",
              displayName: "Alice",
              avatarUrl: "https://example.com/avatar.jpg",
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        });
      },
    },
  };

  const login = await loginWithCloudIdentity(
    { nickName: "Alice", avatarUrl: "https://example.com/avatar.jpg" },
    { publicBaseUrl: "https://example.com" },
    wxApi,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/auth/cloud-login");
  assert.deepEqual(calls[0].data, {
    displayName: "Alice",
    avatarUrl: "https://example.com/avatar.jpg",
  });
  assert.equal(requests.length, 0);
  assert.equal(login.user.id, "user-cloud");
});

test("cloud account helper retries transient cloud login failures before public fallback", async () => {
  const requests = [];
  const calls = [];
  const wxApi = {
    login() {
      throw new Error("public login should not be needed after a cloud retry succeeds");
    },
    request(options) {
      requests.push(options);
      throw new Error("public login should not be needed after a cloud retry succeeds");
    },
    cloud: {
      callContainer(input) {
        calls.push(input);
        if (calls.length === 1) {
          return Promise.reject(new Error("transient cold start"));
        }
        return Promise.resolve({
          data: {
            user: {
              id: "user-cloud",
              displayName: "Alice",
              avatarUrl: null,
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        });
      },
    },
  };

  const login = await loginWithCloudIdentity(
    {},
    { publicBaseUrl: "https://example.com", loginRetryDelaysMs: [0] },
    wxApi,
  );

  assert.equal(calls.length, 2);
  assert.equal(requests.length, 0);
  assert.equal(login.user.id, "user-cloud");
});

test("cloud account helper falls back to public auth when container login fails", async () => {
  const requests = [];
  const calls = [];
  const wxApi = {
    login(options) {
      options.success({ code: "wx-login-code" });
    },
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 201,
        data: {
          token: "token-fallback",
          me: {
            user: {
              id: "user-public",
              displayName: "Alice",
              avatarUrl: "https://example.com/avatar.jpg",
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        },
      });
    },
    cloud: {
      callContainer(input) {
        calls.push(input);
        return Promise.reject(new Error("cloud login failed"));
      },
    },
  };

  const login = await loginWithCloudIdentity(
    { nickName: "Alice", avatarUrl: "https://example.com/avatar.jpg" },
    { publicBaseUrl: "https://example.com", loginRetryDelaysMs: [] },
    wxApi,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/auth/cloud-login");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/v1/auth/wechat-login");
  assert.equal(login.token, "token-fallback");
  assert.equal(login.me.user.id, "user-public");
});

test("TV login QR parser accepts the TV APK scan URL and builds confirm URL", () => {
  const parsed = parseTvLoginQr("https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan");

  assert.equal(parsed.code, "AB12CD");
  assert.equal(
    parsed.confirmUrl,
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/AB12CD/confirm",
  );
});

test("TV login confirmation uses the cloud proxy for APK scan URLs", async () => {
  const requests = [];
  const wxApi = {
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 200,
        data: {
          ok: true,
          code: "AB12CD",
          status: "confirmed",
        },
      });
    },
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [],
      collectionItems: collectionItems.slice(0, 1),
    },
  };

  const result = await confirmTvLoginWithQr(
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
    app,
    albums,
    {
      publicBaseUrl: "https://example.com",
      authToken: "token-1",
      forceTvConfirmProxy: true,
    },
    wxApi,
  );

  assert.equal(result.status, "confirmed");
  assert.equal(result.syncedAlbumCount, 1);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://example.com/cloud/vinyl-data/tv-login/session/AB12CD/proxy-confirm",
  );
  assert.equal(requests[0].data.userId, "user-1");
  assert.equal(requests[0].data.albums.length, 1);
});

test("TV login proxy preserves cloud cover ids for the stable API cover route", async () => {
  const requests = [];
  const cloudCover = "cloud://prod.bucket/album-covers/user-1/custom.jpg";
  const httpsCover = "https://cdn.example.com/album-covers/user-1/custom.jpg";
  const wxApi = {
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 200,
        data: { code: "AB12CD", status: "confirmed" },
      });
    },
    cloud: {
      getTempFileURL({ fileList }) {
        assert.deepEqual(fileList, [cloudCover]);
        return Promise.resolve({
          fileList: [{ fileID: cloudCover, tempFileURL: httpsCover, status: 0 }],
        });
      },
    },
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [{
        id: "custom-album",
        title: "Custom Album",
        artist: "Alice",
        coverUrl: cloudCover,
        tracks: [],
      }],
      collectionItems: [{ albumId: "custom-album", quantity: 1 }],
    },
  };

  await confirmTvLoginWithQr(
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
    app,
    albums,
    { publicBaseUrl: "https://example.com", forceTvConfirmProxy: true },
    wxApi,
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].data.albums[0].cover, cloudCover);
});

test("direct TV login confirmation resolves cloud covers to HTTPS", async () => {
  const requests = [];
  const cloudCover = "cloud://prod.bucket/album-covers/user-1/custom.jpg";
  const httpsCover = "https://cdn.example.com/album-covers/user-1/custom.jpg";
  const wxApi = {
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 200,
        data: { code: "AB12CD", status: "confirmed" },
      });
    },
    cloud: {
      getTempFileURL() {
        return Promise.resolve({
          fileList: [{ fileID: cloudCover, tempFileURL: httpsCover, status: 0 }],
        });
      },
    },
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [{
        id: "custom-album",
        title: "Custom Album",
        artist: "Alice",
        coverUrl: cloudCover,
        tracks: [],
      }],
      collectionItems: [{ albumId: "custom-album", quantity: 1 }],
    },
  };

  await confirmTvLoginWithQr(
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
    app,
    albums,
    { forceTvConfirmProxy: false },
    wxApi,
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].data.albums[0].cover, httpsCover);
});

test("TV login confirmation prefers the public proxy even when cloud container is available", async () => {
  const publicRequests = [];
  const containerRequests = [];
  const wxApi = {
    request(options) {
      publicRequests.push(options);
      options.success({
        statusCode: 200,
        data: {
          ok: true,
          code: "AB12CD",
          status: "confirmed",
        },
      });
    },
    cloud: {
      callContainer(options) {
        containerRequests.push(options);
        return Promise.reject(new Error("container should not be first"));
      },
    },
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [],
      collectionItems: collectionItems.slice(0, 1),
    },
  };

  const result = await confirmTvLoginWithQr(
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
    app,
    albums,
    {
      publicBaseUrl: "https://example.com",
      forceTvConfirmProxy: true,
    },
    wxApi,
  );

  assert.equal(result.status, "confirmed");
  assert.equal(publicRequests.length, 1);
  assert.equal(containerRequests.length, 0);
  assert.equal(
    publicRequests[0].url,
    "https://example.com/cloud/vinyl-data/tv-login/session/AB12CD/proxy-confirm",
  );
});

test("TV login confirmation falls back to a compact cloud-container payload when the public domain is blocked", async () => {
  const publicRequests = [];
  const containerRequests = [];
  const wxApi = {
    request(options) {
      publicRequests.push(options);
      options.fail({ errMsg: "request:fail url not in domain list" });
    },
    cloud: {
      callContainer(options) {
        containerRequests.push(options);
        return Promise.resolve({
          statusCode: 200,
          data: {
            ok: true,
            code: "AB12CD",
            status: "confirmed",
          },
        });
      },
    },
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [],
      collectionItems: collectionItems.slice(0, 1),
    },
  };

  const result = await confirmTvLoginWithQr(
    "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
    app,
    albums,
    {
      publicBaseUrl: "https://example.com",
      env: "test",
      service: "express-i2ts",
      forceTvConfirmProxy: true,
    },
    wxApi,
  );

  assert.equal(result.status, "confirmed");
  assert.equal(publicRequests.length, 1);
  assert.equal(containerRequests.length, 1);
  assert.equal(containerRequests[0].data.albums[0].songs.length, albums[0].tracks.length);
  assert.equal(containerRequests[0].data.albums[0].songs[0].title, "Nascence");
  assert.equal(containerRequests[0].data.albums[0].title, "Journey");
  assert.equal(containerRequests[0].data.albums[0].songCount, albums[0].tracks.length);
  assert.equal(containerRequests[0].data.albums[0].style, albums[0].style);
  assert.equal(containerRequests[0].data.albums[0].region, albums[0].region);
});

test("TV login confirm payload carries the current user's collected albums", () => {
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [],
      collectionItems: collectionItems.slice(0, 2),
    },
  };

  const payload = buildTvLoginConfirmPayload(app, albums);

  assert.equal(payload.userId, "user-1");
  assert.equal(payload.userName, "Alice");
  assert.equal(payload.albums.length, 2);
  assert.equal(payload.albums[0].title, "Journey");
  assert.equal(payload.albums[0].cover, "cloud/vinyl-data/cover/E493418C-7D4C-4114-9475-7DD55918D8D6.webp");
  assert.deepEqual(payload.albums[0].songs[0], {
    title: "Nascence",
    artist: "Austin Wintory",
    duration: 0,
    orderNumber: 1,
  });
});

test("TV login repairs legacy media labels stored as easter album genres", () => {
  const referenceAlbum = easterAlbums.find(
    (album) => album.sourceId === "E55E796E-890B-482B-A3E9-ADFAF767BACF",
  );
  const legacyAlbum = {
    ...referenceAlbum,
    region: "\u9690\u85cf\u5e93",
    style: "\u9ed1\u80f6",
  };
  const app = {
    globalData: {
      userId: "user-1",
      userProfile: { name: "Alice" },
      manualAlbums: [legacyAlbum],
      collectionItems: [{
        albumId: legacyAlbum.id,
        collectionDate: "2026-08-17",
        quantity: 1,
      }],
    },
  };

  const payload = buildTvLoginConfirmPayload(app, albums);

  assert.equal(payload.albums[0].style, "\u53e4\u5178");
  assert.equal(payload.albums[0].region, "\u6b27\u7f8e");
});

test("TV login confirm payload keeps large libraries under the cloud proxy limit", () => {
  const collection = buildEasterCollectionItems({
    selectedAlbumIds: easterAlbums.map((album) => album.id),
    albums: easterAlbums,
    userId: "large-user",
    now: "2026-07-19T12:30:00.000Z",
  });
  const app = {
    globalData: {
      userId: "large-user",
      userProfile: { name: "Large User" },
      manualAlbums: easterAlbums,
      collectionItems: collection.collectionItems,
    },
  };

  const payload = buildTvLoginConfirmPayload(app, albums);
  const compactPayload = compactTvLoginPayload(payload);
  const payloadBytes = measureTvLoginPayloadBytes(payload);
  const compactPayloadBytes = measureTvLoginPayloadBytes({
    ...compactPayload,
    confirmUrl: "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/AB12CD/confirm",
    scanUrl: "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/AB12CD/scan",
  });

  assert.equal(payload.albums.length, easterAlbums.length);
  assert.ok(payload.albums.every((album) => album.songs.length <= MAX_TV_LOGIN_TRACKS));
  assert.ok(payload.albums.some((album) => album.songCount > album.songs.length));
  assert.ok(payloadBytes < 512 * 1024);
  assert.equal(compactPayload.albums.length, easterAlbums.length);
  assert.ok(compactPayload.albums.every((album) => album.songs.length <= MAX_TV_COMPACT_TRACKS));
  assert.ok(compactPayload.albums.some((album) => album.songs.length > 0));
  assert.ok(compactPayloadBytes < 384 * 1024);
});

test("TV sync binding can be removed from account state", () => {
  const bound = bindTvLoginSession([], "user-1", {
    code: "AB12CD",
    scanUrl: "https://example.com/cloud/vinyl-data/tv-login/AB12CD/scan",
  }, "2026-07-19T10:00:00.000Z");

  const result = unbindTvLoginSession(bound.bindings, "user-1", "AB12CD", "2026-07-19T10:01:00.000Z");

  assert.deepEqual(result.bindings, []);
  assert.equal(result.event.type, "tv-login-qr-unbound");
  assert.equal(result.event.deviceCode, "AB12CD");
});

test("collection export builds a shareable Markdown inventory", () => {
  const markdown = buildCollectionMarkdown({
    ownerName: "Alice",
    albums,
    collectionItems: collectionItems.slice(0, 2),
    now: new Date(2026, 6, 15, 9, 30),
  });

  assert.ok(markdown.startsWith("# Alice 的唱片柜"));
  assert.ok(markdown.includes("导出时间：2026-07-15 09:30"));
  assert.ok(markdown.includes("共 2 张唱片"));
  assert.ok(markdown.includes("1. **Journey** - Austin Wintory"));
  assert.ok(markdown.includes("2. **Memories** - 刘德华"));
});

test("cloud account helper uses public auth when cloud container is unavailable", async () => {
  const requests = [];
  const wxApi = {
    login(options) {
      options.success({ code: "wx-login-code" });
    },
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 201,
        data: {
          token: "token-public",
          me: {
            user: {
              id: "user-public",
              displayName: "Alice",
              avatarUrl: null,
              createdAt: "2026-07-15T00:00:00.000Z",
              membership: { status: "FREE", isVip: false, expiresAt: null, collectionLimit: 10 },
            },
            stats: { collectionCount: 0 },
          },
        },
      });
    },
  };

  const login = await loginWithCloudIdentity({ nickName: "Alice" }, { publicBaseUrl: "https://example.com" }, wxApi);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/v1/auth/wechat-login");
  assert.equal(login.me.user.id, "user-public");
});

test("cloud collection helpers use public API first when a bearer token is already available", async () => {
  const requests = [];
  const calls = [];
  const wxApi = {
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 200,
        data: {
          owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
          albums: [],
          collectionItems: [],
        },
      });
    },
    cloud: {
      callContainer() {
        calls.push(true);
        return Promise.reject(new Error("cloud header missing"));
      },
    },
  };

  await normalizeCloudCollectionPayload(
    await fetchMyCloudCollection(
      { publicBaseUrl: "https://example.com", authToken: "token-1" },
      wxApi,
    ),
    albums,
  );

  assert.equal(calls.length, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/api/collections/me");
  assert.equal(requests[0].header.Authorization, "Bearer token-1");
});

test("auth state storage keeps the last cloud collection for instant cabinet restore", () => {
  const storage = {};
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };
  const state = {
    token: "token-1",
    me: {
      user: {
        id: "user-1",
        displayName: "Alice",
        avatarUrl: null,
      },
      stats: { collectionCount: 1 },
    },
    userProfile: { name: "Alice", avatar: "" },
    cloudCollection: {
      collectionItems: [collectionItems[0]],
      manualAlbums: [albums[0]],
      photoWallOrder: [collectionItems[0].albumId],
    },
  };

  writeStoredAuthState(state, wxApi, new Date("2026-07-16T10:00:00.000Z"));
  const restored = readStoredAuthState(wxApi);

  assert.equal(restored.cloudCollection.collectionItems.length, 1);
  assert.equal(restored.cloudCollection.collectionItems[0].albumId, collectionItems[0].albumId);
  assert.equal(restored.cloudCollection.manualAlbums[0].id, albums[0].id);
  assert.deepEqual(restored.cloudCollection.photoWallOrder, [collectionItems[0].albumId]);
});

test("cloud collection batch delete sends selected ids in one request", async () => {
  const calls = [];
  const wxApi = {
    cloud: {
      callContainer(options) {
        calls.push(options);
        return Promise.resolve({
          statusCode: 200,
          data: {
            owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
            albums: [],
            collectionItems: [],
          },
        });
      },
    },
  };

  const payload = await deleteCollectionsFromCloud(
    ["collection-1", "collection-2", "collection-1"],
    { env: "test", service: "express-i2ts" },
    wxApi,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/collections/batch-delete");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].data.collectionIds, ["collection-1", "collection-2"]);
  assert.deepEqual(payload.collectionItems, []);
});

test("cloud collection batch delete falls back to parallel legacy deletes", async () => {
  const paths = [];
  const wxApi = {
    cloud: {
      callContainer(options) {
        paths.push(`${options.method || "GET"} ${options.path}`);
        if (options.path === "/api/collections/batch-delete") {
          return Promise.resolve({ statusCode: 404, data: {} });
        }
        return Promise.resolve({
          statusCode: 200,
          data: {
            owner: { id: "user-1", displayName: "Alice", avatarUrl: null },
            albums: [],
            collectionItems: [],
          },
        });
      },
    },
  };

  const payload = await deleteCollectionsFromCloud(
    ["collection-1", "collection-2"],
    { env: "test", service: "express-i2ts" },
    wxApi,
  );

  assert.ok(paths.includes("POST /api/collections/batch-delete"));
  assert.ok(paths.includes("DELETE /api/collections/collection-1"));
  assert.ok(paths.includes("DELETE /api/collections/collection-2"));
  assert.ok(paths.includes("GET /api/collections/me"));
  assert.deepEqual(payload.collectionItems, []);
});

test("account profile display keeps full WeChat profile but truncates the card name", () => {
  const profile = buildWechatProfile(
    {
      nickName: "\u9ed1\u80f6\u6536\u85cf\u540c\u5b66\u5c0f\u9648",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    { name: "\u5531\u7247\u67dc\u7528\u6237", avatar: "" },
  );

  assert.equal(profile.name, "\u9ed1\u80f6\u6536\u85cf\u540c\u5b66\u5c0f\u9648");
  assert.equal(profile.avatar, "https://example.com/avatar.jpg");
  assert.equal(formatProfileDisplayName(profile.name), "\u9ed1\u80f6\u6536\u85cf\u540c...");
  assert.equal(formatProfileDisplayName("\u5468\u6770\u4f26"), "\u5468\u6770\u4f26");
});

test("account profile treats dash nickname placeholders as empty", () => {
  const profile = buildWechatProfile(
    {
      nickName: "-",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    { name: "\u5531\u7247\u67dc\u7528\u6237", avatar: "" },
  );

  assert.equal(cleanProfileNameValue("-"), "");
  assert.equal(profile.name, "\u5531\u7247\u67dc\u7528\u6237");
  assert.equal(profile.avatar, "https://example.com/avatar.jpg");
  assert.equal(hasWechatProfileInfo({ nickName: "-" }), false);
  assert.equal(hasWechatProfileInfo({ nickName: "-", avatarUrl: "https://example.com/avatar.jpg" }), true);
});

test("auth state storage keeps a successful WeChat login across app launches", () => {
  const storage = {};
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };
  const state = {
    token: "token-1",
    me: {
      user: {
        id: "user-1",
        displayName: "Alice",
        avatarUrl: "https://example.com/avatar.jpg",
      },
      stats: { collectionCount: 3 },
    },
    userProfile: {
      name: "Alice",
      avatar: "https://example.com/avatar.jpg",
      bio: "唱片收藏",
    },
  };

  writeStoredAuthState(state, wxApi, new Date("2026-07-16T09:00:00.000Z"));
  const restored = readStoredAuthState(wxApi);

  assert.equal(storage[AUTH_STATE_STORAGE_KEY].savedAt, "2026-07-16T09:00:00.000Z");
  assert.equal(storage.vinylAuthToken, "token-1");
  assert.equal(restored.token, "token-1");
  assert.equal(restored.me.user.id, "user-1");
  assert.equal(restored.userProfile.name, "Alice");
  assert.equal(hasStoredAuthAccount(restored), true);
});

test("cloud collection load uses a stored token before cloud init is ready", async () => {
  const storage = {
    vinylAuthToken: "legacy-token-1"
  };
  const requests = [];
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
    request(options) {
      requests.push(options);
      options.success({
        statusCode: 200,
        data: {
          owner: {
            id: "user-legacy",
            displayName: "Legacy User",
            avatarUrl: "https://example.com/avatar.jpg"
          },
          albums: [albums[0]],
          collectionItems: [{
            ...collectionItems[0],
            id: "collection-legacy",
            userId: "user-legacy",
            albumId: albums[0].id
          }],
          photoWallOrder: [albums[0].id]
        }
      });
    }
  };
  const definition = loadMiniProgramAppDefinition(wxApi);
  const app = createMiniProgramAppInstance(definition);
  const previousWx = global.wx;

  global.wx = wxApi;
  try {
    app.restoreStoredAuthState();
    assert.equal(app.globalData.cloud.ready, false);
    assert.equal(app.globalData.auth.loggedIn, false);

    const payload = await app.loadCloudCollection();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `${app.globalData.cloud.publicBaseUrl}/api/collections/me`);
    assert.equal(requests[0].header.Authorization, "Bearer legacy-token-1");
    assert.equal(payload.collectionItems.length, 1);
    assert.equal(app.globalData.collectionItems.length, 1);
    assert.equal(app.globalData.photoWallOrder[0], albums[0].id);
    assert.equal(app.globalData.auth.loggedIn, true);
    assert.equal(app.globalData.userId, "user-legacy");
  } finally {
    global.wx = previousWx;
  }
});

test("theme settings normalize standard, white, dark, and custom modes", () => {
  assert.deepEqual(normalizeThemeSetting(), {
    mode: "standard",
    customColor: "#fbfaf6",
  });
  assert.deepEqual(normalizeThemeSetting("white"), {
    mode: "white",
    customColor: "#ffffff",
  });
  assert.deepEqual(normalizeThemeSetting({ mode: "dark", customColor: "#ffffff" }), {
    mode: "dark",
    customColor: "#101113",
  });
  assert.deepEqual(normalizeThemeSetting({ mode: "custom", customColor: "#DDEEDD" }), {
    mode: "custom",
    customColor: "#ddeedd",
  });
});

test("theme view data exposes page variables and navigation colors", () => {
  const standard = buildThemeViewData({ mode: "standard" });
  const white = buildThemeViewData({ mode: "white" });
  const dark = buildThemeViewData({ mode: "dark" });
  const custom = buildThemeViewData({ mode: "custom", customColor: "#ddeedd" });

  assert.equal(standard.themeClass, "theme-standard");
  assert.match(standard.themeStyle, /--color-paper:\s*#fbfaf6/);
  assert.equal(standard.navigationBarBackgroundColor, "#fbfaf6");
  assert.equal(standard.navigationBarFrontColor, "#000000");
  assert.match(white.themeStyle, /--color-screen:\s*#ffffff/);
  assert.equal(white.navigationBarBackgroundColor, "#ffffff");
  assert.match(dark.themeStyle, /--color-paper:\s*#101113/);
  assert.match(dark.themeStyle, /--color-ink:\s*#f7f3ea/);
  assert.match(dark.themeStyle, /--theme-card-surface:\s*#171a1a/);
  assert.match(dark.themeStyle, /--theme-input-surface:\s*#171a1a/);
  assert.match(dark.themeStyle, /--theme-primary-button-bg:\s*#b9c89b/);
  assert.match(dark.themeStyle, /--theme-primary-button-text:\s*#101113/);
  assert.match(dark.themeStyle, /--theme-profile-card-bg:\s*#171a1a/);
  assert.match(dark.themeStyle, /--theme-profile-card-text:\s*#f7f3ea/);
  assert.equal(dark.navigationBarBackgroundColor, "#101113");
  assert.equal(dark.navigationBarFrontColor, "#ffffff");
  assert.match(custom.themeStyle, /--color-paper:\s*#ddeedd/);
  assert.match(custom.themeStyle, /--color-screen:\s*#ddeedd/);
  assert.equal(custom.navigationBarBackgroundColor, "#ddeedd");
});

test("theme settings persist and update native navigation colors", () => {
  const storage = {};
  const navCalls = [];
  const bgCalls = [];
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
    setNavigationBarColor(options) {
      navCalls.push(options);
    },
    setBackgroundColor(options) {
      bgCalls.push(options);
    },
  };

  writeStoredThemeSetting({ mode: "custom", customColor: "#eef7f0" }, wxApi);
  const stored = readStoredThemeSetting(wxApi);
  const viewData = buildThemeViewData(stored);
  applyThemeChrome(viewData, wxApi);

  assert.deepEqual(storage[THEME_STORAGE_KEY], {
    mode: "custom",
    customColor: "#eef7f0",
  });
  assert.equal(navCalls.length, 1);
  assert.equal(navCalls[0].backgroundColor, "#eef7f0");
  assert.equal(navCalls[0].frontColor, "#000000");
  assert.deepEqual(bgCalls[0], {
    backgroundColor: "#eef7f0",
    backgroundColorTop: "#eef7f0",
    backgroundColorBottom: "#eef7f0",
  });
});

test("new user onboarding appears only once for a fresh empty account", () => {
  const storage = {};
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };
  const me = {
    user: {
      id: "user-new",
      createdAt: "2026-07-15T04:00:00.000Z",
    },
    stats: { collectionCount: 0 },
  };

  assert.equal(
    shouldShowNewUserOnboarding(me, wxApi, new Date("2026-07-15T05:00:00.000Z")),
    true,
  );
  markOnboardingSeen("user-new", wxApi);
  assert.equal(
    shouldShowNewUserOnboarding(me, wxApi, new Date("2026-07-15T05:00:00.000Z")),
    false,
  );
  assert.equal(
    shouldShowNewUserOnboarding(
      { ...me, user: { ...me.user, id: "user-old", createdAt: "2026-07-13T05:00:00.000Z" } },
      wxApi,
      new Date("2026-07-15T05:00:00.000Z"),
    ),
    false,
  );
  assert.equal(
    shouldShowNewUserOnboarding(
      { ...me, user: { ...me.user, id: "user-collected" }, stats: { collectionCount: 1 } },
      wxApi,
      new Date("2026-07-15T05:00:00.000Z"),
    ),
    false,
  );
});

test("auth response normalization ignores phone details on the client", () => {
  const me = normalizeMeResponse({
    user: {
      id: "user-1",
      displayName: "Alice",
      phoneNumberMasked: "138****8000",
      hasPhoneNumber: true,
    },
  });

  assert.equal(me.user.displayName, "Alice");
  assert.equal(me.user.hasPhoneNumber, undefined);
  assert.equal(me.user.phoneNumberMasked, undefined);
  assert.equal(me.user.phoneCountryCode, undefined);
  assert.equal(me.user.phoneNumber, undefined);
});

test("catalog API candidates become addable local albums", () => {
  const response = normalizeCatalogSearchResponse({
    query: "范特西",
    artist: "周杰伦",
    providers: { enabled: ["NETEASE", "QQMUSIC"], failed: [] },
    data: [
      {
        id: "netease:18915",
        provider: "NETEASE",
        providerId: "18915",
        title: "范特西",
        artist: "周杰伦",
        year: 2001,
        region: "CN",
        style: "专辑",
        coverUrl: "https://p2.music.126.net/fantasy.jpg",
        coverThumbUrl: "https://p2.music.126.net/fantasy-small.jpg",
        tracks: [
          { position: 1, title: "爱在西元前", durationMs: 234253 },
        ],
        score: 100,
      },
    ],
  });

  assert.equal(response.albums[0].id, "netease:18915");
  assert.equal(response.albums[0].title, "范特西");
  assert.equal(response.albums[0].catalogProvider, "NETEASE");
  assert.equal(response.albums[0].catalogProviderId, "18915");
  assert.equal(response.albums[0].cover, "https://p2.music.126.net/fantasy-small.jpg");
  assert.deepEqual(response.albums[0].tracks, [{ position: 1, title: "爱在西元前" }]);
});

test("daily recommendation picks an unowned NetEase album from collected artists", () => {
  const sourceAlbums = [
    { id: "owned-1", title: "浪人情歌", artist: "伍佰 & China Blue" },
    { id: "owned-2", title: "白鸽", artist: "伍佰 & China Blue" },
    { id: "owned-3", title: "Memories", artist: "刘德华" },
  ];
  const ownedItems = [
    { albumId: "owned-1" },
    { albumId: "owned-2" },
    { albumId: "owned-3" },
  ];
  const queue = buildArtistRecommendationQueue(sourceAlbums, ownedItems, new Date(2026, 6, 17));

  assert.ok(queue.includes("伍佰 & China Blue"));

  const recommendation = pickDailyRecommendationCandidate({
    sourceAlbums,
    collectionItems: ownedItems,
    artist: "伍佰 & China Blue",
    candidates: [
      {
        id: "itunes:wubai-live",
        title: "伍佰的 Live",
        artist: "伍佰",
        catalogProvider: "ITUNES",
      },
      {
        id: "netease:owned-dove",
        title: "白鸽",
        artist: "伍佰 & China Blue",
        catalogProvider: "NETEASE",
      },
      {
        id: "netease:lonely-tree",
        title: "树枝孤鸟",
        artist: "伍佰 & China Blue",
        year: 1998,
        cover: "https://p2.music.126.net/tree.jpg",
        catalogProvider: "NETEASE",
        catalogProviderId: "3456",
      },
    ],
    dateKey: "2026-07-17",
  });

  assert.equal(recommendation.title, "树枝孤鸟");
  assert.equal(recommendation.album.catalogProvider, "NETEASE");
  assert.equal(recommendation.providerLabel, "网易云音乐");
  assert.match(recommendation.meta, /伍佰/);
});

test("daily recommendation reuses the same-day cached NetEase pick", async () => {
  const storage = {
    [DAILY_RECOMMENDATION_STORAGE_KEY]: {
      dateKey: "2026-07-17",
      sourceArtist: "周杰伦",
      album: {
        id: "netease:fans",
        title: "范特西",
        artist: "周杰伦",
        catalogProvider: "NETEASE",
        catalogProviderId: "18915",
      },
    },
  };
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };
  let searchCount = 0;

  const result = await loadDailyRecommendation({
    sourceAlbums: [{ id: "owned-jay", title: "七里香", artist: "周杰伦" }],
    collectionItems: [{ albumId: "owned-jay" }],
    wxApi,
    now: new Date(2026, 6, 17, 10),
    searchCatalog() {
      searchCount += 1;
      return Promise.resolve({ albums: [] });
    },
  });

  assert.equal(searchCount, 0);
  assert.equal(result.title, "范特西");
  assert.equal(result.actionLabel, "GO!");
});

test("daily recommendation can reuse a previous cached pick for instant display", () => {
  const storage = {
    [DAILY_RECOMMENDATION_STORAGE_KEY]: {
      dateKey: "2026-07-16",
      sourceArtist: "artist-jay",
      album: {
        id: "netease:fans",
        title: "cached-fans",
        artist: "artist-jay",
        catalogProvider: "NETEASE",
        catalogProviderId: "18915",
      },
    },
  };
  const wxApi = {
    getStorageSync(key) {
      return storage[key];
    },
  };

  const result = readFastStoredDailyRecommendation({
    sourceAlbums: [{ id: "owned-jay", title: "owned-album", artist: "artist-jay" }],
    collectionItems: [{ albumId: "owned-jay" }],
    wxApi,
    now: new Date(2026, 6, 17, 10),
  });

  assert.equal(result.title, "cached-fans");
  assert.equal(result.dateKey, "2026-07-17");
  assert.equal(result.actionLabel, "GO!");
});

test("daily recommendation returns a persistent fallback when collection has no artist seed", async () => {
  const fallback = buildDailyRecommendationFallback("empty");

  assert.equal(fallback.visible, true);
  assert.equal(fallback.action, "add");
  assert.match(fallback.title, /收藏/);

  const result = await loadDailyRecommendation({
    sourceAlbums: [],
    collectionItems: [],
    wxApi: {},
    searchCatalog() {
      throw new Error("should not search without collected artists");
    },
  });

  assert.equal(result.visible, true);
  assert.equal(result.action, "add");
});

test("track display models render structured catalog tracks as text", () => {
  assert.equal(formatTrackDuration(234253), "3:54");
  assert.deepEqual(
    normalizeTrackDisplayList([
      { position: 1, title: "\u767d\u9e3d", durationMs: 234253 },
      { title: "\u7ec3\u4e60" },
      "\u4e00\u8d77\u8d70\u8fc7\u7684\u65e5\u5b50",
      { position: 4, title: "" },
    ]),
    [
      { position: 1, title: "\u767d\u9e3d", durationLabel: "3:54" },
      { position: 2, title: "\u7ec3\u4e60", durationLabel: "" },
      { position: 3, title: "\u4e00\u8d77\u8d70\u8fc7\u7684\u65e5\u5b50", durationLabel: "" },
    ],
  );
});

test("preview player keeps the current试听 track available outside the detail page", () => {
  resetPreviewPlayer();
  let latestState = getPreviewPlayerState();
  let audio;
  const unsubscribe = subscribePreviewPlayer((state) => {
    latestState = state;
  });
  const wxApi = {
    createInnerAudioContext() {
      audio = createFakePreviewAudio();
      return audio;
    },
  };

  const started = startPreviewAudio({
    src: "https://example.com/preview.m4a",
    key: "1:\u767d\u9e3d",
    album: {
      id: "album-wubai-dove",
      title: "\u767d\u9e3d",
      artist: "\u4f0d\u4f70",
      cover: "https://example.com/dove.jpg",
    },
    track: { title: "\u767d\u9e3d" },
  }, wxApi);

  assert.equal(started, true);
  assert.equal(latestState.visible, true);
  assert.equal(latestState.isPlaying, true);
  assert.equal(latestState.albumId, "album-wubai-dove");
  assert.equal(latestState.albumTitle, "\u767d\u9e3d");
  assert.equal(latestState.albumArtist, "\u4f0d\u4f70");
  assert.equal(latestState.trackTitle, "\u767d\u9e3d");

  togglePreviewPlayback();
  assert.equal(getPreviewPlayerState().visible, true);
  assert.equal(getPreviewPlayerState().isPlaying, false);
  assert.equal(audio.pauseCount, 1);

  togglePreviewPlayback();
  assert.equal(getPreviewPlayerState().isPlaying, true);
  assert.equal(audio.playCount, 2);

  audio.handlers.ended();
  assert.equal(getPreviewPlayerState().visible, false);
  assert.equal(getPreviewPlayerState().isPlaying, false);

  unsubscribe();
  resetPreviewPlayer();
});

test("preview player retries one transient audio error before giving up", () => {
  resetPreviewPlayer();
  let audio;
  const wxApi = {
    createInnerAudioContext() {
      audio = createFakePreviewAudio();
      audio.play = function playWithoutAutoEvent() {
        this.playCount += 1;
      };
      return audio;
    },
  };

  const started = startPreviewAudio({
    src: "https://example.com/preview/stream?track=test",
    key: "1:test",
    album: {
      id: "album-test",
      title: "Test",
      artist: "Artist",
      cover: "https://example.com/cover.jpg",
    },
    track: { title: "Test" },
    retryCount: 1,
    retryDelayMs: 0,
  }, wxApi);

  assert.equal(started, true);
  assert.equal(audio.playCount, 1);

  audio.handlers.error();
  assert.equal(audio.playCount, 2);
  assert.match(audio.src, /previewRetry=1/);
  assert.equal(getPreviewPlayerState().visible, true);

  audio.handlers.error();
  assert.equal(getPreviewPlayerState().visible, false);

  resetPreviewPlayer();
});

test("track preview request retries one transient catalog failure", async () => {
  let requestCount = 0;
  const wxApi = {
    request(options) {
      requestCount += 1;
      if (requestCount === 1) {
        options.fail({ errMsg: "request:fail timeout" });
        return;
      }
      options.success({
        statusCode: 200,
        data: {
          ok: true,
          provider: "ITUNES",
          previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
          durationMs: 30000,
          confidence: 0.95,
          matched: {
            title: "白鸽",
            artist: "伍佰"
          }
        }
      });
    }
  };

  const preview = await fetchTrackPreview(
    {
      track: "白鸽",
      artist: "伍佰",
      album: "白鸽",
      country: "CN"
    },
    {
      publicBaseUrl: "https://example.com",
      previewRetryDelayMs: 0
    },
    wxApi
  );

  assert.equal(requestCount, 2);
  assert.equal(preview.ok, true);
  assert.equal(preview.provider, "ITUNES");
  assert.match(preview.streamUrl, /^https:\/\/example\.com\/api\/catalog\/preview\/stream\?/);
});

test("catalog search path preserves artist-title input", () => {
  const encodedArtistTitle = "%E5%91%A8%E6%9D%B0%E4%BC%A6%20-%20%E8%8C%83%E7%89%B9%E8%A5%BF";
  assert.equal(normalizeCatalogQuery(encodedArtistTitle), decodeURIComponent(encodedArtistTitle));
  assert.deepEqual(parseSearchQuery(encodedArtistTitle), {
    query: "周杰伦 - 范特西",
    artist: "周杰伦",
    title: "范特西",
  });

  assert.deepEqual(parseSearchQuery("周杰伦 - 范特西"), {
    query: "周杰伦 - 范特西",
    artist: "周杰伦",
    title: "范特西",
  });
  assert.equal(
    buildCatalogSearchPath({
      q: "范特西",
      artist: "周杰伦",
      limit: 8,
      country: "CN",
      includeUnofficial: true,
    }),
    "/api/catalog/search?q=%E8%8C%83%E7%89%B9%E8%A5%BF&artist=%E5%91%A8%E6%9D%B0%E4%BC%A6&limit=8&country=CN&includeUnofficial=true",
  );
});

test("catalog search can fall back to artist-name results through public request", async () => {
  const requestedUrls = [];
  const wxApi = {
    request(options) {
      requestedUrls.push(options.url);
      const isArtistFallback = options.url.includes("artist=%E5%91%A8%E6%9D%B0%E4%BC%A6");
      options.success({
        statusCode: 200,
        data: {
          query: "周杰伦",
          artist: isArtistFallback ? "周杰伦" : null,
          providers: { enabled: ["QQMUSIC"], failed: [] },
          data: isArtistFallback
            ? [
                {
                  id: "qqmusic:002Neh8l0uciQZ",
                  provider: "QQMUSIC",
                  providerId: "002Neh8l0uciQZ",
                  title: "魔杰座",
                  artist: "周杰伦",
                  coverThumbUrl: "https://y.gtimg.cn/music/photo_new/T002R180x180M000002Neh8l0uciQZ_3.jpg",
                },
              ]
            : [],
        },
      });
    },
  };

  const result = await searchCatalogAlbums("周杰伦", { limit: 8, country: "CN" }, {}, wxApi);

  assert.equal(requestedUrls.length, 2);
  assert.ok(requestedUrls[0].includes("/api/catalog/search?q=%E5%91%A8%E6%9D%B0%E4%BC%A6"));
  assert.ok(requestedUrls[1].includes("artist=%E5%91%A8%E6%9D%B0%E4%BC%A6"));
  assert.equal(result.albums[0].title, "魔杰座");
  assert.equal(result.albums[0].artist, "周杰伦");
});

test("catalog search can force artist-name expansion for full results", async () => {
  const requestedUrls = [];
  const wxApi = {
    request(options) {
      requestedUrls.push(options.url);
      const isArtistExpansion = options.url.includes("artist=%E5%91%A8%E6%9D%B0%E4%BC%A6");
      options.success({
        statusCode: 200,
        data: {
          query: "周杰伦",
          artist: isArtistExpansion ? "周杰伦" : null,
          providers: { enabled: ["QQMUSIC"], failed: [] },
          data: isArtistExpansion
            ? [
                {
                  id: "qqmusic:002Neh8l0uciQZ",
                  provider: "QQMUSIC",
                  providerId: "002Neh8l0uciQZ",
                  title: "魔杰座",
                  artist: "周杰伦",
                  coverThumbUrl: "https://y.gtimg.cn/music/photo_new/T002R180x180M000002Neh8l0uciQZ_3.jpg",
                },
              ]
            : [
                {
                  id: "netease:noise",
                  provider: "NETEASE",
                  providerId: "noise",
                  title: "周杰伦 Type Beat",
                  artist: "Other Artist",
                  coverThumbUrl: "https://p1.music.126.net/noise.jpg",
                },
              ],
        },
      });
    },
  };

  const result = await searchCatalogAlbums(
    "周杰伦",
    { limit: 50, country: "CN", artistFallback: "always" },
    {},
    wxApi,
  );

  assert.equal(requestedUrls.length, 2);
  assert.ok(requestedUrls[1].includes("limit=50"));
  assert.equal(result.albums[0].catalogProviderId, "002Neh8l0uciQZ");
  assert.ok(result.albums.some((album) => album.title === "魔杰座"));
  assert.ok(result.albums.some((album) => album.title === "周杰伦 Type Beat"));
});

test("catalog search starts forced artist expansion without waiting for the first response", async () => {
  const requestedUrls = [];
  const pendingRequests = [];
  const wxApi = {
    request(options) {
      requestedUrls.push(options.url);
      pendingRequests.push(options);
    },
  };

  const resultPromise = searchCatalogAlbums(
    "\u5468\u6770\u4f26",
    { limit: 50, country: "CN", artistFallback: "always" },
    {},
    wxApi,
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(requestedUrls.length, 2);
  pendingRequests[0].success({
    statusCode: 200,
    data: {
      query: "\u5468\u6770\u4f26",
      artist: null,
      providers: { enabled: ["NETEASE"], failed: [] },
      data: [],
    },
  });
  pendingRequests[1].success({
    statusCode: 200,
    data: {
      query: "\u5468\u6770\u4f26",
      artist: "\u5468\u6770\u4f26",
      providers: { enabled: ["NETEASE"], failed: [] },
      data: [
        {
          id: "netease:18915",
          provider: "NETEASE",
          providerId: "18915",
          title: "\u8303\u7279\u897f",
          artist: "\u5468\u6770\u4f26",
        },
      ],
    },
  });

  const result = await resultPromise;
  assert.equal(result.albums[0].title, "\u8303\u7279\u897f");
});

test("catalog detail can enrich a selected search candidate", () => {
  const selected = catalogCandidateToAlbum({
    id: "qqmusic:000I5jJB3blWeN",
    provider: "QQMUSIC",
    providerId: "000I5jJB3blWeN",
    title: "范特西",
    artist: "周杰伦",
    coverThumbUrl: "https://y.gtimg.cn/small.jpg",
  });
  const enriched = catalogCandidateToAlbum({
    id: "qqmusic:000I5jJB3blWeN",
    provider: "QQMUSIC",
    providerId: "000I5jJB3blWeN",
    title: "范特西",
    artist: "周杰伦",
    year: 2001,
    genre: "R&B 节奏布鲁斯",
    coverUrl: "https://y.gtimg.cn/large.jpg",
    tracks: [
      { position: 1, title: "爱在西元前" },
      { position: 2, title: "爸，我回来了" },
    ],
  }, selected);

  assert.equal(enriched.id, selected.id);
  assert.equal(enriched.year, 2001);
  assert.equal(enriched.style, "R&B 节奏布鲁斯");
  assert.equal(enriched.cover, "https://y.gtimg.cn/large.jpg");
  assert.equal(enriched.tracks.length, 2);
});
