function confirmSelectedAlbums(input) {
  const {
    selectedAlbumIds,
    albums,
    existingCollectionItems,
    defaults,
    pricesByAlbumId = {},
    now = new Date().toISOString()
  } = input;

  const albumIds = new Set(albums.map((album) => album.id));
  const existingByAlbumId = new Map(existingCollectionItems.map((item) => [item.albumId, item]));
  const createdItems = [];
  const skippedItems = [];

  for (const albumId of selectedAlbumIds) {
    if (!albumIds.has(albumId)) {
      throw new Error(`Album ${albumId} does not exist.`);
    }
    if (existingByAlbumId.has(albumId)) {
      skippedItems.push(existingByAlbumId.get(albumId));
      continue;
    }

    createdItems.push({
      id: `collection-${albumId}`,
      userId: defaults.userId,
      albumId,
      collectionDate: defaults.collectionDate,
      source: defaults.source,
      quantity: defaults.quantity,
      condition: defaults.condition,
      mediumKey: defaults.mediumKey || "vinyl",
      price: pricesByAlbumId[albumId],
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

function updateCollectionItem(input) {
  const { collectionItems, albumId, patch, now = new Date().toISOString() } = input;
  let updatedItem;
  const nextItems = collectionItems.map((item) => {
    if (item.albumId !== albumId) {
      return item;
    }

    updatedItem = {
      ...item,
      ...patch,
      updatedAt: now
    };
    return updatedItem;
  });

  if (!updatedItem) {
    throw new Error(`Collection item for album ${albumId} does not exist.`);
  }

  return {
    collectionItems: nextItems,
    updatedItem
  };
}

function removeCollectionItem(input) {
  const { collectionItems, albumId } = input;
  let removedItem;
  const nextItems = (collectionItems || []).filter((item) => {
    if (item.albumId !== albumId) {
      return true;
    }

    removedItem = item;
    return false;
  });

  if (!removedItem) {
    throw new Error(`Collection item for album ${albumId} does not exist.`);
  }

  return {
    collectionItems: nextItems,
    removedItem
  };
}

function removeCollectionItems(input) {
  const { collectionItems, albumIds = [], collectionIds = [] } = input;
  const albumIdSet = new Set((albumIds || []).filter(Boolean));
  const collectionIdSet = new Set((collectionIds || []).filter(Boolean));
  const removedItems = [];
  const nextItems = (collectionItems || []).filter((item) => {
    const shouldRemove = collectionIdSet.has(item.id) || albumIdSet.has(item.albumId);
    if (!shouldRemove) {
      return true;
    }

    removedItems.push(item);
    return false;
  });

  if (!removedItems.length) {
    throw new Error("No collection items matched for deletion.");
  }

  return {
    collectionItems: nextItems,
    removedItems
  };
}

module.exports = {
  confirmSelectedAlbums,
  removeCollectionItem,
  removeCollectionItems,
  updateCollectionItem
};
