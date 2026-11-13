"""Expose existing full-collection shares beside statistics snapshots."""
rel='components/stats-board/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8')
row='''<block wx:if="{{!readOnly}}"><button class="share-choice" wx:if="{{collectionShareReady}}" open-type="share" data-scope="all"><image class="ico" src="/assets/ui/share.svg"/><view><text>{{kind==='live'?'分享全部演出集收藏链接页面':'分享全部唱片柜收藏链接页面'}}</text><text>与添加页的全部收藏一致</text></view><text>›</text></button><button class="share-choice" wx:else bindtap="prepareCollectionShare" loading="{{collectionPreparing}}" disabled="{{collectionPreparing}}"><image class="ico" src="/assets/ui/share.svg"/><view><text>{{kind==='live'?'分享全部演出集收藏链接页面':'分享全部唱片柜收藏链接页面'}}</text><text>点击准备完整收藏分享</text></view><text>›</text></button></block>'''
needle='<block wx:elif="{{panel===\'share\'}}">'
assert needle in s
write(rel,s.replace(needle,needle+row,1))
edit('components/collection-deck/index.wxss',lambda s:s+'\n.deck-quantities{display:flex;flex-wrap:wrap;gap:4px 14px;line-height:1.5}\n')

rel='pages/stats/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s="const {requireCloudAccount}=require('../../services/cloud-session');\n"+s
s=s.replace('  data: {','''  async uiCollectionShare(e){
    if(this.uiReadOnly||this.data.uiReadOnly||this.data.uiCollectionPreparing)return;
    const app=getApp();
    const ready=()=>!!(app.isCloudAccountReady?.()&&app.globalData.userId);
    this.setData({uiCollectionShareReady:ready()});
    if(e.detail.passive||ready())return;
    this.setData({uiCollectionPreparing:true});
    try{await requireCloudAccount(app);this.setData({uiCollectionShareReady:ready()});}
    catch(e){wx.showToast({title:'请先在我的页面登录',icon:'none'});}
    finally{this.setData({uiCollectionPreparing:false});}
  },
  data: {uiCollectionShareReady:false,uiCollectionPreparing:false,''',1)
s=s.replace('  onShareAppMessage() {','''  onShareAppMessage(event) {
    if(event?.target?.dataset?.scope==='all'&&!this.uiReadOnly&&!this.data.uiReadOnly){
      const app=getApp(),owner=app.isCloudAccountReady?.()?app.globalData.userId:'';
      return createShareMessage(owner?{title:(app.globalData.userProfile?.name||'音乐收藏者')+'的全部唱片收藏',path:'/pages/all-collection/index?ownerId='+encodeURIComponent(owner)}:{});
    }''',1)
s=s.replace('uiOwner:snap.owner,','uiOwner:snap.owner,uiAvatar:snap.avatar||"",')
write(rel,s)
edit('pages/stats/index.wxml',lambda s:s.replace('<stats-board ', '<stats-board avatar="{{uiAvatar}}" collection-share-ready="{{uiCollectionShareReady}}" collection-preparing="{{uiCollectionPreparing}}" bindcollectionshare="uiCollectionShare" ',1))

rel='packages/live-archive/pages/index/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('  uiShare(e)', '''  uiCollectionShare(e){if(this.data.shared)return;if(!account.profile().loggedIn){if(!e.detail.passive)account.open();return;}return this.prepareAllShare();},
  uiShare(e)''',1)
s=s.replace('    if(this.data.tab==="stats"&&this.uiStatsShare)', '''    if(event?.target?.dataset?.scope==='all'&&!this.token)return account.message(this.allShareOwner===state.ownerKey?this.allShareToken:'',false);
    if(this.data.tab==="stats"&&this.uiStatsShare)''',1)
write(rel,s)
edit('packages/live-archive/pages/index/index.wxml',lambda s:s.replace('<stats-board ', '<stats-board avatar="{{shared ? null : account.avatar}}" collection-share-ready="{{allShareReady}}" collection-preparing="{{preparingAllShare}}" bindcollectionshare="uiCollectionShare" ',1))
