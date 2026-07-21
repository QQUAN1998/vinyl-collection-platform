const ONBOARDING_EXAMPLE_QUERY = "\u5218\u5fb7\u534e";
const ONBOARDING_SEEN_PREFIX = "vinyl:onboarding:v1:";
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

const ONBOARDING_STEPS = [
  {
    title: "\u641c\u7d22\u5531\u7247",
    description: "\u4ece\u201c\u6dfb\u52a0\u201d\u641c\u7d22\u5218\u5fb7\u534e\uff0c\u8fdb\u5165\u5168\u90e8\u5728\u7ebf\u7ed3\u679c\u3002"
  },
  {
    title: "\u6dfb\u52a0\u6536\u85cf",
    description: "\u9009\u4e2d\u60f3\u6536\u85cf\u7684\u4e13\u8f91\uff0c\u4e0b\u4e00\u6b65\u540e\u4fdd\u5b58\u5230\u81ea\u5df1\u7684\u5531\u7247\u67dc\u3002"
  },
  {
    title: "\u7f16\u8f91\u4fe1\u606f",
    description: "\u6253\u5f00\u6536\u85cf\u5531\u7247\uff0c\u53ef\u4fee\u6539\u65e5\u671f\u3001\u4ecb\u8d28\u3001\u4ef7\u683c\u3001\u54c1\u76f8\u548c\u5907\u6ce8\u3002"
  },
  {
    title: "\u628a\u5531\u7247\u4e0a\u5899",
    description: "\u5728\u5531\u7247\u5361\u7247\u4e0a\u70b9\u201c\u4e0a\u5899\u201d\uff0c\u5b83\u4f1a\u51fa\u73b0\u5728\u9996\u9875\u7167\u7247\u5899\u3002"
  },
  {
    title: "\u67e5\u770b\u8be6\u60c5",
    description: "\u70b9\u201c\u8be6\u60c5\u201d\u53ef\u770b\u53d1\u884c\u5e74\u4efd\u3001\u98ce\u683c\u3001\u66f2\u76ee\u548c\u6536\u85cf\u8d44\u6599\u3002"
  },
  {
    title: "\u5220\u9664\u5531\u7247",
    description: "\u70b9\u5361\u7247\u5de6\u4e0a\u89d2\u5220\u9664\uff0c\u6216\u5728\u7f16\u8f91\u9875\u5220\u9664\u8fd9\u5f20\u6536\u85cf\u3002"
  }
];

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  return typeof wx === "undefined" ? null : wx;
}

function getOnboardingSeenKey(userId) {
  return `${ONBOARDING_SEEN_PREFIX}${userId || "anonymous"}`;
}

function wasOnboardingSeen(userId, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.getStorageSync !== "function") {
    return false;
  }

  return Boolean(api.getStorageSync(getOnboardingSeenKey(userId)));
}

function markOnboardingSeen(userId, wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.setStorageSync !== "function") {
    return;
  }

  api.setStorageSync(getOnboardingSeenKey(userId), true);
}

function shouldShowNewUserOnboarding(me, wxApi, now = new Date()) {
  const user = me && me.user ? me.user : {};
  if (!user.id || wasOnboardingSeen(user.id, wxApi)) {
    return false;
  }

  if (Number(me.stats && me.stats.collectionCount) > 0) {
    return false;
  }

  const createdAt = Date.parse(user.createdAt || "");
  if (!Number.isFinite(createdAt)) {
    return true;
  }

  return now.getTime() - createdAt <= NEW_USER_WINDOW_MS;
}

module.exports = {
  ONBOARDING_EXAMPLE_QUERY,
  ONBOARDING_STEPS,
  getOnboardingSeenKey,
  markOnboardingSeen,
  shouldShowNewUserOnboarding,
  wasOnboardingSeen
};
