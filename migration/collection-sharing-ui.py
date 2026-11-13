"""Collection sharing entry points and a compact, consistent catalogue layout."""
write('ui/collection-catalog.wxss',(UI/'collection-catalog.wxss').read_text(encoding='utf-8'))
share_icon='<image src="/assets/ui/share.svg"/>'
rel='pages/all-collection/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
a=s.index('  <view class="screen-header">');b=s.index('  <view class="collection-search-tools">',a)
s=s[:a]+'''  <space-header wx:if="{{canManageCollection}}" kind="vinyl" avatar="{{uiCatalogAvatar||''}}"/>
  <view class="ui-catalog-head"><view class="ui-catalog-heading"><view class="ui-catalog-title">全部唱片</view><text class="ui-catalog-count">{{canManageCollection?stats.albumCount+' 张收藏':userName+' 的唱片柜'}}</text></view><block wx:if="{{canManageCollection}}"><button wx:if="{{uiShareReady}}" class="ui-catalog-share" open-type="share" disabled="{{!collectedAlbums.length||batchDeleteMode}}" aria-label="分享全部唱片"><image src="/assets/ui/share.svg"/>分享</button><button wx:else class="ui-catalog-share" bindtap="uiPrepareShare" loading="{{uiPreparingShare}}" disabled="{{uiPreparingShare}}" aria-label="准备分享全部唱片"><image src="/assets/ui/share.svg"/>分享</button></block></view>
  <view wx:if="{{uiSharedError}}" class="ui-share-unavailable">收藏暂时不可用<button bindtap="loadCollection">重试</button></view>
''' +s[b:]
s=s.replace('<view class="search-box collection-search-box">','<view class="search-box collection-search-box ui-catalog-search"><image src="/assets/ui/search.svg"/>',1)
s=s.replace('<text class="ui-catalog-count">{{canManageCollection?', '<text class="ui-catalog-count {{canManageCollection?\'\':\'ui-shared-owner\'}}">{{canManageCollection?',1)
s=re.sub(r'      <view wx:else class="search-action"[^>]*>\s*<image[^>]+/>\s*</view>','',s,count=1)
a=s.index('      <view class="search-entry"') if '      <view class="search-entry"' in s else -1
# The existing search action only repeated the same search input event.
if a>=0:
    b=s.index('      </view>',a)+len('      </view>');s=s[:a]+s[b:]
s=s.replace('    <view wx:if="{{canManageCollection && collectedAlbums.length}}" class="batch-toolbar">','    <view class="ui-catalog-results"><text>{{query?visibleAlbums.length+\' / \':\'\'}}{{collectedAlbums.length}} 张唱片</text><view wx:if="{{canManageCollection && collectedAlbums.length}}" class="batch-toolbar">',1)
at=s.index('    <view class="all-album-list"');s=s[:at]+'    </view>\n'+s[at:]
s=s.replace('src="{{item.cover}}" mode="aspectFill"','src="{{item.cover}}" mode="aspectFill" lazy-load',1)
s=s.replace("'添加唱片后会在这里生成可分享清单。'","'添加第一张唱片'")
write(rel,s)
edit('pages/all-collection/index.wxss',lambda s:s+'\n@import "../../ui/collection-catalog.wxss";\n')
cfg=json.loads((DEST/'pages/all-collection/index.json').read_text(encoding='utf-8'));cfg.setdefault('usingComponents',{})['space-header']='/components/space-header/index';write('pages/all-collection/index.json',json.dumps(cfg,ensure_ascii=False,indent=2))

rel='pages/all-collection/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('  data: {','''  async uiPrepareShare(){
    if(this.data.uiPreparingShare||!this.data.canManageCollection)return;
    this.setData({uiPreparingShare:true});
    try{const app=getApp(),me=await requireCloudAccount(app);if(me&&app.globalData.userId){this.loadLocalCollection();this.setData({uiShareReady:true});wx.showToast({title:'已就绪，点击分享',icon:'none'});}}catch(e){wx.showToast({title:'请先在我的页面登录',icon:'none'});}finally{this.setData({uiPreparingShare:false});}
  },
  data: {uiShareReady:false,uiPreparingShare:false,uiSharedError:false,uiCatalogAvatar:"",''',1)
s=s.replace('    this.setData({\n      userName: showcase.userName,','    this.setData({\n      uiCatalogAvatar:getApp().globalData.userProfile?.avatar||"",\n      uiShareReady:!!(this.data.canManageCollection&&getApp().isCloudAccountReady()&&getApp().globalData.userId),\n      userName: showcase.userName,',1)
s=s.replace('      if (!payload) {\n        this.loadLocalCollection();\n        return;\n      }','      if (!payload) {\n        this.renderCollection([],[],{name:"收藏暂时不可用"});\n        this.setData({uiSharedError:true});\n        return;\n      }\n      this.setData({uiSharedError:false});',1)
s=s.replace('const ownerId = encodeURIComponent(app.globalData.userId || "");','const ownerId = encodeURIComponent(this.data.ownerId || app.globalData.userId || "");',1)
s=s.replace('url: `/pages/album-detail/index?albumId=${albumCard.id}`','url: `/pages/album-detail/index?albumId=${albumCard.id}${this.data.ownerId?"&ownerId="+encodeURIComponent(this.data.ownerId):""}`',1)
write(rel,s)

rel='packages/live-archive/pages/index/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
old='<view class="ui-page-title">全部演出 <text class="muted">{{uiSeenCount}} 场收藏</text></view>'
head='''<view class="ui-catalog-head"><view class="ui-catalog-heading"><view class="ui-catalog-title">全部演出</view><text class="ui-catalog-count">{{count}} 场收藏</text></view><block wx:if="{{!shared}}"><button wx:if="{{allShareReady}}" class="ui-catalog-share" open-type="share" data-scope="all" disabled="{{!count||busy}}" aria-label="分享全部演出"><image src="/assets/ui/share.svg"/>分享</button><button wx:else class="ui-catalog-share" bindtap="prepareAllShare" loading="{{preparingAllShare}}" disabled="{{!count||busy||preparingAllShare}}" aria-label="准备分享全部演出"><image src="/assets/ui/share.svg"/>分享</button></block></view>'''
s=s.replace(old,head,1)
s=s.replace('<input placeholder="搜索演出、艺人、城市" value="{{query}}" bindinput="search" class="search" aria-label="搜索收藏"/>','<view class="ui-catalog-search"><image src="/assets/ui/search.svg"/><input placeholder="搜索演出、艺人、城市" value="{{query}}" bindinput="search" aria-label="搜索收藏"/></view>',1)
s=s.replace('      <view class="{{view===\'grid\'?\'poster-grid\':\'ticket-list\'}}">','      <view class="ui-catalog-results"><text>{{query?filtered.length+\' / \':\'\'}}{{count}} 场演出</text></view>\n      <view class="{{view===\'grid\'?\'poster-grid\':\'ticket-list\'}}">',1)
write(rel,s)
edit('packages/live-archive/pages/index/index.wxss',lambda s:s+'\n@import "../../../../ui/collection-catalog.wxss";\n')
rel='packages/live-archive/pages/index/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('this.update(state.records);this.setData({account:account.profile(),busy:false});return Promise.resolve();','this.update(state.records);this.setData({account:account.profile(),busy:false});if(this.data.tab==="collection")this.prepareAllShare();return Promise.resolve();',1)
s=s.replace('this.data.tab === "add") await this.prepareAllShare();','["add","collection"].includes(this.data.tab)) await this.prepareAllShare();',1)
s=s.replace('this.setData({ filtered: rows.filter(record => record.status === "已看过") });','this.setData({ filtered: this.data.tab==="collection"?rows:rows.filter(record => record.status === "已看过") });',1)
s=s.replace('this.setData({ tab: "home", query: "", status: "全部",','this.setData({ tab: "collection", query: "", status: "全部",',1)
s=s.replace('event?.target?.dataset?.scope === "all"','(this.data.tab==="collection"||event?.target?.dataset?.scope === "all")',1)
write(rel,s)

# Shared detail data stays on this page, separate from the viewer's own collection.
rel='pages/album-detail/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('    album: null,','    uiSharedOwnerId:"",\n    album: null,',1)
s=s.replace('    this.loadAlbumDetail(options.albumId || featuredAlbumId);','''    const id=options.albumId||featuredAlbumId;
    if(options.ownerId){this.setData({uiSharedOwnerId:options.ownerId});app.loadSharedCloudCollection(options.ownerId).then(payload=>{if(!payload)return;this.uiSharedPayload=payload;this.loadAlbumDetail(id);});}
    else this.loadAlbumDetail(id);''',1)
s=s.replace('    const sourceAlbums = mergeAlbumLibraries(\n      albums,\n      app.globalData.manualAlbums || [],\n      app.globalData.recommendationAlbums || []\n    );\n    const liveCollectionItems = app.globalData.collectionItems || collectionItems;','''    const shared=this.data.uiSharedOwnerId;
    if(shared&&!this.uiSharedPayload)return;
    const sourceAlbums=shared?mergeAlbumLibraries(albums,this.uiSharedPayload.manualAlbums||[]):mergeAlbumLibraries(albums,app.globalData.manualAlbums||[],app.globalData.recommendationAlbums||[]);
    const liveCollectionItems=shared?this.uiSharedPayload.collectionItems:(app.globalData.collectionItems||collectionItems);''',1)
s=s.replace('  openEdit() {','  openEdit() {\n    if(this.data.uiSharedOwnerId)return;',1)
s=s.replace('  addToCollection() {','  addToCollection() {\n    if(this.data.uiSharedOwnerId)return;',1)
s=s.replace('const name = app.globalData.userProfile?.name ||','const name = this.uiSharedPayload?.owner?.displayName || app.globalData.userProfile?.name ||',1)
s=s.replace('path: `/pages/album-detail/index?albumId=${album.id}`,','path: this.data.uiSharedOwnerId?`/pages/all-collection/index?ownerId=${encodeURIComponent(this.data.uiSharedOwnerId)}`:`/pages/album-detail/index?albumId=${album.id}`,',1)
write(rel,s)
edit('pages/album-detail/index.wxml',lambda s:s.replace('wx:if="{{collectionItem}}" class="detail-actions"','wx:if="{{collectionItem&&!uiSharedOwnerId}}" class="detail-actions"',1).replace('wx:else class="notice detail-collection-notice"','wx:elif="{{!collectionItem&&!uiSharedOwnerId}}" class="notice detail-collection-notice"',1))
