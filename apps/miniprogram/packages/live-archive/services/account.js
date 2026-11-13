// Fusion only: original App owns login/profile; each backend verifies WeChat identity.
const share = require('../../../services/share');
function profile() {
  const app = getApp(), data = app.globalData;
  const loggedIn = app.isCloudAccountReady();
  const user = data.userProfile || {};
  const name = loggedIn ? (user.name || '唱片柜用户') : '微信登录';
  return { loggedIn, name, initial: name.slice(0, 1), avatar: loggedIn ? (user.avatar || '') : '' };
}
async function requireAccount() {
  const app = getApp();
  if (app.isCloudAccountReady()) return;
  const me = await app.requireWechatAccount({ silent: true });
  if (!me || !app.isCloudAccountReady()) {
    const error = new Error('登录未完成，请在“我的”重试');
    error.code = 'LOGIN_REQUIRED';
    throw error;
  }
}
function open() { wx.navigateTo({ url: '/pages/account/index' }); }
function message(token, shared = false) {
  const user = profile();
  return share.createShareMessage({ title: !shared && user.loggedIn ? user.name + '的演出集' : '演出集', path: '/packages/live-archive/pages/index/index' + (token ? '?share=' + encodeURIComponent(token) : '') });
}
module.exports = { profile, requireAccount, open, message, timeline: share.createShareTimeline, enableShare: share.enableFriendShare };
