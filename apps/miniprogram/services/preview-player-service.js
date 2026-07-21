const EMPTY_STATE = {
  visible: false,
  isPlaying: false,
  albumId: "",
  albumTitle: "",
  albumArtist: "",
  albumCover: "",
  trackTitle: "",
  trackKey: "",
  src: ""
};

let audioContext = null;
let playerState = { ...EMPTY_STATE };
const listeners = new Set();

function getPreviewPlayerState() {
  return { ...playerState };
}

function notifyPreviewListeners() {
  const snapshot = getPreviewPlayerState();
  listeners.forEach((listener) => {
    if (typeof listener === "function") {
      listener(snapshot);
    }
  });
}

function setPreviewPlayerState(nextState = {}) {
  playerState = {
    ...playerState,
    ...nextState
  };
  notifyPreviewListeners();
  return getPreviewPlayerState();
}

function subscribePreviewPlayer(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  listeners.add(listener);
  listener(getPreviewPlayerState());
  return () => {
    listeners.delete(listener);
  };
}

function destroyAudioContext() {
  if (audioContext && typeof audioContext.destroy === "function") {
    audioContext.destroy();
  }
  audioContext = null;
}

function resetPreviewPlayer() {
  destroyAudioContext();
  playerState = { ...EMPTY_STATE };
  notifyPreviewListeners();
}

function updateStoppedState(trackKey) {
  if (trackKey && playerState.trackKey !== trackKey) {
    return;
  }
  setPreviewPlayerState({
    visible: false,
    isPlaying: false
  });
}

function appendPreviewRetryParam(src, retryIndex) {
  const separator = String(src || "").includes("?") ? "&" : "?";
  return `${src}${separator}previewRetry=${retryIndex}`;
}

function playPreviewAudio({
  src,
  key,
  album = {},
  track = {},
  retryCount = 1,
  retryDelayMs = 450
} = {}, wxApi) {
  const api = wxApi || (typeof wx === "undefined" ? null : wx);
  if (!src || !api || typeof api.createInnerAudioContext !== "function") {
    return false;
  }

  destroyAudioContext();
  const audio = api.createInnerAudioContext();
  const maxRetries = Math.max(0, Number(retryCount) || 0);
  const retryDelay = Math.max(0, Number(retryDelayMs) || 0);
  let retryIndex = 0;
  audioContext = audio;
  audio.obeyMuteSwitch = false;
  audio.src = src;

  setPreviewPlayerState({
    visible: true,
    isPlaying: false,
    albumId: album.id || "",
    albumTitle: album.title || "",
    albumArtist: album.artist || "",
    albumCover: album.cover || album.coverUrl || "",
    trackTitle: track.title || "",
    trackKey: key || "",
    src
  });

  audio.onPlay(() => {
    if (audioContext === audio) {
      setPreviewPlayerState({ visible: true, isPlaying: true });
    }
  });
  audio.onPause(() => {
    if (audioContext === audio) {
      setPreviewPlayerState({ visible: true, isPlaying: false });
    }
  });
  audio.onStop(() => {
    if (audioContext === audio) {
      updateStoppedState(key);
    }
  });
  audio.onEnded(() => {
    if (audioContext === audio) {
      updateStoppedState(key);
    }
  });
  audio.onError(() => {
    if (audioContext === audio) {
      if (retryIndex < maxRetries && typeof audio.play === "function") {
        retryIndex += 1;
        audio.src = appendPreviewRetryParam(src, retryIndex);
        if (retryDelay && typeof setTimeout === "function") {
          setTimeout(() => {
            if (audioContext === audio) {
              audio.play();
            }
          }, retryDelay);
          return;
        }
        audio.play();
        return;
      }
      updateStoppedState(key);
    }
  });
  audio.play();
  return true;
}

function togglePreviewPlayback() {
  if (!audioContext) {
    return getPreviewPlayerState();
  }

  if (playerState.isPlaying && typeof audioContext.pause === "function") {
    audioContext.pause();
    return setPreviewPlayerState({ visible: true, isPlaying: false });
  }

  if (typeof audioContext.play === "function") {
    audioContext.play();
    return setPreviewPlayerState({ visible: true, isPlaying: true });
  }
  return getPreviewPlayerState();
}

function stopPreviewPlayback() {
  if (audioContext && typeof audioContext.stop === "function") {
    audioContext.stop();
    return setPreviewPlayerState({ visible: false, isPlaying: false });
  }
  resetPreviewPlayer();
  return getPreviewPlayerState();
}

module.exports = {
  getPreviewPlayerState,
  playPreviewAudio,
  resetPreviewPlayer,
  stopPreviewPlayback,
  subscribePreviewPlayer,
  togglePreviewPlayback
};
