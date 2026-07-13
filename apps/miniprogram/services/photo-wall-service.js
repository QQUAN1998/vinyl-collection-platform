function uniqueExistingIds(ids, albumById) {
  const seen = new Set();
  return (ids || []).filter((id) => {
    if (!id || seen.has(id) || !albumById.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function buildPhotoWallOrder(albums, collectionItems, customOrder = [], limit = 9) {
  const albumById = new Map((albums || []).map((album) => [album.id, album]));
  const collectedIds = (collectionItems || [])
    .map((item) => item.albumId)
    .filter((albumId) => albumById.has(albumId));
  return uniqueExistingIds(customOrder, albumById)
    .filter((albumId) => collectedIds.includes(albumId))
    .slice(0, limit);
}

function buildPhotoWallAlbums(albums, collectionItems, customOrder = [], toAlbumView = (album) => album, limit = 9) {
  const albumById = new Map((albums || []).map((album) => [album.id, album]));
  const wallAlbums = buildPhotoWallOrder(albums, collectionItems, customOrder, limit)
    .map((albumId) => albumById.get(albumId))
    .filter(Boolean)
    .map((album) => ({
      ...toAlbumView(album),
      placeholder: false
    }));

  while (wallAlbums.length < limit) {
    const index = wallAlbums.length;
    wallAlbums.push({
      id: `photo-wall-placeholder-${index + 1}`,
      placeholder: true,
      slotIndex: index
    });
  }

  return wallAlbums;
}

function addAlbumToPhotoWall(customOrder = [], albumId, albums = [], collectionItems = [], limit = 9) {
  const albumById = new Map((albums || []).map((album) => [album.id, album]));
  const collectedAlbumIds = new Set((collectionItems || []).map((item) => item.albumId));
  const currentOrder = buildPhotoWallOrder(albums, collectionItems, customOrder, limit);

  if (!albumId || !albumById.has(albumId) || !collectedAlbumIds.has(albumId)) {
    return currentOrder;
  }

  if (currentOrder.includes(albumId)) {
    return currentOrder;
  }

  if (currentOrder.length >= limit) {
    return currentOrder;
  }

  return [...currentOrder, albumId].slice(0, limit);
}

function removeAlbumFromPhotoWall(customOrder = [], albumId, albums = [], collectionItems = [], limit = 9) {
  return buildPhotoWallOrder(albums, collectionItems, customOrder, limit).filter((id) => id !== albumId);
}

module.exports = {
  addAlbumToPhotoWall,
  buildPhotoWallAlbums,
  buildPhotoWallOrder,
  removeAlbumFromPhotoWall
};
