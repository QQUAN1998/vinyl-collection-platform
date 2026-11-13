const ONBOARDING_EXAMPLE_QUERY = "\u5218\u5fb7\u534e";
const ONBOARDING_SEEN_PREFIX = "vinyl:onboarding:v1:";
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

const ONBOARDING_STEPS = [
  {
    "title": "搜索唱片",
    "description": "从“添加”搜索刘德华，查看匹配的专辑。",
    "ja": {
      "title": "検索",
      "description": "「追加」で刘德华を検索し、候補を確認します。"
    }
  },
  {
    "title": "添加收藏",
    "description": "选择专辑，确认收藏形式、数量、品相和价格后保存。",
    "ja": {
      "title": "所蔵に追加",
      "description": "形式・枚数・状態・価格を確認して保存します。"
    }
  },
  {
    "title": "编辑信息",
    "description": "打开收藏卡片，点“编辑唱片”补充发行日期、收藏日期等资料。",
    "ja": {
      "title": "情報を編集",
      "description": "カードの「編集」で発売日や収集日を補足します。"
    }
  },
  {
    "title": "查看详情",
    "description": "点“查看详情”查看专辑资料与完整曲目。",
    "ja": {
      "title": "詳細を見る",
      "description": "「詳細」で作品情報と全曲目を確認します。"
    }
  },
  {
    "title": "分享票根",
    "description": "点“分享唱片”生成纸质票根，可预览并保存海报。",
    "ja": {
      "title": "画像を共有",
      "description": "「共有」で紙風の画像を作成・保存できます。"
    }
  },
  {
    "title": "整理收藏",
    "description": "用“删除唱片”取消收藏，确认名称后再删除。",
    "ja": {
      "title": "所蔵を整理",
      "description": "「削除」で所蔵を解除します。対象を確認して確定してください。"
    }
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
