const dictionary = require('./locale-data');
const traditional = require('./traditional');
const themes = require('../services/theme-service');
const shareCovers = require('./share-covers');
const STORAGE_KEY = 'vinylInterfaceLanguage';
const LANGUAGES = [
  { code: 'zh', name: '简体中文' }, { code: 'zh-Hant', name: '繁體中文' }, { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' }
];
const targets = new Set();
let language;

function normalize(value) { return LANGUAGES.some(item => item.code === value) ? value : 'zh'; }
function current() {
  if (!language) {
    try { language = normalize(wx.getStorageSync(STORAGE_KEY)); } catch (_) { language = 'zh'; }
  }
  return language;
}
function translate(value, locale = current()) {
  if (typeof value !== 'string' || locale === 'zh') return value;
  const key = value.trim();
  const row = dictionary[key];
  if (locale === 'zh-Hant') return row ? value.replace(key, traditional.convert(key)) : value;
  const translated = row?.[['en', 'ja'].indexOf(locale)];
  return translated ? value.replace(key, translated) : value;
}
function view() {
  let theme;
  try { theme = getApp().globalData.theme; } catch (_) { /* Registration can precede App. */ }
  const data = themes.buildThemeViewData(theme);
  let status=36;
  try {status=(wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync()).statusBarHeight||0;}catch(_){}
  return { uiStatusHeight:status, uiChromeHeight:status+52, uiLanguage: current(), uiThemeClass: data.themeClass, uiThemeStyle: data.themeStyle };
}
function sync(target) {
  const next = view();
  if (Object.keys(next).some(key => target.data[key] !== next[key])) target.setData(next);
}
function refresh() { for (const target of targets) sync(target); }
function select(value) {
  const next = normalize(value);
  // Persist before applying so a failed storage write cannot claim success.
  wx.setStorageSync(STORAGE_KEY, next);
  language = next;
  refresh();
  updateTitle();
  return next;
}
function updateTitle(title) {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const page = pages[pages.length - 1];
  if (title) { if (page) page.uiOriginalTitle = title; }
  else title = page?.uiOriginalTitle;
  if (title && typeof wx.setNavigationBarTitle === 'function') wx.setNavigationBarTitle({ title: translate(title) });
}
// Match native bottom/overscroll surfaces to fixed modal scrims, then restore on close.
function backdrop(data) {
  const preview=!!(data.albumCard||data.uiPreviewRecord||data.uiDetailOpen);
  if(data.uiTicket)return '#f5f6f2';
  return preview?'#8c8e8e':'#f5f6f2';
}
function nativeBackdrop(color) {
  if(typeof wx!=='undefined'&&typeof wx.setBackgroundColor==='function')wx.setBackgroundColor({backgroundColor:color,backgroundColorBottom:color});
}
function bindBackdrop(target) {
  const original=target.setData;
  target.setData=function(patch,callback){
    if(!['uiTicket','albumCard','uiPreviewRecord','uiDetailOpen','uiThemeClass'].some(key=>Object.prototype.hasOwnProperty.call(patch,key)))return original.call(this,patch,callback);
    const color=backdrop({...this.data,...patch}),changed=this.data.uiModalBackground!==color;
    const result=original.call(this,{...patch,uiModalBackground:color},callback);
    if(changed)nativeBackdrop(color);
    return result;
  };
}
function page(spec, navigationTitle) {
  const original = { load: spec.onLoad, show: spec.onShow, unload: spec.onUnload };
  const wrapped = { ...spec,
    data: { ...spec.data, ...view(),uiModalBackground:backdrop({...spec.data,...view()}) },
    onLoad(...args) { bindBackdrop(this); targets.add(this); sync(this); return original.load?.apply(this, args); },
    onShow(...args) {
      sync(this);
      const result = original.show?.apply(this, args);
      const chrome = themes.buildThemeViewData(this.uiThemeSetting || (() => { try { return getApp().globalData.theme; } catch (_) { return null; } })());
      themes.applyThemeChrome(chrome);
      if(this.data.uiTicket||this.data.albumCard||this.data.uiPreviewRecord||this.data.uiDetailOpen)nativeBackdrop(backdrop(this.data));
      updateTitle(this.uiOriginalTitle || navigationTitle);
      return result;
    },
    onUnload(...args) { targets.delete(this); return original.unload?.apply(this, args); }
  };
  for (const key of ['onShareAppMessage', 'onShareTimeline']) {
    if (typeof spec[key] === 'function') wrapped[key] = function (...args) {
      return shareCovers.apply(spec[key].apply(this, args), this);
    };
  }
  return wrapped;
}
function component(spec) {
  const lifetimes = spec.lifetimes || {};
  const pages = spec.pageLifetimes || {};
  const attached = lifetimes.attached || spec.attached;
  const detached = lifetimes.detached || spec.detached;
  return { ...spec,
    data: { ...spec.data, ...view() },
    lifetimes: { ...lifetimes,
      attached(...args) { targets.add(this); sync(this); return attached?.apply(this, args); },
      detached(...args) { targets.delete(this); return detached?.apply(this, args); }
    },
    pageLifetimes: { ...pages, show(...args) { sync(this); return pages.show?.apply(this, args); } }
  };
}
function registerPage(register, spec, navigationTitle) { register(page(spec, navigationTitle)); }
function registerComponent(register, spec) { register(component(spec)); }
function toast(api, options) { api.showToast({ ...options, title: translate(options.title) }); }
function modal(api, options) {
  return api.showModal({ ...options, title: translate(options.title), content: translate(options.content),
    ...(options.confirmText ? { confirmText: translate(options.confirmText) } : {}),
    ...(options.cancelText ? { cancelText: translate(options.cancelText) } : {}) });
}
function loading(api, options) { api.showLoading({ ...options, title: translate(options.title) }); }
function title(api, options) { updateTitle(options.title); }
module.exports = { LANGUAGES, STORAGE_KEY, normalize, current, translate, select, sync, refresh, page, component, registerPage, registerComponent, toast, modal, loading, title,backdrop };
