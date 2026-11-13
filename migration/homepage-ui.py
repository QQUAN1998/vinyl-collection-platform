"""Homepage-only presentation/navigation, applied after the existing 1.2 UI."""
for page in ['pages/cabinet/index','packages/live-archive/pages/index/index']:
    config=json.loads((DEST/(page+'.json')).read_text(encoding='utf-8'))
    config['usingComponents']['home-dock']='/components/home-dock/index'
    write(page+'.json',json.dumps(config,ensure_ascii=False,indent=2))

path='pages/cabinet/index.wxml'
markup=(DEST/path).read_text(encoding='utf-8')
a=markup.index('  <view wx:if="{{collectionCount}}"');b=markup.index('<view class="album-card-modal',a)
markup=markup[:a]+markup[b:]
markup=markup.replace('  <space-header avatar="{{deckAvatar}}"/>\n','')
markup=markup.replace('cabinet-screen {{themeClass}}','cabinet-screen home-gallery {{themeClass}}')
markup=markup.replace('owner="{{deckOwner}}"','owner="{{deckOwner}}" avatar="{{deckAvatar}}"').replace('bindselect="openAlbum"','bindselect="openHomeAlbum"')
markup=markup.replace('<bottom-nav active="cabinet" />','<home-dock/>')
write(path,markup)
path='pages/cabinet/index.js';script=(DEST/path).read_text(encoding='utf-8')
script=script.replace('  openUiAccount() {','  openHomeAlbum(event) { const id=event.detail.id; if(this.data.deckAlbums.some(row=>row.id===id))wx.navigateTo({url:"/pages/album-detail/index?albumId="+id}); },\n  openUiAccount() {',1)
# Only the gallery projection crosses the rendering bridge. Full records and
# mutation/TV/share payloads remain in the existing app services unchanged.
a=script.index('    this.setData({\n      userLabel:');b=script.index('    // New UI has no daily recommendation',a)
script=script[:a]+'''    this.setData({
      collectionCount: liveCollectionItems.length,
      deckAlbums: collectedAlbums.map(({id,title,artist,cover,coverUrl,year})=>({id,title,artist,cover,coverUrl,year})),
      deckCollections: liveCollectionItems.map(({albumId,collectionDate,price,quantity})=>({albumId,collectionDate,price,quantity})),
      deckOwner: app.globalData.userProfile?.name || "",
      deckAvatar: app.globalData.userProfile?.avatar || ""
    });
'''+script[b:]
write(path,script)
css='pages/cabinet/index.wxss'
write(css,(DEST/css).read_text(encoding='utf-8')+'\n.screen.cabinet-screen.home-gallery{padding:0!important;min-height:100vh;box-sizing:border-box;overflow-x:hidden}')

path='packages/live-archive/pages/index/index.wxml';markup=(DEST/path).read_text(encoding='utf-8')
markup=markup.replace('<view class="page">','<view class="page {{tab===\'home\'&&!shared?\'home-gallery\':\'\'}}">',1)
markup=markup.replace("{{tab!=='mine'&&!shared}}","{{tab!=='mine'&&tab!=='home'&&!shared}}",1)
markup=markup.replace('<block wx:if="{{tab===\'home\'}}">','<block wx:if="{{tab===\'home\'||tab===\'collection\'}}">',1)
markup=markup.replace('<collection-deck kind="live"','<collection-deck wx:if="{{tab===\'home\'}}" kind="live"',1)
markup=markup.replace('owner="{{shared?\'\':account.name||\'\'}}"','owner="{{shared?\'\':account.name||\'\'}}" avatar="{{account.avatar||\'\'}}"',1)
markup=markup.replace('<view wx:if="{{uiSeenCount}}" class="catalog">','<view wx:if="{{tab===\'collection\'}}" class="catalog"><view class="ui-page-title">全部演出 <text class="muted">{{uiSeenCount}} 场收藏</text></view>',1)
markup=markup.replace('<view wx:if="{{!shared}}" class="bottom-nav">','<home-dock wx:if="{{tab===\'home\'&&!shared}}" kind="live"/><view wx:if="{{!shared&&tab!==\'home\'}}" class="bottom-nav">',1)
write(path,markup)
path='packages/live-archive/pages/index/index.js';script=(DEST/path).read_text(encoding='utf-8')
script=script.replace('    this.token = options.share || "";','    this.token = options.share || "";\n    const tab=this.token?"collection":(["collection","stats","add"].includes(options.tab)?options.tab:"home");\n    this.setData({tab});',1)
script=script.replace('    const tab = e.currentTarget.dataset.id;','    const tab = e.currentTarget.dataset.id;\n    if(tab==="home"&&this.options?.tab){wx.navigateBack();return;}',1)
write(path,script)
css='packages/live-archive/pages/index/index.wxss'
write(css,(DEST/css).read_text(encoding='utf-8')+'\n.page.home-gallery{display:block;padding:0!important;min-height:100vh;box-sizing:border-box;overflow-x:hidden}.home-gallery .loading,.home-gallery .notice{margin:0 24px}.catalog .ui-page-title{display:flex;align-items:baseline;justify-content:space-between;margin:8px 0 24px}')

# Old assertions about the now-relocated inline catalogue belong to all-collection.
path='tests/miniprogram-static.test.js';test=(DEST/path).read_text(encoding='utf-8')
a=test.index('  for (const text of ["我的收藏", "catalogSearch"');b=test.index('  for (const text of ["album-card-modal"',a)
test=test[:a]+'''  assert.ok(cabinetMarkup.includes("home-dock"));
  assert.ok(cabinetMarkup.includes("collection-deck"));
  assert.doesNotMatch(cabinetMarkup, /catalogSearch|bottom-nav/);
'''+test[b:]
test=test.replace('assert.ok(cabinetMarkup.includes("album-tile-title"), "home catalog uses cover-first album tiles");','assert.ok(allCollectionMarkup.includes("all-album-title"), "all collection keeps cover-first tiles");')
test=test.replace('assert.ok(cabinetMarkup.includes("catalog-sticky-tools"), "home catalog search tools stay grouped for sticky scrolling");','assert.ok(allCollectionMarkup.includes("collection-search-tools"), "catalogue search remains on the collection page");')
write(path,test)
test=test.replace('for (const markup of [cabinetMarkup, allCollectionMarkup, archiveMarkup, detailMarkup])', 'for (const markup of [allCollectionMarkup, archiveMarkup, detailMarkup])')
write(path,test)
