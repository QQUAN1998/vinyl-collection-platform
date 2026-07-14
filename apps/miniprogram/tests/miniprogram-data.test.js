const assert = require("node:assert/strict");
const test = require("node:test");

const { albums, collectionItems, demoPricesByAlbumId } = require("../data/seed.js");
const { confirmSelectedAlbums, removeCollectionItem } = require("../services/collection-service.js");
const { parseBatchInput, matchAlbumCandidates } = require("../services/import-service.js");
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
  buildMediaFormatDistribution,
  buildMonthlyCollectionEntries,
  buildMonthlyCollectionDistribution,
  calculateCollectionStats
} = require("../services/stats-service.js");
const { createShareMessage, enableFriendShare } = require("../services/share.js");
const {
  buildCloudCollectionRequest,
  normalizeCloudCollectionPayload,
} = require("../services/cloud-api.js");
const {
  buildCatalogSearchPath,
  catalogCandidateToAlbum,
  normalizeCatalogQuery,
  normalizeCatalogSearchResponse,
  parseSearchQuery,
  searchCatalogAlbums,
} = require("../services/catalog-api.js");

test("David seed library contains searchable album metadata", () => {
  assert.equal(albums.length, 9);
  assert.ok(albums.every((album) => album.id && album.title && album.artist && album.coverUrl));
  assert.ok(albums.some((album) => album.title === "21" && album.artist === "Adele"));
  assert.ok(albums.some((album) => album.artist === "伍佰 & China Blue"));
});

test("batch search matches album and artist queries from the prototype", () => {
  const parsed = parseBatchInput("Adele - 21\n伍佰 - 白鸽");
  const matched = matchAlbumCandidates(parsed.entries, albums, collectionItems);

  assert.equal(matched[0].selectedAlbumId, "adele21");
  assert.equal(matched[1].selectedAlbumId, "dove");
  assert.equal(matched[0].alreadyCollected, true);
});

test("collection stats are calculated from the local David collection", () => {
  const stats = calculateCollectionStats(albums, collectionItems);

  assert.equal(stats.albumCount, 4);
  assert.equal(stats.artistCount, 4);
  assert.equal(stats.trackCount, 20);
  assert.equal(stats.totalPrice, 10463);
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

test("share service enables official friend sharing and returns cabinet defaults", () => {
  let options;
  global.wx = {
    showShareMenu(input) {
      options = input;
    },
  };

  enableFriendShare();
  assert.deepEqual(options, {
    withShareTicket: true,
    menus: ["shareAppMessage"],
  });
  assert.deepEqual(createShareMessage(), {
    title: "David的唱片柜",
    path: "/pages/cabinet/index",
  });

  delete global.wx;
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
  assert.ok(result.albums.some((album) => album.title === "魔杰座"));
  assert.ok(result.albums.some((album) => album.title === "周杰伦 Type Beat"));
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
