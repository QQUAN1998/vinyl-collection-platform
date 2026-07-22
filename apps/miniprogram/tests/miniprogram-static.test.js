const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function file(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(file(relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(file(relativePath), "utf8");
}

test("mini program registers the prototype pages and required assets", () => {
  const appConfig = readJson("app.json");

  assert.deepEqual(appConfig.pages, [
    "pages/cabinet/index",
    "pages/add/index",
    "pages/all-collection/index",
    "pages/manual-add/index",
    "pages/batch-input/index",
    "pages/search-results/index",
    "pages/batch-confirm/index",
    "pages/album-detail/index",
    "pages/collection-edit/index",
    "pages/user-profile/index",
    "pages/stats/index",
    "pages/archive-profile/index",
    "pages/account/index",
    "pages/tv-download/index",
    "pages/theme-settings/index",
    "pages/user-guide/index",
    "pages/easter-library/index",
  ]);
  assert.ok(!appConfig.pages.includes("pages/home/index"));
  assert.ok(fs.existsSync(file("app.js")), "runtime entry app.js exists");
  assert.ok(!fs.existsSync(file("app.ts")), "stale TypeScript app entry is not present");

  for (const page of appConfig.pages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.ok(fs.existsSync(file(`${page}.${ext}`)), `${page}.${ext} exists`);
    }
    const pageScript = readText(`${page}.js`);
    assert.match(pageScript, /onShareAppMessage/, `${page}.js declares official friend sharing`);
    assert.match(pageScript, /onShareTimeline/, `${page}.js declares official timeline sharing`);
  }

  for (const component of ["album-card", "album-row", "bottom-nav", "form-field", "media-format-selector", "state-view"]) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.ok(fs.existsSync(file(`components/${component}/index.${ext}`)), `${component}.${ext} exists`);
    }
    assert.equal(readJson(`components/${component}/index.json`).component, true);
  }

  const coverFiles = fs.readdirSync(file("assets/covers")).filter((name) => name.endsWith(".webp"));
  assert.ok(coverFiles.length >= 9, "David seed covers are available");

  for (const icon of [
    "records",
    "search",
    "chart",
    "user",
    "add",
    "close",
    "star",
    "star-filled",
    "edit",
    "detail",
    "wall-up",
    "wall-down",
    "import",
    "export",
    "share",
    "scan",
    "tv",
    "theme-palette",
  ]) {
    assert.ok(fs.existsSync(file(`assets/icons/${icon}.svg`)), `${icon}.svg icon exists`);
  }

  for (const icon of ["records-ink", "records-muted", "search-action", "add-action", "star-filled-gold", "detail-white", "tv-action"]) {
    assert.ok(fs.existsSync(file(`assets/icons/${icon}.png`)), `${icon}.png colored icon exists`);
  }

  for (const icon of ["preview-play", "preview-pause"]) {
    assert.ok(fs.existsSync(file(`assets/icons/${icon}.svg`)), `${icon}.svg preview player icon exists`);
  }
  assert.equal(fs.existsSync(file("assets/icons/poster-share-action.png")), false, "share poster icon is no longer packaged");
  assert.equal(fs.existsSync(file("assets/poster/weapp-code.jpg")), false, "share poster mini-program code is no longer packaged");
});

test("official WeChat share menu is wired globally without visible page-wide buttons", () => {
  const appScript = readText("app.js");
  const catalogScript = readText("services/catalog-api.js");
  const cloudScript = readText("services/cloud-api.js");
  const shareScript = readText("services/share.js");
  const cabinetMarkup = readText("pages/cabinet/index.wxml");
  const addMarkup = readText("pages/add/index.wxml");
  const statsMarkup = readText("pages/stats/index.wxml");
  const accountMarkup = readText("pages/account/index.wxml");
  const allCollectionMarkup = readText("pages/all-collection/index.wxml");

  assert.match(appScript, /enableFriendShare\(\)/);
  assert.match(appScript, /initWechatCloud/);
  assert.match(appScript, /loadCloudCollection/);
  assert.match(appScript, /requireWechatAccount/);
  assert.match(appScript, /loginPromise/);
  assert.match(appScript, /restoreStoredAuthState/);
  assert.match(appScript, /promptWechatLoginOnLaunch/);
  assert.match(appScript, /hasLoggedInIdentity/);
  assert.match(appScript, /canAttemptWechatIdentityLogin/);
  assert.match(appScript, /登录唱片柜/);
  assert.match(appScript, /persistAuthState/);
  assert.match(appScript, /restoreTheme/);
  assert.match(appScript, /applyThemeToPage/);
  assert.match(appScript, /setTheme/);
  assert.match(readText("services/theme-service.js"), /setNavigationBarColor/);
  assert.match(appScript, /options\.withProfile === true/);
  assert.doesNotMatch(appScript, /未完成微信授权/);
  assert.match(appScript, /fail:\s*\(\)\s*=>\s*\{[\s\S]*resolve\(\{\}\)/);
  assert.match(appScript, /userId:\s*""/);
  assert.match(appScript, /collectionItems:\s*\[\]/);
  assert.match(appScript, /showCloudSessionRequired/);
  assert.doesNotMatch(appScript, /collectionItems:\s*\[\.\.\.collectionItems\]/);
  assert.doesNotMatch(appScript, /Page\s*=\s*function registerPage/);
  assert.match(cloudScript, /wx\.cloud\.callContainer/);
  assert.match(cloudScript, /X-WX-SERVICE/);
  assert.match(cloudScript, /express-i2ts/);
  assert.match(cloudScript, /\/api\/auth\/cloud-login/);
  assert.match(cloudScript, /\/v1\/auth\/wechat-login/);
  assert.match(cloudScript, /api\.login/);
  assert.match(cloudScript, /Authorization/);
  assert.match(cloudScript, /loginRetryDelaysMs/);
  assert.match(cloudScript, /retryAsync/);
  assert.doesNotMatch(cloudScript, /\/api\/auth\/phone/);
  assert.match(appScript, /loginWithCloudIdentity/);
  assert.doesNotMatch(appScript, /authorizePhoneNumber/);
  assert.match(appScript + catalogScript, /sh\.run\.tcloudbase\.com/);
  assert.match(appScript + cloudScript, /prod-d5gmzcuby62751753/);
  assert.match(shareScript, /wx\.showShareMenu/);
  assert.match(shareScript, /shareAppMessage/);
  assert.match(shareScript, /shareTimeline/);
  assert.match(shareScript, /createShareTimeline/);
  for (const text of ["全部唱片", "catalogSearch", "visibleAlbums", "搜唱片"]) {
    assert.ok(cabinetMarkup.includes(text), `cabinet catalog includes ${text}`);
  }
  for (const text of ["add-fab", "album-tile-cover", "catalog-smart-chips"]) {
    assert.ok(cabinetMarkup.includes(text), `cabinet keeps prototype home structure ${text}`);
  }
  for (const text of ["album-card-modal", "album-modal-card", "rarity-corner", "cardPositionLabel"]) {
    assert.ok(cabinetMarkup.includes(text), `cabinet keeps prototype album card structure ${text}`);
  }
  assert.doesNotMatch(cabinetMarkup + addMarkup + statsMarkup + accountMarkup + allCollectionMarkup, /open-type="share"/);
});

test("cloud hosting packages the latest TV APK inside a ZIP download", () => {
  const apkPath = path.resolve(root, "..", "api", "public", "downloads", "vinyl-cabinet-tv-1.0.66.7.apk");
  const zipPath = path.resolve(root, "..", "api", "public", "downloads", "vinyl-cabinet-tv-1.0.66.7.zip");

  assert.ok(fs.existsSync(apkPath), "versioned TV APK exists in the cloud-hosting public directory");
  assert.ok(fs.statSync(apkPath).size > 300_000, "TV APK contains the complete installer");
  assert.ok(fs.existsSync(zipPath), "versioned TV ZIP exists in the cloud-hosting public directory");
  assert.ok(fs.statSync(zipPath).size > 300_000, "TV ZIP contains the complete installer folder");
});

test("primary mini-program pages keep the prototype interaction structure", () => {
  const appScript = readText("app.js");
  const appStyles = readText("app.wxss");
  const cabinetMarkup = readText("pages/cabinet/index.wxml");
  const cabinetScript = readText("pages/cabinet/index.js");
  const cabinetStyles = readText("pages/cabinet/index.wxss");
  const archiveMarkup = readText("pages/archive-profile/index.wxml");
  const archiveStyles = readText("pages/archive-profile/index.wxss");
  const batchConfirmMarkup = readText("pages/batch-confirm/index.wxml");
  const batchConfirmScript = readText("pages/batch-confirm/index.js");
  const collectionEditMarkup = readText("pages/collection-edit/index.wxml");
  const addMarkup = readText("pages/add/index.wxml");
  const addScript = readText("pages/add/index.js");
  const addStyles = readText("pages/add/index.wxss");
  const catalogScript = readText("services/catalog-api.js");
  const searchResultsMarkup = readText("pages/search-results/index.wxml");
  const searchResultsScript = readText("pages/search-results/index.js");
  const searchResultsStyles = readText("pages/search-results/index.wxss");
  const statsMarkup = readText("pages/stats/index.wxml");
  const detailMarkup = readText("pages/album-detail/index.wxml");
  const detailScript = readText("pages/album-detail/index.js");
  const manualAddMarkup = readText("pages/manual-add/index.wxml");
  const accountMarkup = readText("pages/account/index.wxml");
  const accountStyles = readText("pages/account/index.wxss");
  const statsStyles = readText("pages/stats/index.wxss");
  const allCollectionMarkup = readText("pages/all-collection/index.wxml");
  const allCollectionScript = readText("pages/all-collection/index.js");
  const allCollectionStyles = readText("pages/all-collection/index.wxss");
  const batchInputMarkup = readText("pages/batch-input/index.wxml");
  const bottomNavStyles = readText("components/bottom-nav/index.wxss");
  const userGuideMarkup = readText("pages/user-guide/index.wxml");
  const userGuideScript = readText("pages/user-guide/index.js");
  const themeSettingsMarkup = readText("pages/theme-settings/index.wxml");
  const themeSettingsScript = readText("pages/theme-settings/index.js");
  const themeSettingsStyles = readText("pages/theme-settings/index.wxss");
  const easterLibraryMarkup = readText("pages/easter-library/index.wxml");
  const easterLibraryScript = readText("pages/easter-library/index.js");

  assert.match(appStyles, /\.screen-header\s*\{[^}]*border-bottom:\s*2rpx solid var\(--color-line\)/s);
  assert.match(appStyles, /--color-ink:\s*#1a1a1a/);
  assert.match(appStyles, /--palette-black:\s*#1a1a1a/);
  assert.match(appStyles, /--radius-card:\s*32rpx/);
  assert.match(appStyles, /--radius-panel:\s*32rpx/);
  assert.match(appStyles, /--radius-cover:\s*12rpx/);
  assert.ok(readText("utils/navigation.js").includes("iconSrc"), "bottom navigation exposes concrete SVG image paths");
  assert.doesNotMatch(cabinetMarkup + addMarkup + accountMarkup, /icon-mask/, "mini-program icons render through image tags instead of CSS mask");
  assert.ok(cabinetMarkup.includes("album-tile-title"), "home catalog uses cover-first album tiles");
  assert.ok(cabinetMarkup.includes("catalog-sticky-tools"), "home catalog search tools stay grouped for sticky scrolling");
  assert.match(cabinetStyles, /\.catalog-sticky-tools\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s);
  assert.ok(cabinetMarkup.includes("preview-player-card"), "home page shows the currently playing preview between wall and catalog");
  assert.ok(cabinetMarkup.includes("preview-player-kicker"), "preview player keeps its English label above the card");
  assert.ok(cabinetMarkup.includes("previewPlayer.albumCover"), "preview player card renders the current album cover");
  assert.ok(cabinetMarkup.includes("NOW PLAYING"), "preview player uses the English mini label style");
  assert.ok(cabinetMarkup.includes("正在试听"), "preview player card keeps the Chinese status label");
  assert.ok(cabinetMarkup.includes("DAILY PICK"), "home page keeps a persistent daily recommendation label when no preview is playing");
  assert.ok(cabinetMarkup.includes("今日推荐"), "home page keeps the daily recommendation card between wall and catalog");
  assert.ok(cabinetMarkup.includes("dailyRecommendation"), "home page binds daily recommendation view state");
  assert.ok(cabinetMarkup.includes("wx:else"), "daily recommendation renders as the alternate state to now playing");
  assert.ok(cabinetMarkup.includes("preview-play.svg"), "preview player uses the provided play icon");
  assert.ok(cabinetMarkup.includes("preview-pause.svg"), "preview player uses the provided pause icon");
  assert.ok(cabinetMarkup.includes("togglePreviewPlayer"), "preview player card can pause or resume playback");
  assert.ok(cabinetScript.includes("subscribePreviewPlayer"), "home page subscribes to the shared preview player");
  assert.ok(cabinetScript.includes("openPreviewPlayerDetail"), "home preview card opens the current album detail page");
  assert.ok(cabinetScript.includes("loadDailyRecommendation"), "home page loads a cached daily recommendation from NetEase search");
  assert.ok(cabinetScript.includes("openDailyRecommendation"), "home daily recommendation can open the detail flow");
  const openDailyRecommendationSource = cabinetScript.match(/openDailyRecommendation\(\) \{[\s\S]*?\n  \},\n  handleCatalogSearch/)[0];
  assert.ok(openDailyRecommendationSource.includes("recommendationAlbums"), "daily recommendation keeps a temporary detail-only album library");
  assert.ok(openDailyRecommendationSource.includes("/pages/album-detail/index?albumId="), "daily recommendation opens album detail instead of add confirmation");
  assert.ok(openDailyRecommendationSource.includes("fetchCatalogAlbumDetail"), "home daily recommendation hydrates the selected catalog album before detail viewing");
  assert.doesNotMatch(openDailyRecommendationSource, /importDraft|batch-confirm/, "daily recommendation must not prefill the add-to-collection confirmation flow");
  assert.match(cabinetStyles, /\.preview-player-card\s*\{[^}]*grid-template-columns:\s*92rpx minmax\(0,\s*1fr\) 68rpx/s);
  assert.match(cabinetStyles, /\.preview-player-card\s*\{[^}]*background:\s*var\(--theme-card-surface\)/s);
  assert.match(cabinetStyles, /\.preview-player-section\s*\{[^}]*margin:\s*16rpx 0 52rpx/s);
  assert.match(cabinetStyles, /\.preview-player-toggle-icon\s*\{[^}]*width:\s*68rpx[^}]*height:\s*68rpx/s);
  assert.match(cabinetStyles, /\.daily-recommend-action\s*\{[^}]*min-width:\s*84rpx/s);
  assert.match(cabinetStyles, /\.search-box\s*\{[^}]*background:\s*var\(--theme-input-surface\)/s);
  assert.match(cabinetStyles, /\.album-modal-card\s*\{[^}]*--album-modal-ink:\s*#1a1a1a/s);
  assert.match(cabinetStyles, /\.album-modal-card\s*\{[^}]*--album-modal-muted:\s*#686a63/s);
  assert.match(cabinetStyles, /\.modal-title\s*\{[^}]*color:\s*var\(--album-modal-ink\)/s);
  assert.match(cabinetStyles, /\.modal-subtitle\s*\{[^}]*color:\s*var\(--album-modal-muted\)/s);
  assert.match(cabinetStyles, /\.modal-track\s*\{[^}]*color:\s*var\(--album-modal-muted\)/s);
  assert.ok(cabinetMarkup.includes("modal-delete-entry"), "album card shows a direct delete entry for collected albums");
  assert.ok(cabinetMarkup.includes("delete-action.svg"), "album card delete entry uses the provided delete icon");
  assert.ok(cabinetScript.includes("handleCardDeleteAction"), "album card delete entry opens the delete confirmation flow");
  assert.ok(cabinetScript.includes("wx.showModal"), "album card delete flow confirms before deleting");
  assert.ok(cabinetMarkup.includes("wall-down-muted"), "album card wall action uses downloaded wall icons");
  assert.ok(cabinetMarkup.includes("modal-edit-action"), "album card keeps a direct edit action");
  assert.ok(cabinetMarkup.includes("modal-wall-action"), "album card can move albums up or down the photo wall");
  assert.ok(cabinetMarkup.includes('<scroll-view scroll-y class="modal-track-scroll"'), "album card tracks use native mini-program scrolling");
  for (const markup of [cabinetMarkup, allCollectionMarkup, archiveMarkup, detailMarkup]) {
    assert.ok(markup.includes("{{item.title}}"), "track rows render the track title instead of the raw object");
    assert.doesNotMatch(markup, /wx:for="\{\{[^"]*tracks[^"]*\}\}"[\s\S]{0,240}\{\{item\}\}/i);
  }
  assert.ok(cabinetScript.includes("openAlbumCard"), "home album tap opens the prototype-style card");
  assert.ok(cabinetScript.includes("moveAlbumCard"), "home album card supports previous and next navigation");
  assert.ok(cabinetScript.includes("handleWallAction"), "home album card wires direct wall actions");
  assert.ok(cabinetScript.includes("photoWallOrder"), "home photo wall follows user custom order");
  assert.ok(cabinetScript.includes("getAlbumRarity"), "home album card uses shared rarity levels");
  assert.doesNotMatch(cabinetScript, /b\.price - a\.price/, "photo wall does not sort albums by amount");
  assert.match(cabinetStyles, /ssr-card-glow/);
  assert.match(cabinetStyles, /ur-card-glow/);
  assert.match(cabinetStyles, /rarity-shine/);
  for (const token of ["--palette-green-soft", "--palette-yellow-soft", "--palette-red", "--palette-black"]) {
    assert.ok(appStyles.includes(token), `global app palette exposes ${token}`);
  }
  for (const token of ["--theme-nav-surface", "--theme-panel-tint", "--theme-nav-hover"]) {
    assert.ok(appStyles.includes(token), `global app theme exposes ${token}`);
  }
  assert.match(statsStyles, /\.stat-card:nth-child\(3\)\s*\{[^}]*var\(--palette-black\)/s);
  assert.match(statsStyles, /\.rank-row\.medal-1\s*\{[^}]*var\(--palette-red\)|\.rank-row\.medal-1[\s\S]*var\(--palette-red\)/);
  assert.match(statsStyles, /\.month-card-high\s*\{[^}]*var\(--palette-red\)/s);
  assert.doesNotMatch(statsStyles, /\.month-card-high\s*\{[^}]*var\(--palette-red-strong\)/s);
  assert.match(statsStyles, /\.month-card\s*\{[^}]*background:\s*var\(--color-soft\)/s);
  assert.match(statsStyles, /\.rank-list\s*\{[^}]*background:\s*var\(--theme-card-surface\)/s);
  assert.match(statsStyles, /\.rank-row\s*\{[^}]*background:\s*var\(--theme-card-surface\)/s);
  assert.match(statsStyles, /\.rank-row\.medal-2[\s\S]*var\(--color-mustard\)/);
  assert.match(statsStyles, /\.rank-row\.medal-3[\s\S]*var\(--color-action\)/);
  assert.ok(
    archiveMarkup.includes('<view class="album-tile-cover">'),
    "archive grid uses a stable square cover wrapper",
  );
  assert.match(archiveStyles, /\.album-tile-cover image\s*\{[^}]*height:\s*100%/s);
  for (const markup of [batchConfirmMarkup, collectionEditMarkup, detailMarkup, manualAddMarkup]) {
    assert.ok(markup.includes("media-format-selector"), "add/edit flow includes media format selector");
  }
  assert.ok(collectionEditMarkup.includes("confirmDeleteCollection"), "collection edit page can delete a collection item");
  assert.ok(readText("pages/collection-edit/index.js").includes("deleteCollectionFromCloud"), "collection edit delete flow syncs to cloud");
  assert.ok(readText("pages/collection-edit/index.js").includes("wx.showModal"), "collection edit delete flow confirms before deleting");
  assert.ok(archiveMarkup.includes("mediumLabel"), "archive preview displays the selected media format");
  assert.ok(addMarkup.includes("screen-header"), "add page uses the shared header architecture");
  assert.ok(addMarkup.includes(">ADD<"), "add page includes a right-side header badge");
  assert.doesNotMatch(addMarkup, /recent-search|recentSearches|useRecent/, "add page no longer keeps recent-search records");
  assert.ok(addMarkup.includes("search-action.png"), "add page search uses downloaded icon");
  assert.ok(addMarkup.includes("查看全部在线结果"), "add page exposes a full online results entry");
  assert.ok(addScript.includes("searchCatalogAlbums"), "add page search fetches online catalog results directly");
  assert.ok(addScript.includes("pages/search-results/index?query="), "add page search action opens the full results page");
  assert.ok(addMarkup.includes("在线资料"), "add page tells users search results come from the online catalog");
  assert.ok(searchResultsScript.includes("searchCatalogAlbums"), "search results page uses the cloud catalog search API");
  assert.match(addStyles, /\.notice\s*\{[^}]*background:\s*var\(--theme-panel-tint\)/s);
  assert.match(searchResultsStyles, /\.load-more-button\s*\{[^}]*background:\s*var\(--theme-input-surface\)/s);
  assert.ok(searchResultsScript.includes("INITIAL_CATALOG_LIMIT = 20"), "search results page starts with a scannable first result set");
  assert.ok(searchResultsScript.includes("MAX_CATALOG_LIMIT = 300"), "search results page can progressively expand the online catalog result set");
  assert.ok(searchResultsScript.includes("loadMoreResults"), "search results page can load more online catalog results");
  assert.ok(searchResultsScript.includes("onReachBottom"), "search results page keeps loading when users scroll to the bottom");
  assert.ok(searchResultsScript.includes('artistFallback: "always"'), "search results page merges artist-name matches");
  assert.ok(searchResultsScript.includes("fetchCatalogAlbumDetail"), "search results page hydrates selected catalog albums before confirming");
  assert.ok(searchResultsMarkup.includes("load-more-panel"), "search results page exposes a visible load-more control");
  assert.ok(searchResultsMarkup.includes("loadingMore"), "search results page shows incremental loading state");
  assert.ok(searchResultsMarkup.includes("正在搜索在线资料"), "search results page shows a remote catalog loading state");
  assert.ok(batchConfirmScript.includes("draft.candidates"), "batch confirm can add online catalog candidates");
  assert.ok(addMarkup.includes("批量输入"), "add page keeps batch input action");
  assert.ok(addMarkup.includes("手动新建"), "add page keeps manual add action");
  assert.ok(addMarkup.includes("all-collection-card"), "add page includes the all collection card");
  assert.ok(addMarkup.includes("goAllCollection"), "add page can open all collection page");
  assert.ok(
    addMarkup.indexOf("资料库没有？") < addMarkup.indexOf("最近加入")
      && addMarkup.indexOf("最近加入") < addMarkup.indexOf("all-collection-card"),
    "add page swaps the manual-create notice above recent albums and all-collection card below them",
  );
  assert.doesNotMatch(addMarkup, /扫码|搜索方式/, "add page does not drift back to scan/method list UI");
  assert.ok(allCollectionMarkup.includes("全部唱片"), "all collection page keeps a clear title");
  assert.ok(allCollectionMarkup.includes("按唱片价格排序"), "all collection page explains the price sort");
  assert.ok(allCollectionMarkup.includes("collection-summary-grid"), "all collection page shows basic collection data");
  assert.ok(allCollectionMarkup.includes("collection-search-tools"), "all collection page supports searching shared collected albums");
  assert.ok(allCollectionMarkup.includes("搜唱片 / 艺人 / 风格 / 年份"), "all collection search matches the cabinet search scope wording");
  assert.ok(allCollectionMarkup.includes("collection-scope-chip"), "all collection page exposes search scopes");
  assert.ok(allCollectionMarkup.includes("all-album-row"), "all collection page renders the collected album list");
  assert.ok(allCollectionMarkup.includes("batch-delete-bar"), "all collection page exposes a batch delete action bar for owners");
  assert.ok(allCollectionMarkup.includes("confirmBatchDelete"), "all collection page can confirm batch deletion");
  assert.ok(allCollectionMarkup.includes("toggleSelectAllVisible"), "all collection page can select all visible albums for batch deletion");
  assert.ok(allCollectionMarkup.includes("全选"), "all collection batch delete exposes a select-all action");
  assert.ok(allCollectionMarkup.includes("canManageCollection && collectedAlbums.length"), "all collection batch delete tools are hidden from shared visitors");
  assert.ok(allCollectionMarkup.includes("album-card-modal"), "all collection page opens the album card modal");
  assert.doesNotMatch(allCollectionMarkup, /搜索要添加|catalogSearch/, "all collection search does not drift into add/catalog search UI");
  for (const text of ["buildCollectedAlbumViews", "filterCollectedAlbumViews", "loadSharedCloudCollection", "ownerId", "canManageCollection", "toggleBatchDeleteMode", "toggleSelectAllVisible", "allVisibleSelected", "confirmBatchDelete", "syncBatchDeleteToCloud", "handleAlbumRowTap", "handleQuery", "selectSearchScope", "openAlbumCard", "moveAlbumCard", "onShareAppMessage", "onShareTimeline"]) {
    assert.ok(allCollectionScript.includes(text), `all collection page includes ${text}`);
  }
  assert.ok(appScript.includes("deleteCollectionsFromCloud"), "app supports cloud batch deletion");
  assert.ok(readText("services/cloud-api.js").includes("/api/collections/batch-delete"), "cloud API supports server-side batch deletion");
  assert.doesNotMatch(allCollectionScript, /showLoading\(\{\s*title:\s*["']删除中/s, "batch delete no longer blocks on a loading modal");
  assert.match(allCollectionScript, /!this\.data\.canManageCollection/);
  assert.match(allCollectionScript, /canManageCollection:\s*!ownerId/);
  assert.match(allCollectionScript, /pages\/all-collection\/index\?ownerId=/);
  assert.match(cabinetScript, /saveCollectionToCloud/);
  assert.match(cabinetScript, /deleteCollectionFromCloud/);
  assert.ok(allCollectionStyles.includes('@import "../cabinet/index.wxss";'), "all collection page reuses the prototype album card animations");
  assert.match(allCollectionStyles, /\.owner-panel\s*\{[^}]*background:\s*var\(--palette-black\)/s);
  assert.ok(batchInputMarkup.includes(">BATCH<"), "batch input page uses a shared English header badge");
  assert.doesNotMatch(batchInputMarkup, /<view>\s*<view class="screen-title">批量输入<\/view>\s*<view class="caption">/, "batch input header does not stack subtitle under the title");
  assert.doesNotMatch(batchInputMarkup, /lineCount|\{\{lineCount\}\}|行<\/view>/, "batch input page removes the top line-count badge");
  assert.ok(batchInputMarkup.indexOf("<form-field") < batchInputMarkup.indexOf("batch-helper"), "batch input helper copy sits below the input field");
  assert.ok(detailMarkup.includes("detail-cover"), "detail page keeps large cover layout");
  assert.ok(detailMarkup.includes("加入收藏"), "detail page can add an uncollected album");
  assert.ok(detailMarkup.includes("track-preview-button"), "detail page exposes a compact track preview button");
  assert.ok(detailScript.includes("fetchTrackPreview"), "detail page requests track preview URLs on demand");
  assert.ok(detailScript.includes("preview-player-service"), "detail page writes track playback into the shared preview player");
  assert.ok(readText("services/preview-player-service.js").includes("createInnerAudioContext"), "preview player service plays previews through the native mini-program audio context");
  assert.ok(catalogScript.includes("/api/catalog/preview"), "catalog API exposes the track preview endpoint");
  assert.ok(catalogScript.includes("buildTrackPreviewStreamUrl"), "catalog API plays previews through the cloud-hosted stream URL");
  for (const text of ["month-grid", "handleYearChange", "openMonthDetail", "month-drawer", "format-stack", "visibleMediaFormats"]) {
    assert.ok(statsMarkup.includes(text), `stats page includes collection distribution UI ${text}`);
  }
  const statsScript = readText("pages/stats/index.js");
  assert.doesNotMatch(
    statsMarkup,
    /分享海报|openPoster|savePoster|sharePosterImage|previewPoster|statsPosterCanvas|poster-share-action\.png/,
    "stats page no longer renders the share poster entry or modal",
  );
  assert.doesNotMatch(
    statsScript,
    /POSTER_|wx\.createCanvasContext|wx\.canvasToTempFilePath|wx\.saveImageToPhotosAlbum|wx\.showShareImageMenu|drawStatsPoster|buildTopValueAlbums/,
    "stats page no longer carries the poster canvas generation flow",
  );
  assert.doesNotMatch(statsStyles, /poster-section|poster-panel|poster-generate|poster-icon-button|poster-modal|poster-canvas/, "stats page does not keep poster styles");
  assert.doesNotMatch(statsMarkup, /all-albums-entry|查看完整收藏清单/, "stats page removes the all-albums shortcut card");
  assert.doesNotMatch(statsStyles, /all-albums-entry|all-albums-title/, "stats page removes all-albums shortcut styles");
  assert.ok(statsMarkup.indexOf("rank-section") < statsMarkup.indexOf("format-section"), "stats rank section appears above format share");
  assert.ok(statsMarkup.includes(">收藏排行<"), "stats rank title is simplified");
  assert.ok(accountMarkup.includes("screen-header"), "account page uses the shared header architecture");
  assert.ok(readText("pages/account/index.js").includes('userLabel: "SETTINGS"'), "account page uses SETTINGS as the right-side header badge");
  assert.ok(accountMarkup.includes("profile-edit-card"), "account page keeps profile-card architecture");
  assert.ok(accountMarkup.includes('bindtap="handleProfileCardTap"'), "account card is the primary login/profile entry");
  assert.ok(accountMarkup.includes('open-type="chooseAvatar"'), "account card can sync the WeChat avatar inline");
  assert.ok(accountMarkup.includes('type="nickname"'), "account card can sync the WeChat nickname inline");
  assert.ok(accountMarkup.includes("saveWechatProfileDraft"), "account card saves WeChat profile data");
  assert.match(accountStyles, /\.profile-sync-card\s*\{[^}]*grid-template-columns:\s*108rpx minmax\(0,\s*1fr\)/s);
  assert.match(accountStyles, /\.profile-sync-card \.profile-card-copy\s*\{[^}]*min-width:\s*0/s);
  assert.match(accountStyles, /\.profile-sync-card \.profile-action-button\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(accountStyles, /\.profile-card\s*\{[^}]*background:\s*var\(--theme-profile-card-bg\)/s);
  assert.match(accountStyles, /\.profile-user-title\s*\{[^}]*color:\s*var\(--theme-profile-card-text\)/s);
  assert.match(accountStyles, /\.profile-collection-summary\s*\{[^}]*color:\s*var\(--theme-profile-card-muted\)/s);
  assert.doesNotMatch(accountMarkup, /auth-action-button/, "account authorization section no longer owns the login action");
  assert.doesNotMatch(accountMarkup, /账号与授权|account-auth-section/, "account page keeps account authorization status out of the foreground UI");
  assert.ok(accountMarkup.includes("displayProfileName"), "account card uses the short WeChat display name");
  assert.ok(accountMarkup.includes("首次登录引导"), "account page has a first-login onboarding guide");
  assert.ok(accountMarkup.includes("startOnboardingGuide"), "account onboarding can start the guided flow");
  assert.doesNotMatch(accountMarkup, /open-type="getPhoneNumber"|handlePhoneNumber|手机号/, "account page no longer asks for phone authorization");
  assert.ok(readText("pages/account/index.js").includes("handleLogin"), "account page can connect the WeChat cloud account");
  assert.ok(readText("app.js").includes("syncWechatProfile"), "app can persist WeChat profile data after login");
  assert.ok(readText("app.js").includes("wx.cloud.uploadFile"), "app uploads chosen avatars before saving profile data");
  assert.ok(readText("pages/user-profile/index.wxml").includes('open-type="chooseAvatar"'), "profile page uses WeChat avatar authorization control");
  assert.ok(readText("pages/user-profile/index.wxml").includes('type="nickname"'), "profile page uses WeChat nickname input");
  assert.ok(readText("pages/account/index.js").includes("requireWechatAccount"), "account page requests WeChat login only when users need account features");
  assert.ok(readText("pages/account/index.js").includes("formatProfileDisplayName"), "account page truncates long WeChat names");
  assert.ok(readText("pages/account/index.js").includes("shouldShowNewUserOnboarding"), "account page only shows onboarding to new first-login users");
  assert.doesNotMatch(readText("pages/account/index.js"), /phoneNumberMasked|phoneLoading|canAuthorizePhone/, "account page keeps registration to WeChat account only");
  assert.ok(accountMarkup.includes("平台服务"), "account page keeps service section");
  assert.ok(accountMarkup.includes("电视版 APK"), "account page links to the TV APK service");
  assert.ok(accountMarkup.includes("openTvDownload"), "account page opens the TV APK download page");
  assert.ok(accountMarkup.includes("tv-action.png"), "account device row uses the downloaded TV icon");
  assert.ok(accountMarkup.includes("scanTvLogin"), "account page can scan and bind the TV app login QR code");
  assert.ok(accountMarkup.includes("openBatchImport"), "account import row opens batch album import");
  assert.ok(accountMarkup.includes("exportCollectionMarkdown"), "account export row writes and shares a Markdown collection file");
  assert.ok(accountMarkup.includes("小程序操作手册"), "account page links to the operation manual");
  assert.ok(accountMarkup.includes("不会使用看这里"), "account operation manual helper copy is clear");
  assert.ok(accountMarkup.includes("openUserGuide"), "account page opens the operation manual page");
  assert.ok(accountMarkup.includes("主题设置"), "account page links to theme settings");
  assert.ok(accountMarkup.includes("openThemeSettings"), "account page opens the theme settings page");
  assert.ok(accountMarkup.includes("theme-palette.svg"), "account theme settings row uses the provided palette icon");
  assert.doesNotMatch(accountStyles, /\.theme-tool-icon\s*\{[^}]*background:\s*var\(--color-soft\)/s, "theme palette row uses the same icon background as neighboring rows");
  assert.ok(readText("pages/account/index.js").includes("themeSummary"), "account page shows the current theme name");
  const tvDownloadMarkup = readText("pages/tv-download/index.wxml");
  const tvDownloadScript = readText("pages/tv-download/index.js");
  assert.ok(tvDownloadMarkup.includes("安装指引"), "TV APK page includes installation guidance");
  assert.ok(tvDownloadMarkup.includes("下载并分享 ZIP"), "TV APK page exposes the ZIP download action");
  assert.ok(tvDownloadMarkup.includes("解压"), "TV APK page explains how to unpack the installer folder");
  assert.ok(tvDownloadMarkup.includes(".apk(1)"), "TV APK page warns about invalid duplicate suffixes");
  assert.ok(tvDownloadMarkup.includes("整个“唱片柜-TV”文件夹"), "TV APK page explains the reliable USB folder flow");
  assert.ok(tvDownloadMarkup.includes("扫码同步"), "TV APK page explains collection synchronization");
  assert.ok(tvDownloadScript.includes("downloadAndShareTvApk"), "TV APK page downloads and shares the installer");
  assert.ok(tvDownloadScript.includes("wx.showModal"), "TV APK failures remain visible after the loading state closes");
  assert.ok(tvDownloadMarkup.includes("downloadError"), "TV APK page keeps an inline failure status for diagnosis");
  assert.ok(themeSettingsMarkup.includes("显示模式"), "theme settings page exposes preset theme modes");
  assert.ok(themeSettingsMarkup.includes("自定义底色"), "theme settings page exposes custom background color");
  assert.ok(themeSettingsMarkup.includes("customSwatches"), "theme settings page exposes custom color swatches");
  assert.ok(themeSettingsMarkup.includes("theme-status-row"), "theme settings page follows the shared compact status-row style");
  assert.ok(themeSettingsMarkup.includes("theme-palette.svg"), "theme settings page uses the provided palette icon");
  assert.ok(themeSettingsScript.includes("app.setTheme"), "theme settings page persists theme changes");
  assert.ok(themeSettingsScript.includes("normalizeHexColor"), "theme settings page validates custom hex colors");
  assert.match(themeSettingsStyles, /\.theme-option-desc\s*\{[^}]*font-size:\s*23rpx/s);
  assert.match(themeSettingsStyles, /\.theme-option-desc\s*\{[^}]*line-height:\s*1\.35/s);
  assert.doesNotMatch(themeSettingsMarkup, /<view class="row-meta">\{\{item\.description\}\}/, "theme option descriptions do not fall back to the default large font");
  for (const text of [
    "小程序操作手册",
    "首次收藏流程",
    "今日推荐",
    "试听播放",
    "编辑收藏",
    "照片墙",
    "删除唱片",
    "统计与排行",
    "主题设置",
    "账号与同步",
    "导入导出",
    "更多收藏",
    "微信分享"
  ]) {
    assert.ok((userGuideMarkup + userGuideScript).includes(text), `operation manual documents ${text}`);
  }
  assert.ok(userGuideScript.includes("单价 × 数量"), "operation manual documents quantity-aware investment totals");
  assert.ok(userGuideScript.includes("GO!"), "operation manual documents the daily recommendation action");
  assert.ok(userGuideScript.includes("0816"), "operation manual documents the More collection password");
  assert.ok(userGuideMarkup.includes("搜索刘德华"), "operation manual can launch the Liu Dehua onboarding search");
  assert.ok(userGuideScript.includes("ONBOARDING_STEPS"), "operation manual reuses the first-login onboarding flow");
  assert.ok(userGuideMarkup.includes("guide-more-card"), "operation manual exposes the More easter-library entry");
  assert.ok(userGuideScript.includes("openEasterLibrary"), "operation manual opens the easter library page");
  assert.ok(easterLibraryScript.includes("EASTER_PASSWORD = \"0816\""), "easter library is protected by the requested password");
  assert.ok(easterLibraryMarkup.includes("password-panel"), "easter library keeps the collection hidden before password entry");
  assert.ok(easterLibraryMarkup.includes("一键收藏全部"), "easter library can save the full fixed library");
  assert.ok(easterLibraryScript.includes("buildEasterCollectionItems"), "easter library saves selected albums into the user's collection");
  assert.ok(easterLibraryScript.includes("requireCloudAccount(app)"), "easter library completes WeChat login before saving albums");
  assert.ok(easterLibraryScript.includes("saveCollectionsToCloud"), "easter library can save many selected albums through one cloud batch request");
  assert.ok(readText("components/album-row/index.wxml").includes('lazy-load="{{true}}"'), "album rows lazy-load cover images in long lists");
  assert.ok(
    !readJson("project.config.json").packOptions.include.some((item) => item.value === "assets/covers/easter"),
    "easter cover assets are served from cloud hosting instead of the mini-program package",
  );
  for (const iconFile of ["import-action.png", "export-action.png", "share-action.png"]) {
    assert.ok(accountMarkup.includes(iconFile), `account service row uses ${iconFile}`);
  }
  assert.match(bottomNavStyles, /\.bottom-nav-icon\s*\{[^}]*width:\s*38rpx[^}]*height:\s*38rpx/s);
  assert.match(bottomNavStyles, /\.bottom-nav-label\s*\{[^}]*font-size:\s*23rpx/s);
  assert.match(statsStyles, /\.rank-list\s*\{[^}]*border:\s*1rpx solid var\(--color-line\)/s);
  assert.match(statsStyles, /\.rank-row\s*\{[^}]*border-bottom:\s*1rpx solid var\(--color-line\)/s);
  assert.match(readText("pages/add/index.wxss"), /\.all-collection-card\s*\{[^}]*border-radius:\s*var\(--radius-card\)[^}]*background:\s*var\(--palette-black\)/s);
  assert.match(readText("pages/add/index.wxss"), /\.add-screen\s*\{[^}]*gap:\s*32rpx/s);
  assert.doesNotMatch(readText("pages/add/index.wxss"), /recent-search-list|recent-search-chip/);
  for (const styles of [
    cabinetStyles,
    archiveStyles,
    allCollectionStyles,
    readText("components/album-row/index.wxss"),
    readText("components/album-card/index.wxss"),
    readText("pages/album-detail/index.wxss"),
  ]) {
    assert.ok(styles.includes("var(--radius-cover)"), "album photo frames keep the original cover radius");
  }
  assert.doesNotMatch(
    appStyles + cabinetStyles + statsScript,
    /#171814|#111410/,
    "visible black UI tokens use 90% black",
  );
});
