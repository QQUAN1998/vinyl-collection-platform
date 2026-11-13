// Dedicated 5:4 message-card artwork; never let WeChat capture an open dialog.
const ROOT = '/assets/ui/share-cards/';
function category(message = {}, page = {}) {
  const path = message.path || '', title = message.title || '';
  const live = /live-archive/.test(path) || /演出|现场/.test(title) || page.data?.uiKind === 'live';
  const kind = live ? 'live' : 'vinyl';
  if (/时间线/.test(title)) return kind + '-timeline';
  if (/统计/.test(title) || /\/pages\/stats\//.test(path)) return kind + '-stats';
  if (/\/pages\/album-detail\//.test(path)) return 'vinyl-album';
  if (/live-archive\/pages\/detail\//.test(path)) return 'live-performance';
  if (/tv-download/.test(path)) return 'tv';
  if (/user-guide/.test(path)) return 'guide';
  return kind + '-cabinet';
}
function apply(message, page) {
  if (!message || typeof message !== 'object') return message;
  // A child pane has already selected the right artwork for its own share scope.
  if (typeof message.imageUrl === 'string' && message.imageUrl.startsWith(ROOT)) return message;
  const imageUrl = ROOT + category(message, page) + '.png';
  const result = { ...message, imageUrl };
  if (message.promise?.then) result.promise = message.promise.then(value => ({ ...value, imageUrl }));
  return result;
}
module.exports = { category, apply };
