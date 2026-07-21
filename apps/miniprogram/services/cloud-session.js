const SESSION_REQUIRED_TITLE = "\u767b\u5f55\u540c\u6b65\u672a\u5c31\u7eea\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const SAVE_FAILED_TITLE = "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
const DELETE_FAILED_TITLE = "\u53d6\u6d88\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  return typeof wx === "undefined" ? null : wx;
}

function isCloudSessionReady(app) {
  return Boolean(app && app.globalData && app.globalData.cloud && app.globalData.cloud.ready);
}

function showToast(title, wxApi) {
  const api = getWxApi(wxApi);
  if (api && typeof api.showToast === "function") {
    api.showToast({ title, icon: "none" });
  }
}

function ensureCloudSession(app, wxApi) {
  if (isCloudSessionReady(app)) {
    return true;
  }

  if (app && typeof app.showCloudSessionRequired === "function") {
    app.showCloudSessionRequired(wxApi);
  } else {
    showToast(SESSION_REQUIRED_TITLE, wxApi);
  }
  return false;
}

function requireCloudAccount(app) {
  if (app && typeof app.isCloudAccountReady === "function" && app.isCloudAccountReady()) {
    return Promise.resolve(app.globalData.auth?.me || true);
  }
  if (app && typeof app.requireWechatAccount === "function") {
    return app.requireWechatAccount();
  }

  return Promise.resolve(ensureCloudSession(app) ? true : null);
}

function showCloudSaveFailed(wxApi) {
  showToast(SAVE_FAILED_TITLE, wxApi);
}

function showCloudDeleteFailed(wxApi) {
  showToast(DELETE_FAILED_TITLE, wxApi);
}

module.exports = {
  DELETE_FAILED_TITLE,
  SAVE_FAILED_TITLE,
  SESSION_REQUIRED_TITLE,
  ensureCloudSession,
  isCloudSessionReady,
  requireCloudAccount,
  showCloudDeleteFailed,
  showCloudSaveFailed
};
