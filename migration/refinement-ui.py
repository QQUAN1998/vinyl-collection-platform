"""1.2.4: circular gallery, plain artwork, fixed navigation and detail sheets."""

# A single line is shared by vinyl and live captions.
rel='components/collection-deck/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace("Hi, {{owner||'你好'}}","{{owner||'我'}}的{{kind==='live'?'演出集':'唱片柜'}}")
s=s.replace('wx:for="{{cards}}" wx:key="id"','wx:for="{{slides}}" wx:key="slideKey"')
s=s.replace('bindtouchmove="touchMove"','bindtouchmove="touchMove" bindtouchend="touchEnd" bindtouchcancel="touchEnd"')
s=s.replace("discId===item.id","discMode&&kind!=='live'")
s=s.replace("index===cards.length-1","index===slides.length-1")
s=s.replace("index>=active-3&&index<=active+3","index>=physical-3&&index<=physical+3")
s=s.replace("{{kind==='live'?'background:'+(posterTones[item.id]||'#636e67')+';':'height:'+cardSize+'px;'}}","{{kind==='live'?'':'height:'+cardSize+'px;'}}")
s=s.replace('mode="{{kind===\'live\'?\'aspectFit\':\'aspectFill\'}}"','mode="aspectFit"')
s=re.sub(r'<view wx:if="\{\{kind===\'live\'\}\}" class="(?:n-view )?ticket-footer">.*?</view>','',s)
s=s.replace('<view wx:if="{{kind!==\'live\'}}" class="sleeve-gloss"/>','<view class="sleeve-gloss"/>')
write(rel,s)
edit('components/collection-deck/index.wxss',lambda s:s+'''
.deck-title{display:block;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-line-clamp:unset;font-weight:750}.deck-greeting{font-weight:750}.deck-caption{min-height:96px}.live-deck .deck-caption{padding:16px 32px 0;min-height:96px;gap:5px}.live-deck .deck-title{font-size:21px;line-height:1.35;font-weight:750}.live-deck .deck-artist{font-size:12px}.live-deck .deck-sequence{margin-top:12px}.live-deck .deck-stage{padding-top:22px}.live-deck .deck-scroll{height:calc(68vw + 52px);max-height:392px}.live-deck .ticket-art{height:calc(68vw);max-height:340px;aspect-ratio:auto;padding:0;background:transparent!important;border:0;border-radius:0;box-shadow:none;overflow:visible}.live-deck .ticket-art::before,.live-deck .ticket-art::after{display:none}.live-deck .art-picture{position:relative;inset:auto;width:100%;height:100%;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;overflow:visible}.live-deck .art-picture image{width:100%;height:100%;filter:drop-shadow(2px 2px 1px #0002) drop-shadow(0 12px 11px #171a173d)}.live-deck .sleeve-gloss{display:none}.live-deck .deck-pagination{padding-top:22px}.is-disc .deck-art{background:repeating-radial-gradient(circle,#171819 0px,#171819 1px,#2f3031 1.6px,#101112 2.7px),#111;box-shadow:inset 0 0 0 2px #444,inset 0 0 12px #000,0 14px 20px -11px #0009}.is-disc .sleeve-gloss{background:conic-gradient(from 20deg,#fff0,#ffffff28 32deg,#fff0 68deg,#fff0 170deg,#ffffff24 205deg,#fff0 242deg);box-shadow:inset 0 0 0 1px #7775}.is-disc .art-picture{width:36%;height:36%;left:32%;top:32%;box-shadow:0 0 0 9px #111,0 0 0 10px #7775}.disc-hole{background:#f5f6f2;box-shadow:0 0 0 2px #0c0d0d}
''')
edit('components/home-dock/index.wxss',lambda s:s+'''
.home-dock{z-index:90;height:calc(80px + env(safe-area-inset-bottom));min-height:80px;padding:12px 20px calc(12px + env(safe-area-inset-bottom));background:#f5f6f2}.dock-button.is-active{background:#171a17}.dock-button.is-active image{filter:invert(1)}
''')

# The same top line and bottom navigation occupy the same coordinates on each
# primary destination. redirectTo avoids the native horizontal push transition.
write('components/space-header/index.js', '''const {openFromHome}=require('../../ui/home-navigation');
Component({properties:{kind:{type:String,value:'vinyl'},avatar:{type:String,value:''}},data:{owner:''},lifetimes:{attached(){this.sync();}},pageLifetimes:{show(){this.sync();}},methods:{sync(){const p=getApp().globalData.userProfile||{};this.setData({owner:p.name||'我',avatar:this.data.avatar||p.avatar||''});},profile(){openFromHome('/pages/account/index',wx);}}});
''')
write('components/space-header/index.wxml','''<view class="space-header"><text class="space-owner">{{owner}}的{{kind==='live'?'演出集':'唱片柜'}}</text><button class="space-profile" bindtap="profile" aria-label="我的"><image wx:if="{{avatar}}" src="{{avatar}}" mode="aspectFill"/><image wx:else src="/assets/ui/nav-mine.svg" mode="aspectFit"/></button></view>''')
write('components/space-header/index.wxss',''':host{display:block;height:68px}.space-header{position:fixed;top:0;left:0;right:0;z-index:80;height:68px;box-sizing:border-box;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f5f6f2}.space-owner{font-size:28px;font-weight:750;line-height:1.25;letter-spacing:-1px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;min-width:0;flex:1}.space-profile{width:40px!important;height:40px!important;min-height:40px!important;min-width:40px!important;padding:0!important;margin:0!important;border:0;border-radius:50%;overflow:hidden;background:#edf0e8;display:flex;align-items:center;justify-content:center}.space-profile::after{border:0}.space-profile image{width:100%;height:100%}''')
cfg=json.loads((DEST/'components/bottom-nav/index.json').read_text(encoding='utf-8'));cfg.setdefault('usingComponents',{})['home-dock']='/components/home-dock/index';write('components/bottom-nav/index.json',json.dumps(cfg,ensure_ascii=False))
write('components/bottom-nav/index.wxml','<home-dock active="{{active===\'cabinet\'?\'home\':active}}"/>')
rel='packages/live-archive/pages/index/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
a=s.index('<home-dock wx:if=');b=s.index('<canvas',a)
s=s[:a]+'''<home-dock wx:if="{{!shared}}" kind="live" active="{{tab==='collection'?'add':tab}}"/>\n'''+s[b:]
write(rel,s)
rel='packages/live-archive/pages/index/index.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('  openAccount() { account.open(); },','''  uiPrimary(tab){if(!['home','add','stats'].includes(tab))return;this.setData({tab});this.filter();if(tab==='stats')this.calc();if(tab==='add')this.prepareAllShare();wx.pageScrollTo({scrollTop:0,duration:0});},
  openAccount() { account.open(); },''')
write(rel,s)

# Remove backing colour from every album/poster display, including edit forms.
edit('ui/collection-catalog.wxss',lambda s:s+'''
.ui-catalog-head{align-items:flex-start;position:relative;min-height:64px}.ui-catalog-share{align-self:flex-start;margin-top:0!important;height:38px!important;min-height:38px!important;line-height:38px!important}.ui-catalog-heading{padding-top:0}.ui-catalog-title{line-height:38px}.ui-catalog-share image{display:block;flex-shrink:0}.page .catalog .poster-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 12px}.page .catalog .poster{height:calc((100vw - 64px)*.45);padding:0;background:transparent!important;border:0;border-radius:0;box-shadow:none;overflow:visible}.page .catalog .poster image{filter:drop-shadow(0 5px 5px #171a1726)}.page .catalog .card-name{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;min-height:0;-webkit-line-clamp:unset}.page .catalog .card-meta{font-size:10px}.page .catalog .record-copy{padding-top:10px}
''')
edit('ui/live.wxss',lambda s:s+'''
.page .poster,.page .cover-preview{padding:0;background:transparent!important;border:0;box-shadow:none;border-radius:0;overflow:visible}.page .poster::before,.page .poster::after{display:none}.page .poster image,.page .cover-preview{filter:drop-shadow(0 10px 10px #171a1730)}.page .cover-preview{height:auto!important;max-width:150px;margin:12px 0}.page .hero .poster{padding:0;background:transparent!important;border-radius:0;box-shadow:none}.page .title,.page .card-name,.page .detail-artist{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}.page .hero .title{font-size:30px}.page.home-gallery{padding-top:0!important}
''')
edit('ui/pages.wxss',lambda s:s+'''
.detail-title,.edit-album-title,.all-album-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.edit-cover-block,.edit-cover{background:transparent!important;border:0;padding:0}.edit-cover{box-shadow:0 8px 14px -8px #171a1740}.ui-form-back{display:flex;align-items:center;gap:7px}.ui-form-back image{width:23px;height:23px}
''')
edit('packages/live-archive/pages/edit/edit.wxml',lambda s:s.replace('src="{{draft.cover||draft.posterUrl}}" mode="aspectFit"','src="{{draft.cover||draft.posterUrl}}" mode="widthFix"'))

# Full detail controllers become reusable components alongside their original
# routes, keeping all relative service imports and mutation handlers intact.
for page,depth,title in [('pages/album-detail/index','../../','专辑详情'),('packages/live-archive/pages/detail/detail','../../../../','现场详情')]:
    folder=page.rsplit('/',1)[0];src=(DEST/(page+'.js')).read_text(encoding='utf-8')
    src=src.replace('Page({',"require('"+depth+"ui/detail-component')({",1)
    src=src.replace('wx.navigateBack();','this.uiSheetClose();').replace('wx.navigateBack()','this.uiSheetClose()')
    src=src.replace('wx.navigateBack({ delta: 1 });','this.uiSheetClose();')
    write(folder+'/sheet.js',src)
    cfg=json.loads((DEST/(page+'.json')).read_text(encoding='utf-8'));cfg['component']=True;cfg['styleIsolation']='apply-shared'
    write(folder+'/sheet.json',json.dumps(cfg,ensure_ascii=False,indent=2))
    body=(DEST/(page+'.wxml')).read_text(encoding='utf-8')
    write(folder+'/sheet.wxml','''<view class="ui-sheet-nav"><button bindtap="uiSheetClose" aria-label="返回"><image src="/assets/ui/back.svg"/></button><text>'''+title+'''</text></view><scroll-view class="ui-detail-scroll" scroll-y enhanced bindscroll="uiSheetScroll">'''+body+'</scroll-view>')
    css=(DEST/(page+'.wxss')).read_text(encoding='utf-8')
    write(folder+'/sheet.wxss',css+'''
:host{display:block;height:100%;background:#f5f6f2}.ui-sheet-nav{height:52px;display:flex;align-items:center;justify-content:center;position:relative;background:#f5f6f2;font-size:15px;font-weight:650}.ui-sheet-nav button{position:absolute;left:16px;top:5px;width:42px!important;height:42px!important;min-height:42px!important;margin:0!important;padding:8px!important;border:0;background:transparent}.ui-sheet-nav button::after{border:0}.ui-sheet-nav image{width:26px;height:26px}.ui-detail-scroll{height:calc(100% - 52px);box-sizing:border-box}.ui-detail-scroll .ui-detail-page{animation:none;padding-top:12px!important}.ui-detail-scroll .screen{min-height:0}.ui-detail-scroll .hero .poster{background:transparent!important;padding:0;border-radius:0}.ui-detail-scroll .detail-title{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
''')

for page,kind in [('pages/cabinet/index','vinyl'),('pages/all-collection/index','vinyl'),('packages/live-archive/pages/index/index','live')]:
    rel=page+'.js';s=(DEST/rel).read_text(encoding='utf-8')
    s=s.replace('Page({','''Page({
  uiShowDetail(options){this.setData({uiDetailOptions:options,uiDetailOpen:true});},
  uiDismissDetail(){this.setData({uiDetailOpen:false});},
  uiDetailLeft(){this.setData({uiDetailOpen:false,uiDetailOptions:null});},
''',1)
    s=s.replace('  data: {','  data: {uiDetailOpen:false,uiDetailOptions:null,',1)
    refresh="this.filter();this.calc();" if kind=='live' else ('this.loadCabinet();' if page.startswith('pages/cabinet') else 'this.loadCollection();')
    s=s.replace('uiDetailOptions:null});},','uiDetailOptions:null});'+refresh+'},',1)
    if kind=='vinyl':
        if page.startswith('pages/cabinet'):
            s=re.sub(r'  openHomeAlbum\(event\) \{[^\n]+\},','  openHomeAlbum(event) {const albumId=event.detail.id;if(this.data.deckAlbums.some(row=>row.id===albumId))this.uiShowDetail({albumId});},',s)
        else:
            s=s.replace('    this.openAlbumCard(event);','    const albumId=event.currentTarget.dataset.albumId;if(albumId)this.uiShowDetail({albumId,...(this.data.ownerId?{ownerId:this.data.ownerId}:{})});',1)
    else:
        a=s.index('    wx.navigateTo({',s.index('  open(e) {'));b=s.index('\n  },',a)
        s=s[:a]+'''    if(record)this.uiShowDetail({id:record.id,shared:this.token?'1':'0'});'''+s[b:]
    # Forward native sharing to the visible detail controller when appropriate.
    s=re.sub(r'(  onShareAppMessage\([^)]*\) \{)',r'\1\n    if(this.data.uiDetailOpen){const detail=this.selectComponent("#uiDetail");if(detail?.onShareAppMessage)return detail.onShareAppMessage();}',s,count=1)
    write(rel,s)
    rel=page+'.wxml';s=(DEST/rel).read_text(encoding='utf-8')
    if page=='pages/all-collection/index':
        s+='\n<home-dock wx:if="{{canManageCollection}}" active="add"/>'
    s+='''\n<page-container show="{{uiDetailOpen}}" position="bottom" duration="280" overlay="{{true}}" bindbeforeleave="uiDismissDetail" bindafterleave="uiDetailLeft" custom-style="height:100%;background:#f5f6f2;"><detail-sheet wx:if="{{uiDetailOptions}}" id="uiDetail" options="{{uiDetailOptions}}" bindclose="uiDismissDetail"/></page-container>'''
    write(rel,s)
    cfg=json.loads((DEST/(page+'.json')).read_text(encoding='utf-8'));cfg['usingComponents']['detail-sheet']='/pages/album-detail/sheet' if kind=='vinyl' else '../detail/sheet';cfg['usingComponents']['home-dock']='/components/home-dock/index';write(page+'.json',json.dumps(cfg,ensure_ascii=False,indent=2))

edit('ui/detail-motion.js',lambda s:s.replace('&& getCurrentPages().length > 1','&& (this.uiInSheet || getCurrentPages().length > 1)').replace("setTimeout(()=>wx.navigateBack({fail:()=>this.setData({uiClosing:false,uiDragY:0,uiDetailOpacity:1})}),180);","setTimeout(()=>{if(this.uiInSheet)this.uiSheetClose();else wx.navigateBack({fail:()=>this.setData({uiClosing:false,uiDragY:0,uiDetailOpacity:1})});},180);"))

# Use the supplied icon artwork throughout app-owned actions.
for file in DEST.rglob('*.wxml'):
    s=file.read_text(encoding='utf-8')
    s=s.replace('>‹ 返回</button>','><image src="/assets/ui/back.svg"/>返回</button>')
    s=s.replace('/assets/icons/import-action.png','/assets/ui/upload.svg').replace('/assets/icons/export-action.png','/assets/ui/download.svg')
    s=re.sub(r'(>)(上传海报|上传封面|上传|编辑收藏|编辑现场|编辑)(</(?:button|view)>)',lambda m:m[1]+'<image class="ui-action-icon" src="/assets/ui/'+('upload' if m[2].startswith('上传') else 'edit')+'.svg"/>'+m[2]+m[3],s)
    write(file.relative_to(DEST).as_posix(),s)
edit('app.wxss',lambda s:s+'\n.ui-action-icon{display:inline-block;width:16px;height:16px;vertical-align:-2px;margin-right:6px}.primary-button .ui-action-icon,.detail-edit .ui-action-icon{filter:invert(1)}.ui-form-back{align-items:center;gap:7px}.ui-form-back image{width:23px;height:23px;flex-shrink:0}\n')
# Match the user-requested icon assets while retaining the original behavioral suite.
edit('tests/miniprogram-static.test.js',lambda s:s.replace('["import-action.png", "export-action.png", "share-action.png"]','["/assets/ui/upload.svg", "/assets/ui/download.svg", "share-action.png"]'))
