function mergeAlbumLibraries(...libraries) {
  const byId = new Map();
  for (const library of libraries) {
    for (const album of library || []) {
      if (album && album.id) {
        byId.set(album.id, album);
      }
    }
  }

  return Array.from(byId.values());
}

function buildCollectedAlbumLibrary(sourceAlbums = [], collectionItems = []) {
  const albumById = new Map((sourceAlbums || []).map((album) => [album.id, album]));
  const seen = new Set();
  return (collectionItems || [])
    .map((item) => {
      if (!item || !item.albumId || seen.has(item.albumId)) {
        return null;
      }
      seen.add(item.albumId);
      return albumById.get(item.albumId) || null;
    })
    .filter(Boolean);
}

function findAlbumInLibrary(albumId, seedAlbums = [], manualAlbums = []) {
  if (!albumId) {
    return null;
  }

  return mergeAlbumLibraries(seedAlbums, manualAlbums).find((album) => album.id === albumId) || null;
}

function toAlbumImageSrc(album = {}) {
  const cover = String(album.cover || album.coverUrl || "");
  if (!cover) {
    return "";
  }
  if (/^(https?:|wxfile:|cloud:|data:)/.test(cover)) {
    return cover;
  }

  return `/${cover.replace(/^\/+/, "")}`;
}

function toAlbumView(album) {
  if (!album) {
    return null;
  }

  return {
    ...album,
    cover: toAlbumImageSrc(album),
    styles: album.style
  };
}

module.exports = {
  buildCollectedAlbumLibrary,
  findAlbumInLibrary,
  mergeAlbumLibraries,
  toAlbumImageSrc,
  toAlbumView
};
