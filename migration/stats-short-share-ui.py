"""Keep native share routes bounded; read through existing public collections."""
rel='components/stats-board/index.js'
s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('properties:{visible:', "properties:{shareSource:{type:Object,value:null},visible:", 1)
s=s.replace("observers:{", "observers:{'shareSource':function(){if(['share','timelineShare'].includes(this.data.panel))this.openLink(this.data.panel==='timelineShare'?'timeline':'stats',true);},", 1)
s=s.replace("openShare(){this.openLink();this.setData", "openShare(){this.openLink('stats',true);this.setData", 1)
s=s.replace("openLink(scope='stats'){this.setData({sharePath:''});try{", "openLink(scope='stats',quiet=false){this.setData({sharePath:'',shareError:''});this.triggerEvent('snapshot',{message:null});try{", 1)
s=s.replace('mediaShare:this.data.mediaShare}', 'mediaShare:this.data.mediaShare,source:this.data.shareSource||undefined}', 1)
s=s.replace("catch(e){uiLocale.toast(wx,{title:e.message,icon:'none'});}},\n    openTimelineShare", "catch(e){this.setData({shareError:e.message});if(!quiet)uiLocale.toast(wx,{title:e.message,icon:'none'});}},\n    openTimelineShare", 1)
s=s.replace("openTimelineShare(){this.openLink('timeline');this.setData({panel:'timelineShare',panelTitle:'分享时间线'});}", "openTimelineShare(){this.openLink('timeline',true);this.setData({panel:'timelineShare',panelTitle:'分享时间线'});if(!this.data.readOnly)this.triggerEvent('collectionshare',{passive:true});}", 1)
write(rel,s)
rel='components/stats-board/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('<block wx:elif="{{panel===\'share\'}}">', '<block wx:elif="{{panel===\'share\'}}"><view wx:if="{{shareError}}" class="n-view muted">{{shareError}}</view>',1)
s=s.replace('<block wx:elif="{{panel===\'timelineShare\'}}">', '<block wx:elif="{{panel===\'timelineShare\'}}"><view wx:if="{{shareError}}" class="n-view muted">{{shareError}}</view><button wx:if="{{shareError&&!readOnly}}" class="n-button secondary" bindtap="prepareCollectionShare" loading="{{collectionPreparing}}" disabled="{{collectionPreparing}}">{{i18n.t(\'点击准备完整收藏分享\',uiLanguage)}}</button>',1)
s=s.replace("i18n.t('分享当前统计快照',uiLanguage)", "i18n.t('分享当前统计页面',uiLanguage)")
write(rel,s)

rel='pages/stats/index.js'
s=(DEST/rel).read_text(encoding='utf-8')
start=s.index('  onLoad(options) {')
end=s.index('  uiSelect(e)',start)
s=s[:start]+'''  async onLoad(options={}) {
    if(!options.uiRef&&!options.uiSnapshot)return;
    this.uiReadOnly=true;
    this.uiStatsShare=null;
    this.setData({uiReadOnly:true,uiShareLoading:true,uiShareError:'',uiRecords:[]});
    try{
      const snap=options.uiRef?await uiSnapshot.readReference(options.uiRef):uiSnapshot.decode(options.uiSnapshot);
      if(this.uiDisposed)return;
      this.setData({uiRecords:snap.records,uiKind:snap.kind,uiOwner:snap.owner,uiAvatar:snap.avatar||'',uiReadOnly:true,uiShareSource:snap.source||null,uiSnapshotOptions:snap});
      try{this.uiStatsShare=uiSnapshot.message(snap);}catch(e){this.uiStatsShare=null;}
      if(!options.uiRef){
        const media=require('../../ui/stats-share-media');
        media.hydrate(snap,media.readShared).then(uiRecords=>{if(!this.uiDisposed)this.setData({uiRecords});}).catch(()=>{});
      }
    }catch(e){if(!this.uiDisposed)this.setData({uiShareError:'分享暂不可用，请稍后重试',uiStatsShare:null});}
    finally{if(!this.uiDisposed)this.setData({uiShareLoading:false});}
  },
  uiRetryShare(){return this.onLoad(this.options||{});},
''' + s[end:]
s=s.replace('uiCollectionShareReady:ready()', "uiCollectionShareReady:ready(),uiShareSource:ready()?{ownerId:app.globalData.userId}:null")
s=s.replace('uiRecords:[],uiOwner:', 'uiShareSource:null,uiShareLoading:false,uiShareError:"",uiRecords:[],uiOwner:', 1)
s=s.replace('const view={uiRecords:', 'const view={uiShareSource:app.isCloudAccountReady?.()&&app.globalData.userId?{ownerId:app.globalData.userId}:null,uiRecords:',1)
s=s.replace('this.uiStatsSignature=signature;', 'this.uiStatsSignature=signature;this.uiStatsShare=null;',1)
write(rel,s)
# The home statistics pane is generated earlier in the build. Keep its controller
# and bindings synchronized with the standalone receiving page.
pane=s.replace('Page(uiLocale.page({', "require('../../ui/primary-pane')({",1)
pane,n=re.subn(r'\},"统计"\)\);\s*$', '});\n',pane)
assert n==1
write('pages/stats/pane.js',pane)
rel='pages/stats/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('<stats-board ', '<view wx:if="{{uiShareLoading||uiShareError}}" class="ui-guide-hint"><text>{{uiShareLoading?\'正在读取分享…\':uiShareError}}</text><button wx:if="{{uiShareError}}" bindtap="uiRetryShare">{{i18n.t(\'重试\',uiLanguage)}}</button></view><stats-board wx:else share-source="{{uiShareSource}}" ',1)
write(rel,s)
pane_markup=re.sub(r'<(?:bottom-nav|page-meta)\b[^>]*/>','',s)
write('pages/stats/pane.wxml',pane_markup.replace('<stats-board ', '<stats-board visible="{{visible}}" ',1))

rel='packages/live-archive/pages/index/index.js'
s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('uiStatsRecords:[],uiShareToken:', 'uiStatsShareSource:null,uiStatsRecords:[],uiShareToken:',1)
s=s.replace('this.setData({ allShareReady: true });', "this.setData({ allShareReady: true,uiStatsShareSource:{token} });",1)
s=s.replace('this.allShareToken = "";\n    this.setData', 'this.allShareToken = "";\n    this.uiStatsShare=null;\n    this.setData',1)
s=s.replace('allShareReady: false, preparingAllShare: true', 'allShareReady: false, preparingAllShare: true,uiStatsShareSource:null',1)
s=s.replace('if (this.allShareOwner === owner && this.allShareToken) return;', 'if (this.allShareOwner === owner && this.allShareToken){this.setData({uiStatsShareSource:{token:this.allShareToken}});return;}',1)
s=s.replace('  calc() {', '  calc() {\n    this.uiStatsShare=null;',1)
s=s.replace('uiStatsRecords: uiStats.liveRecords(this.data.records),', "uiStatsShareSource:this.token?{token:this.token}:account.profile().loggedIn&&state.ownerKey&&this.allShareOwner===state.ownerKey&&this.allShareToken?{token:this.allShareToken}:null,uiStatsRecords: uiStats.liveRecords(this.data.records),",1)
write(rel,s)
rel='packages/live-archive/pages/index/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8').replace('<stats-board ', '<stats-board share-source="{{uiStatsShareSource}}" ',1)
write(rel,s)
