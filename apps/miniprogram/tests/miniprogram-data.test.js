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
