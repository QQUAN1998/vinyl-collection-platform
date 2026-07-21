const AUTH_STATE_STORAGE_KEY = "vinylAuthStateV1";
const LEGACY_TOKEN_STORAGE_KEY = "vinylAuthToken";

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  return typeof wx === "undefined" ? null : wx;
}

function readStorage(key, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.getStorageSync !== "function") {
    return null;
  }

  try {
    return api.getStorageSync(key);
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.setStorageSync !== "function") {
    return false;
  }

  try {
    api.setStorageSync(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeStoredAuthState(value = {}, fallbackToken = "") {
  const state = value && typeof value === "object" ? value : {};
  const token = typeof state.token === "string" && state.token
    ? state.token
    : typeof fallbackToken === "string"
      ? fallbackToken
      : "";
  const me = state.me && typeof state.me === "object" ? state.me : null;
  const userProfile = state.userProfile && typeof state.userProfile === "object"
    ? state.userProfile
    : null;
  const cloudCollection = normalizeStoredCloudCollection(state.cloudCollection);

  return {
    token,
    me,
    userProfile,
    cloudCollection,
    savedAt: typeof state.savedAt === "string" ? state.savedAt : ""
  };
}

function normalizeStoredCloudCollection(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const collectionItems = Array.isArray(value.collectionItems) ? value.collectionItems : [];
  const manualAlbums = Array.isArray(value.manualAlbums) ? value.manualAlbums : [];
  const photoWallOrder = Array.isArray(value.photoWallOrder)
    ? value.photoWallOrder.map((albumId) => String(albumId || "").trim()).filter(Boolean)
    : [];

  if (!collectionItems.length && !manualAlbums.length && !photoWallOrder.length) {
    return null;
  }

  return {
    collectionItems,
    manualAlbums,
    photoWallOrder
  };
}

function readStoredAuthState(wxApi) {
  const legacyToken = readStorage(LEGACY_TOKEN_STORAGE_KEY, wxApi) || "";
  return normalizeStoredAuthState(
    readStorage(AUTH_STATE_STORAGE_KEY, wxApi),
    legacyToken
  );
}

function writeStoredAuthState(state = {}, wxApi, now = new Date()) {
  const savedAt = now instanceof Date ? now.toISOString() : String(now || "");
  const nextState = normalizeStoredAuthState({
    ...state,
    savedAt
  }, state.token || "");

  if (!writeStorage(AUTH_STATE_STORAGE_KEY, nextState, wxApi)) {
    return null;
  }
  if (nextState.token) {
    writeStorage(LEGACY_TOKEN_STORAGE_KEY, nextState.token, wxApi);
  }

  return nextState;
}

function hasStoredAuthAccount(state = {}) {
  return Boolean(state && state.me && state.me.user && state.me.user.id);
}

module.exports = {
  AUTH_STATE_STORAGE_KEY,
  LEGACY_TOKEN_STORAGE_KEY,
  hasStoredAuthAccount,
  readStoredAuthState,
  writeStoredAuthState
};
