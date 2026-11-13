const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

function load(relative, additions = {}) {
  const file = path.resolve('apps/miniprogram', relative);
  const context = { module: { exports: {} }, require: createRequire(file), console, ...additions };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return context.module.exports;
}

test('primary navigation reuses the current home and returns to an existing host from secondary pages', () => {
  const tabs = [], actions = [];
  let pages = [{ route: 'pages/cabinet/index', uiPrimary: tab => tabs.push(tab) }];
  const navigation = load('ui/home-navigation.js', { getCurrentPages: () => pages });
  const api = {
    navigateBack(o) { actions.push(o.delta); o.success(); },
    redirectTo() { assert.fail('must retain the existing home'); },
    navigateTo(o) { actions.push(o.url); }
  };
  navigation.openFromHome('/pages/add/index', api);
  navigation.openFromHome('/pages/stats/index', api);
  pages = [...pages, { route: 'pages/all-collection/index' }];
  navigation.openFromHome('/pages/cabinet/index', api);
  navigation.openFromHome('/pages/account/index', api);
  assert.deepEqual(tabs, ['add', 'stats', 'home']);
  assert.deepEqual(actions, [1, '/pages/account/index']);
});

test('primary pane lifecycle retains data, suspends hidden work and resumes only the visible pane', () => {
  let spec;
  const calls = [];
  load('ui/primary-pane.js', { Component: value => spec = value })({
    data: { query: '保留输入' },
    onLoad() { calls.push('load'); }, onShow() { calls.push('show'); },
    onHide() { calls.push('hide'); }, onUnload() { calls.push('unload'); },
    cancelOnlineSearch() { calls.push('cancel'); }
  });
  const self = { setData(p) { Object.assign(this.data,p); }, data: { query: '保留输入', visible: true }, ...spec.methods };
  spec.lifetimes.attached.call(self);
  spec.pageLifetimes.show.call(self);
  self.data.visible = false; spec.observers.visible.call(self);
  spec.pageLifetimes.hide.call(self); spec.pageLifetimes.show.call(self);
  self.data.visible = true; spec.observers.visible.call(self);
  assert.equal(self.data.query, '保留输入');
  assert.deepEqual(calls, ['load', 'show', 'cancel', 'hide', 'show']);
  spec.lifetimes.detached.call(self);
  assert.deepEqual(calls.slice(-2), ['cancel', 'unload']);
});

test('retained add pane receives the original full-collection share button event', () => {
  const tabs = load('ui/primary-tabs.js');
  const event = { target: { dataset: { uiAll: true } } };
  const self = { data: { uiTab: 'add' }, selectComponent(selector) {
    assert.equal(selector, '#ui-add');
    return { onShareAppMessage(received) { assert.equal(received, event); return { path: '/full-collection' }; } };
  } };
  assert.equal(tabs.uiPaneShare.call(self, event).path, '/full-collection');
  self.data.uiTab = 'home';
  assert.equal(tabs.uiPaneShare.call(self, event), null);
});

test('collection refresh coalesces concurrent panes, retries failures and isolates account changes', async () => {
  const marked = [], fresh = new Set();
  const { refreshCollection } = load('ui/collection-refresh.js', {
    require: () => ({ recent: (kind, app) => fresh.has(app.globalData.userId), mark: (kind, app) => { marked.push(app.globalData.userId); fresh.add(app.globalData.userId); } })
  });
  let finish, calls = 0;
  const app = { globalData: { userId: 'a' }, loadCloudCollection() { calls++; return new Promise(resolve => finish = resolve); } };
  const first = refreshCollection(app), second = refreshCollection(app);
  assert.equal(first, second); await Promise.resolve(); assert.equal(calls, 1);
  finish({ items: [] }); await first;
  assert.equal(await refreshCollection(app), null); assert.equal(calls, 1);
  app.globalData.userId = 'b'; const old = refreshCollection(app); await Promise.resolve();
  app.globalData.userId = 'c'; finish({ items: ['private-b'] }); assert.equal(await old, null);
  assert.deepEqual(marked, ['a']);
  app.loadCloudCollection = async () => { calls++; throw Error('offline'); };
  await assert.rejects(refreshCollection(app), /offline/);
  app.loadCloudCollection = async () => { calls++; return { items: ['c'] }; };
  assert.ok(await refreshCollection(app)); assert.deepEqual(marked, ['a', 'c']);
  assert.ok(await refreshCollection(app, true));
});

test('home projection does not send the same 388 covers again and reflects an edited cover', () => {
  let spec;
  const app = { globalData: { manualAlbums: [{ id: 'owned', title: '收藏', cover: 'https://example.test/a.jpg' }], collectionItems: [{ albumId: 'owned' }], userProfile: { name: 'Q' } } };
  load('pages/cabinet/index.js', { Page: value => spec = value, getApp: () => app, wx: {} });
  const patches = [], self = { data: {}, setData: patch => patches.push(patch) };
  spec.loadCabinet.call(self); spec.loadCabinet.call(self);
  assert.equal(patches.length, 1);
  app.globalData.manualAlbums[0].cover = 'https://example.test/b.jpg';
  spec.loadCabinet.call(self); assert.equal(patches.length, 2);
  assert.equal(patches[1].deckAlbums[0].cover, app.globalData.manualAlbums[0].cover);
  app.globalData.userId = 'other'; app.globalData.collectionItems = [];
  spec.loadCabinet.call(self); assert.equal(patches[2].deckAlbums.length, 0);
});

test('gallery mounts at most seven cards while preserving the full native scroll extent', () => {
  const motion = load('ui/gallery-motion.js');
  for (const width of [320, 375, 390, 430]) {
    const {card, pitch} = motion.geometry(width);
    for (const count of [0, 3, 6, 394]) {
      const slides = Array.from({length: count}, (_,i) => ({slideKey:i, id:String(i)}));
      for (let active=0; active<Math.max(1,count); active++) {
        const window = motion.window(slides, active, pitch);
        assert.ok(window.visibleSlides.length<=7);
        assert.equal(window.visibleSlides.find(row=>row.slideKey===active), slides[active]);
        const rendered = window.visibleSlides.reduce((n,row)=>n+card+(row.slideKey===count-1?0:22),0);
        assert.equal(window.windowBefore+rendered+window.windowAfter, Math.max(0,count*pitch-22));
      }
    }
  }
});

test('space switches ignore duplicate taps until navigation completes and recover from failure', () => {
  const navigation = load('ui/space-navigation.js');
  const requests=[], notices=[], api={navigateTo:o=>requests.push(o),showToast:o=>notices.push(o.title)};
  const pages=[{route:'pages/cabinet/index',data:{uiTab:'stats'}}];
  navigation.switchSpace('vinyl',api,pages); assert.equal(requests.length,0);
  navigation.switchSpace('live',api,pages); navigation.switchSpace('live',api,pages);
  assert.equal(requests.length,1); assert.match(requests[0].url,/\?tab=stats$/);
  requests[0].fail(); requests[0].complete();
  navigation.switchSpace('live',api,pages); assert.equal(requests.length,2); assert.equal(notices.length,1);
  requests[1].complete();
  navigation.switchSpace('live',api,pages); assert.equal(requests.length,3);
});

test('switching back keeps the original 388-card host and its visited pane alive',()=>{
 const navigation=load('ui/space-navigation.js');let navigationCount=0;const tabs=[];
 const host={route:'pages/cabinet/index',uiPrimary:tab=>tabs.push(tab)};
 const pages=[host,{route:'packages/live-archive/pages/index/index',data:{tab:'stats'}}];
 const api={navigateBack(o){navigationCount++;assert.equal(o.delta,1);o.success();o.complete();},navigateTo(){assert.fail('must reuse existing host');},redirectTo(){assert.fail('must not destroy host');},showToast(){assert.fail('unexpected failure');}};
 navigation.switchSpace('vinyl',api,pages);
 assert.equal(navigationCount,1);assert.deepEqual(tabs,['stats']);assert.equal(pages[0],host);
});
