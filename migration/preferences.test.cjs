const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

function runtime(storage = {}, savedTheme = { mode: 'standard' }) {
  const file = path.resolve('apps/miniprogram/ui/locale-runtime.js');
  const context = { module: { exports: {} }, require: createRequire(file),
    getApp: () => ({ globalData: { theme: savedTheme } }),
    getCurrentPages: () => [],
    wx: { getStorageSync: key => storage[key], setStorageSync: (key, value) => storage[key] = value } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return context.module.exports;
}

test('language selection persists across launches, rejects unknown locales and leaves collection text unchanged', () => {
  const storage = {}, locale = runtime(storage);
  assert.equal(locale.current(), 'zh');
  for (const code of ['en', 'ja', 'zh-Hant', 'zh']) {
    locale.select(code);
    assert.equal(runtime(storage).current(), code);
    assert.equal(locale.translate('迁徙录 / 松川'), '迁徙录 / 松川');
    if (code !== 'zh') assert.notEqual(locale.translate('编辑唱片'), '编辑唱片');
  }
  locale.select('invalid'); assert.equal(locale.current(), 'zh');
  assert.equal(runtime({ vinylInterfaceLanguage: 'ko' }).current(), 'zh');
  assert.deepEqual(Array.from(locale.LANGUAGES, item => item.code), ['zh', 'zh-Hant', 'en', 'ja']);
  assert.equal(locale.translate(null), null);
});

test('a failed preference write keeps the previous language and visible state', () => {
  const storage = {}, locale = runtime(storage);
  locale.select('ja');
  Object.freeze(storage);
  // A strict storage implementation represents native storage failure.
  const file = path.resolve('apps/miniprogram/ui/locale-runtime.js');
  const context = { module: { exports: {} }, require: createRequire(file),
    wx: { getStorageSync: () => 'ja', setStorageSync() { throw Error('full'); } } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  assert.equal(context.module.exports.current(), 'ja');
  assert.throws(() => context.module.exports.select('en'), /full/);
  assert.equal(context.module.exports.current(), 'ja');
});

test('mounted pages and isolated components update together and release subscriptions on destruction', () => {
  const locale = runtime(), patches = [];
  let pageSpec, componentSpec;
  locale.registerPage(spec => pageSpec = spec, { data: { albumTitle: '迁徙录' } });
  locale.registerComponent(spec => componentSpec = spec, { data: { artist: '松川' } });
  const target = (spec, name) => ({ data: { ...spec.data }, setData(p) { Object.assign(this.data, p); patches.push(name); } });
  const page = target(pageSpec, 'page'), component = target(componentSpec, 'component');
  pageSpec.onLoad.call(page); componentSpec.lifetimes.attached.call(component);
  locale.select('ja');
  assert.equal(page.data.uiLanguage, 'ja'); assert.equal(component.data.uiLanguage, 'ja');
  assert.equal(page.data.albumTitle, '迁徙录'); assert.equal(component.data.artist, '松川');
  pageSpec.onUnload.call(page); componentSpec.lifetimes.detached.call(component);
  const count = patches.length; locale.select('en'); assert.equal(patches.length, count);
});

test('only standard appearance is available and legacy dark/custom settings migrate safely', () => {
  const theme = require('../apps/miniprogram/services/theme-service');
  assert.deepEqual(theme.themeOptions.map(item => item.mode), ['standard']);
  assert.equal(theme.normalizeThemeSetting({ mode: 'custom', customColor: '#ff0000' }).mode, 'standard');
  const dark = theme.buildThemeViewData('dark');
  assert.deepEqual(dark, theme.buildThemeViewData('standard'));
  assert.equal(theme.readStoredThemeSetting({getStorageSync:()=>({mode:'dark'})}).mode,'standard');
  assert.equal(theme.buildThemeViewData('white').backgroundColor, '#f5f6f2');
});

test('WXS and JavaScript translations agree and displayed enum translation does not change filter values', () => {
  const context = { module: { exports: {} }, require:createRequire(path.resolve('apps/miniprogram/ui/locale.wxs')) };
  vm.runInNewContext(fs.readFileSync('apps/miniprogram/ui/locale.wxs', 'utf8'), context);
  const locale = runtime(), wxs = context.module.exports;
  for (const code of ['zh', 'zh-Hant', 'en', 'ja']) {
    for (const label of ['搜索唱片', '已看过', '全部年份', '保存收藏', '暗夜模式', ' 人生第 ']) {
      assert.equal(wxs.t(label, code), locale.translate(label, code));
    }
  }
  assert.equal(wxs.t(2026, 'en'), 2026);
  assert.equal(wxs.t('编辑唱片','zh-Hant'),'編輯唱片');
  assert.equal(wxs.t('备注','zh-Hant'),'備註');
  assert.equal(wxs.guide('首次收藏流程','zh-Hant'),'首次收藏流程');
  assert.equal(wxs.guide('发行日期填年月日；删除时核对名称后确认。','zh-Hant'),'發行日期填年月日；刪除時覈對名稱後確認。');
  assert.equal(wxs.t('迁徙录 / 松川','zh-Hant'),'迁徙录 / 松川');
  assert.equal(wxs.owner('刘德华','vinyl','zh-Hant'),'刘德华的唱片櫃');
  assert.equal(wxs.owner('Q', 'vinyl', 'en'), "Q's Records");
  assert.equal(wxs.status('未绑定 · 2026-11-09 12:00','ja'),'未接続 · 2026-11-09 12:00');
  assert.equal(wxs.status('用户自己的电视名称','ja'),'用户自己的电视名称');
  assert.equal(wxs.t('唱片柜','ja'),'レコード');
  assert.equal(wxs.t('演出集','ja'),'公演');
  const markup = fs.readFileSync('apps/miniprogram/packages/live-archive/pages/index/index.wxml', 'utf8');
  assert.match(markup, /tab==='home'/);
  assert.match(markup, /i18n.t\(filterCity,uiLanguage\)/);
  assert.doesNotMatch(markup, /tab===i18n/);
});

test('settings saves the supported choices and applies preferences to the existing route', () => {
  const storage = {}, locale = runtime(storage), themeCalls = [];
  const themes = require('../apps/miniprogram/services/theme-service');
  let spec, theme = { mode: 'standard' };
  const app = { getThemeViewData: () => themes.buildThemeViewData(theme),
    setTheme(next) { theme = next; themeCalls.push(next.mode); } };
  const file = path.resolve('apps/miniprogram/pages/theme-settings/index.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    Page: value => spec = value, getApp: () => app, wx: {},
    require: name => name.includes('locale-runtime') ? locale : createRequire(file)(name)
  });
  const target = { ...spec, data: { ...spec.data }, setData(p) { Object.assign(this.data, p); } };
  spec.onLoad.call(target); spec.onShow.call(target);
  assert.equal(target.data.selectedMode, 'standard');
  target.selectTheme({ currentTarget: { dataset: { mode: 'dark' } } });
  target.selectTheme({ currentTarget: { dataset: { mode: 'white' } } });
  assert.deepEqual(themeCalls, []);
  assert.equal(target.data.selectedMode, 'standard');
  target.selectLanguage({ currentTarget: { dataset: { code: 'ja' } } });
  target.selectLanguage({ currentTarget: { dataset: { code: 'ko' } } });
  assert.equal(storage.vinylInterfaceLanguage, 'ja');
  assert.equal(target.data.selectedLanguage, 'ja');
  spec.onUnload.call(target);
});
