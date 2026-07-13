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
    const parts = inputLine.split(/\s+-\s+/);
    if (parts.length >= 2) {
      return {
        inputLine,
        artist: parts[0].trim(),
        title: parts.slice(1).join(" - ").trim()
      };
    }
    return {
      inputLine,
      artist: "",
      title: inputLine
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

function matchAlbumCandidates(entries, albums, collectionItems = []) {
  const collectedAlbumIds = new Set(collectionItems.map((item) => item.albumId));
  return entries.map((entry) => {
    const candidates = albums
      .map((album) => ({ album, score: scoreCandidate(entry, album) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.album.year - b.album.year)
      .map((candidate) => candidate.album);

    return {
      inputLine: entry.inputLine,
      candidates,
      selectedAlbumId: candidates[0] ? candidates[0].id : undefined,
      alreadyCollected: candidates[0] ? collectedAlbumIds.has(candidates[0].id) : false
    };
  });
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
  matchAlbumCandidates,
  toggleSelected,
  getSelectedCount
};
