const {
  easterAlbums,
  getEasterCollectionDefaults
} = require("../data/easter-library.js");
const { coverToImageSrc } = require("./catalog-api.js");

function cleanEasterText(value, fallback) {
  const text = String(value || "").trim();
  if (!text || /^\?+$/.test(text)) {
    return fallback;
  }
  return text;
}

function toEasterAlbum(album = {}) {
  const region = cleanEasterText(album.region, "隐藏库");
  const style = cleanEasterText(album.style, "黑胶");
  const coverUrl = String(album.coverUrl || album.cover || "").replace(/^\/+/, "");
  return {
    ...album,
    region,
    style,
    coverUrl,
    cover: coverToImageSrc(coverUrl)
  };
}

function getSearchText(album) {
  return [
    album.title,
    album.artist,
    album.year,
    album.region,
    album.style
  ].join(" ").toLowerCase();
}

function filterEasterAlbums(query, albums = easterAlbums) {
  const keyword = String(query || "").trim().toLowerCase();
  if (!keyword) {
    return albums.map(toEasterAlbum);
  }

  return albums.map(toEasterAlbum).filter((album) => getSearchText(album).includes(keyword));
}

function getCollectedEasterAlbumIds(collectionItems = []) {
  return new Set((collectionItems || []).map((item) => item.albumId));
}

function getUncollectedEasterAlbumIds(albums = easterAlbums, collectionItems = []) {
  const collected = getCollectedEasterAlbumIds(collectionItems);
  return albums
    .map(toEasterAlbum)
    .filter((album) => album && album.id && !collected.has(album.id))
    .map((album) => album.id);
}

function buildEasterAlbumListViews(input = {}) {
  const {
    albums = easterAlbums,
    collectionItems = [],
    selectedIds = []
  } = input;
  const selected = new Set(selectedIds);
  const collected = getCollectedEasterAlbumIds(collectionItems);

  return albums.map(toEasterAlbum).map((album) => {
    const isCollected = collected.has(album.id);
    return {
      id: album.id,
      title: album.title,
      artist: album.artist,
      year: album.year,
      region: album.region,
      style: album.style,
      styles: album.style,
      cover: album.cover,
      coverUrl: album.coverUrl,
      meta: isCollected ? "已收藏" : `${(album.tracks || []).length} 首曲目`,
      selected: selected.has(album.id),
      collected: isCollected
    };
  });
}

function buildEasterCollectionItems(input = {}) {
  const {
    selectedAlbumIds = [],
    albums = easterAlbums,
    existingCollectionItems = [],
    userId = "",
    now = new Date().toISOString()
  } = input;
  const albumsById = new Map((albums || []).map(toEasterAlbum).map((album) => [album.id, album]));
  const existingByAlbumId = new Map((existingCollectionItems || []).map((item) => [item.albumId, item]));
  const createdItems = [];
  const skippedItems = [];

  for (const albumId of selectedAlbumIds) {
    if (!albumsById.has(albumId)) {
      throw new Error(`Album ${albumId} does not exist.`);
    }
    if (existingByAlbumId.has(albumId)) {
      skippedItems.push(existingByAlbumId.get(albumId));
      continue;
    }

    const defaults = getEasterCollectionDefaults(albumId);
    createdItems.push({
      id: `collection-${albumId}`,
      userId,
      albumId,
      collectionDate: defaults.collectionDate || now.slice(0, 10),
      source: defaults.source || "彩蛋库导入",
      quantity: Number(defaults.quantity || 1),
      condition: defaults.condition || "NM",
      mediumKey: defaults.mediumKey || "vinyl",
      price: Number(defaults.price || 0),
      notes: defaults.notes || "",
      createdAt: now,
      updatedAt: now
    });
  }

  return {
    collectionItems: [...existingCollectionItems, ...createdItems],
    createdItems,
    skippedItems
  };
}

module.exports = {
  buildEasterAlbumListViews,
  buildEasterCollectionItems,
  filterEasterAlbums,
  getCollectedEasterAlbumIds,
  getUncollectedEasterAlbumIds,
  toEasterAlbum
};
