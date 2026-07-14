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
    "pages/user-guide/index",
  ]);
  assert.ok(!appConfig.pages.includes("pages/home/index"));
  assert.ok(fs.existsSync(file("app.js")), "runtime entry app.js exists");
  assert.ok(!fs.existsSync(file("app.ts")), "stale TypeScript app entry is not present");

  for (const page of appConfig.pages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assert.ok(fs.existsSync(file(`${page}.${ext}`)), `${page}.${ext} exists`);
    }
    assert.match(
      readText(`${page}.js`),
      /onShareAppMessage/,
      `${page}.js declares official friend sharing`,
    );
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
  ]) {
    assert.ok(fs.existsSync(file(`assets/icons/${icon}.svg`)), `${icon}.svg icon exists`);
  }

  for (const icon of ["records-ink", "records-muted", "search-action", "add-action", "star-filled-gold", "detail-white", "tv-action", "poster-share-action"]) {
    assert.ok(fs.existsSync(file(`assets/icons/${icon}.png`)), `${icon}.png colored icon exists`);
  }
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
  assert.match(appScript, /userId:\s*""/);
  assert.match(appScript, /collectionItems:\s*\[\]/);
  assert.match(appScript, /showCloudSessionRequired/);
  assert.doesNotMatch(appScript, /collectionItems:\s*\[\.\.\.collectionItems\]/);
  assert.doesNotMatch(appScript, /Page\s*=\s*function registerPage/);
  assert.match(cloudScript, /wx\.cloud\.callContainer/);
  assert.match(cloudScript, /X-WX-SERVICE/);
  assert.match(cloudScript, /express-i2ts/);
  assert.match(appScript + catalogScript, /sh\.run\.tcloudbase\.com/);
  assert.match(appScript + cloudScript, /prod-d5gmzcuby62751753/);
  assert.match(shareScript, /wx\.showShareMenu/);
  assert.match(shareScript, /shareAppMessage/);
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

test("primary mini-program pages keep the prototype interaction structure", () => {
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
  const searchResultsMarkup = readText("pages/search-results/index.wxml");
  const searchResultsScript = readText("pages/search-results/index.js");
  const statsMarkup = readText("pages/stats/index.wxml");
  const detailMarkup = readText("pages/album-detail/index.wxml");
  const manualAddMarkup = readText("pages/manual-add/index.wxml");
  const accountMarkup = readText("pages/account/index.wxml");
  const statsStyles = readText("pages/stats/index.wxss");
  const allCollectionMarkup = readText("pages/all-collection/index.wxml");
  const allCollectionScript = readText("pages/all-collection/index.js");
  const allCollectionStyles = readText("pages/all-collection/index.wxss");
  const batchInputMarkup = readText("pages/batch-input/index.wxml");
  const bottomNavStyles = readText("components/bottom-nav/index.wxss");
  const userGuideMarkup = readText("pages/user-guide/index.wxml");
  const userGuideScript = readText("pages/user-guide/index.js");

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
  assert.ok(cabinetMarkup.includes("modal-favorite-star"), "album card shows favorite state as a corner star");
  assert.ok(cabinetMarkup.includes("star-filled-gold"), "album card favorite state uses the downloaded star icon");
  assert.ok(cabinetMarkup.includes("wall-down-muted"), "album card wall action uses downloaded wall icons");
  assert.ok(cabinetMarkup.includes("modal-edit-action"), "album card keeps a direct edit action");
  assert.ok(cabinetMarkup.includes("modal-wall-action"), "album card can move albums up or down the photo wall");
  assert.ok(cabinetMarkup.includes('<scroll-view scroll-y class="modal-track-scroll"'), "album card tracks use native mini-program scrolling");
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
  assert.match(statsStyles, /\.stat-card:nth-child\(3\)\s*\{[^}]*var\(--palette-black\)/s);
  assert.match(statsStyles, /\.rank-row\.medal-1\s*\{[^}]*var\(--palette-red\)|\.rank-row\.medal-1[\s\S]*var\(--palette-red\)/);
  assert.match(statsStyles, /\.month-card-high\s*\{[^}]*var\(--palette-red\)/s);
  assert.doesNotMatch(statsStyles, /\.month-card-high\s*\{[^}]*var\(--palette-red-strong\)/s);
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
  assert.ok(allCollectionMarkup.includes("album-card-modal"), "all collection page opens the album card modal");
  assert.doesNotMatch(allCollectionMarkup, /搜索要添加|catalogSearch/, "all collection search does not drift into add/catalog search UI");
  for (const text of ["buildCollectedAlbumViews", "filterCollectedAlbumViews", "loadSharedCloudCollection", "ownerId", "handleQuery", "selectSearchScope", "openAlbumCard", "moveAlbumCard", "onShareAppMessage"]) {
    assert.ok(allCollectionScript.includes(text), `all collection page includes ${text}`);
  }
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
  for (const text of ["month-grid", "handleYearChange", "openMonthDetail", "month-drawer", "format-stack", "visibleMediaFormats"]) {
    assert.ok(statsMarkup.includes(text), `stats page includes collection distribution UI ${text}`);
  }
  for (const text of ["分享海报", "openPoster", "savePoster", "sharePosterImage", "previewPoster", "statsPosterCanvas", "poster-share-action.png"]) {
    assert.ok(statsMarkup.includes(text), `stats page includes poster UI ${text}`);
  }
  for (const text of ["wx.createCanvasContext", "wx.canvasToTempFilePath", "wx.saveImageToPhotosAlbum", "wx.showShareImageMenu", "drawStatsPoster", "buildTopValueAlbums"]) {
    assert.ok(readText("pages/stats/index.js").includes(text), `stats poster flow includes ${text}`);
  }
  const statsScript = readText("pages/stats/index.js");
  assert.ok(statsScript.includes("const POSTER_HEIGHT = 1500"), "stats poster is long enough for the polished report layout");
  assert.ok(statsScript.includes("来自唱片柜小程序"), "stats poster footer uses the product name");
  assert.ok(statsScript.includes("520, 1300, 132, 132"), "stats poster reserves a larger QR area");
  assert.doesNotMatch(statsScript, /基于当前收藏生成|来自微信小程序/, "stats poster removes prototype filler copy");
  assert.ok(statsMarkup.indexOf("screen-title") < statsMarkup.indexOf("poster-icon-button"), "stats poster icon sits next to the title");
  assert.doesNotMatch(statsStyles, /poster-section|poster-panel|poster-generate/, "stats page does not use a poster entry card");
  assert.doesNotMatch(statsMarkup, /all-albums-entry|查看完整收藏清单/, "stats page removes the all-albums shortcut card");
  assert.doesNotMatch(statsStyles, /all-albums-entry|all-albums-title/, "stats page removes all-albums shortcut styles");
  assert.ok(statsMarkup.indexOf("rank-section") < statsMarkup.indexOf("format-section"), "stats rank section appears above format share");
  assert.ok(statsMarkup.includes(">收藏排行<"), "stats rank title is simplified");
  assert.ok(accountMarkup.includes("screen-header"), "account page uses the shared header architecture");
  assert.ok(readText("pages/account/index.js").includes('userLabel: "SETTINGS"'), "account page uses SETTINGS as the right-side header badge");
  assert.ok(accountMarkup.includes("profile-edit-card"), "account page keeps profile-card architecture");
  assert.ok(accountMarkup.includes("平台服务"), "account page keeps service section");
  assert.ok(accountMarkup.includes("tv-action.png"), "account device row uses the downloaded TV icon");
  assert.ok(accountMarkup.includes("小程序操作手册"), "account page links to the operation manual");
  assert.ok(accountMarkup.includes("不会使用看这里"), "account operation manual helper copy is clear");
  assert.ok(accountMarkup.includes("openUserGuide"), "account page opens the operation manual page");
  for (const text of ["小程序操作手册", "首页", "添加唱片", "收藏统计", "我的设置", "微信分享"]) {
    assert.ok((userGuideMarkup + userGuideScript).includes(text), `operation manual documents ${text}`);
  }
  for (const iconFile of ["import-action.png", "export-action.png", "share-action.png"]) {
    assert.ok(accountMarkup.includes(iconFile), `account service row uses ${iconFile}`);
  }
  assert.match(bottomNavStyles, /\.bottom-nav-icon\s*\{[^}]*width:\s*38rpx[^}]*height:\s*38rpx/s);
  assert.match(bottomNavStyles, /\.bottom-nav-label\s*\{[^}]*font-size:\s*23rpx/s);
  assert.match(statsStyles, /\.rank-list\s*\{[^}]*border:\s*1rpx solid rgba\(216,\s*213,\s*204,\s*0\.95\)/s);
  assert.match(statsStyles, /\.rank-row\s*\{[^}]*border-bottom:\s*1rpx solid rgba\(216,\s*213,\s*204,\s*0\.9\)/s);
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
