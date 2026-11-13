function formatTrackDuration(durationMs) {
  const ms = Number(durationMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeTrackDisplayList(tracks = []) {
  return (tracks || [])
    .map((track, index) => normalizeTrackDisplay(track, index))
    .filter(Boolean);
}

function normalizeTrackDisplay(track, index) {
  if (typeof track === "string") {
    const title = track.trim();
    return title
      ? { position: index + 1, title, durationLabel: "" }
      : null;
  }

  if (!track || typeof track !== "object") {
    return null;
  }

  const title = String(track.title || track.name || "").trim();
  if (!title) {
    return null;
  }

  const rawPosition = Number(track.position || track.no || track.trackNumber || index + 1);
  const position = Number.isFinite(rawPosition) && rawPosition > 0 ? rawPosition : index + 1;
  return {
    position,
    title,
    durationLabel: formatTrackDuration(track.durationMs || track.duration || track.durationMillis)
  };
}

module.exports = {
  formatTrackDuration,
  normalizeTrackDisplayList
};
