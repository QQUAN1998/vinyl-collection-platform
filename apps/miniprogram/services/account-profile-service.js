const DEFAULT_PROFILE_NAME = "\u5531\u7247\u67dc\u7528\u6237";
const PLACEHOLDER_PROFILE_NAMES = new Set(["-", "\u2014", "--"]);

function cleanProfileNameValue(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return PLACEHOLDER_PROFILE_NAMES.has(name) ? "" : name;
}

function normalizeProfileName(value) {
  return cleanProfileNameValue(value) || DEFAULT_PROFILE_NAME;
}

function getWechatProfileName(userInfo = {}) {
  return [
    userInfo.displayName,
    userInfo.nickName,
    userInfo.nickname,
    userInfo.name,
  ].map(cleanProfileNameValue).find(Boolean);
}

function getWechatAvatarUrl(userInfo = {}) {
  return [userInfo.avatarUrl, userInfo.avatar]
    .find((value) => typeof value === "string" && value.trim()) || "";
}

function buildWechatProfile(userInfo = {}, fallback = {}) {
  const name = getWechatProfileName(userInfo);
  const avatar = getWechatAvatarUrl(userInfo);
  return {
    ...fallback,
    name: name ? normalizeProfileName(name) : normalizeProfileName(fallback.name),
    avatar: avatar || fallback.avatar || "",
    bio: fallback.bio || ""
  };
}

function formatProfileDisplayName(value, maxLength = 5) {
  const chars = Array.from(normalizeProfileName(value));
  if (chars.length <= maxLength) {
    return chars.join("");
  }

  return `${chars.slice(0, maxLength).join("")}...`;
}

function hasWechatProfileInfo(userInfo = {}) {
  return Boolean(getWechatProfileName(userInfo) || getWechatAvatarUrl(userInfo));
}

module.exports = {
  DEFAULT_PROFILE_NAME,
  buildWechatProfile,
  cleanProfileNameValue,
  formatProfileDisplayName,
  hasWechatProfileInfo
};
