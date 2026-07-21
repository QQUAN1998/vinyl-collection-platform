function parseBatchInput(input, options = {}) {
  const maxLines = options.maxLines || 50;
  const rawLines = String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rawLines.length) {
    throw new Error("Batch input must contain at least one album.");
  }
  if (rawLines.length > maxLines) {
    throw new Error(`Batch input supports at most ${maxLines} albums.`);
  }

  const seen = new Set();
  const duplicates = [];
  for (const line of rawLines) {
    if (seen.has(line) && !duplicates.includes(line)) duplicates.push(line);
    seen.add(line);
  }

  const entries = rawLines.map((inputLine) => {
    const parts = inputLine.split(/\s+[-—–]\s+/);
    if (parts.length >= 2) {
      const artist = parts[0].trim();
      const title = parts.slice(1).join(" - ").trim();
      return {
        inputLine,
        artist,
        title,
        query: `${artist} - ${title}`
      };
    }

    const slashParts = inputLine.split(/\s*[/｜|,，]\s*/);
    if (slashParts.length >= 2) {
      const title = slashParts[0].trim();
      const artist = slashParts.slice(1).join(" / ").trim();
      return {
        inputLine,
        artist,
        title,
        query: `${artist} - ${title}`
      };
    }

    const looseParts = inputLine.split(/\s+/).filter(Boolean);
    if (looseParts.length >= 2) {
      const artist = looseParts.slice(0, -1).join(" ");
      const title = looseParts[looseParts.length - 1];
      return {
        inputLine,
        artist,
        title,
        query: `${artist} - ${title}`
      };
    }

    return {
      inputLine,
      artist: "",
      title: inputLine,
      query: inputLine
    };
  });

  return { rawLines, duplicates, entries };
}

function scoreCandidate(entry, album) {
  const title = entry.title.toLowerCase();
  const artist = entry.artist.toLowerCase();
  const albumTitle = album.title.toLowerCase();
  const albumArtist = album.artist.toLowerCase();

  let score = 0;
  if (albumTitle === title) score += 100;
  else if (albumTitle.includes(title) || title.includes(albumTitle)) score += 60;
  if (artist && albumArtist.includes(artist)) score += 40;
  return score;
}

function rankBatchCatalogCandidates(entry, candidates = []) {
  return (candidates || [])
    .map((album) => ({
      album,
      score: scoreBatchCatalogCandidate(entry, album)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const providerRank = getProviderRank(a.album) - getProviderRank(b.album);
      if (providerRank !== 0) return providerRank;
      return Number(a.album.year || 9999) - Number(b.album.year || 9999);
    })
    .map((candidate) => candidate.album);
}

function scoreBatchCatalogCandidate(entry = {}, album = {}) {
  const title = normalizeMatchText(entry.title || entry.query || entry.inputLine);
  const artist = normalizeMatchText(entry.artist || "");
  const albumTitle = normalizeMatchText(album.title || "");
  const albumArtist = normalizeMatchText(album.artist || "");
  let score = 0;

  if (title && albumTitle) {
    if (albumTitle === title) score += 220;
    else if (albumTitle.includes(title) || title.includes(albumTitle)) score += 140;
  }

  // The artist is helpful for ordering, but it should never be a hard filter.
  if (artist && albumArtist) {
    if (albumArtist === artist) score += 80;
    else if (albumArtist.includes(artist) || artist.includes(albumArtist)) score += 55;
    else if (hasArtistTokenOverlap(artist, albumArtist)) score += 25;
  }

  if (album.catalogProvider === "NETEASE") score += 9;
  else if (album.catalogProvider === "QQMUSIC") score += 7;
  else if (album.catalogProvider === "ITUNES") score += 3;

  return score;
}

function normalizeMatchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[《》"'“”‘’]/g, "")
    .replace(/\s+/g, " ");
}

function hasArtistTokenOverlap(artist, albumArtist) {
  const tokens = artist
    .split(/[\s/&+,，、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return tokens.some((token) => albumArtist.includes(token));
}

function getProviderRank(album = {}) {
  switch (album.catalogProvider) {
    case "NETEASE":
      return 1;
    case "QQMUSIC":
      return 2;
    case "ITUNES":
      return 3;
    default:
      return 9;
  }
}

function matchAlbumCandidates(entries, albums, collectionItems = []) {
  const collectedAlbumIds = new Set(collectionItems.map((item) => item.albumId));
  return entries.map((entry, index) => {
    const candidates = albums
      .map((album) => ({ album, score: scoreCandidate(entry, album) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.album.year - b.album.year)
      .map((candidate) => candidate.album);
    const effectiveCandidates = candidates.length
      ? candidates
      : [createManualAlbumCandidate(entry, index)];
    const selectedAlbumId = effectiveCandidates[0] ? effectiveCandidates[0].id : undefined;

    return {
      inputLine: entry.inputLine,
      candidates: effectiveCandidates,
      selectedAlbumId,
      alreadyCollected: selectedAlbumId ? collectedAlbumIds.has(selectedAlbumId) : false,
      manualFallback: !candidates.length
    };
  });
}

function createManualAlbumCandidate(entry, index = 0) {
  const title = String(entry.title || entry.inputLine || "").trim();
  const artist = String(entry.artist || "").trim();
  const key = `${artist}::${title || entry.inputLine || index}`;
  return {
    id: `manual-batch-${index + 1}-${hashText(key)}`,
    title: title || String(entry.inputLine || "").trim(),
    artist: artist || "\u672a\u77e5\u827a\u4eba",
    year: undefined,
    region: "\u672a\u8bb0\u5f55",
    style: "\u672a\u5206\u7c7b",
    coverUrl: "",
    cover: "",
    tracks: [],
    manualDraft: true
  };
}

function getDefaultSelectedAlbumIds(matches = []) {
  const selected = [];
  for (const match of matches || []) {
    if (match && match.selectedAlbumId && !selected.includes(match.selectedAlbumId)) {
      selected.push(match.selectedAlbumId);
    }
  }
  return selected;
}

function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function toggleSelected(selectedIds, albumId) {
  const next = new Set(selectedIds);
  if (next.has(albumId)) next.delete(albumId);
  else next.add(albumId);
  return next;
}

function getSelectedCount(selectedIds) {
  return selectedIds.size;
}

module.exports = {
  parseBatchInput,
  createManualAlbumCandidate,
  getDefaultSelectedAlbumIds,
  matchAlbumCandidates,
  rankBatchCatalogCandidates,
  toggleSelected,
  getSelectedCount
};
