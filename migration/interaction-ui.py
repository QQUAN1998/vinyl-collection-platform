"""1.2.2 interaction refinements. Applied last to keep every build reproducible."""

def edit(rel, transform):
    write(rel,transform((DEST/rel).read_text(encoding='utf-8')))

edit('components/switch-cabinet/index.js',lambda _:'''const {switchSpace}=require('../../ui/space-navigation');
Component({properties:{current:{type:String,value:'vinyl'}},methods:{open(event){const space=event.currentTarget.dataset.space;if(space&&space!==this.properties.current)switchSpace(space,wx);}}});
''')

# A fixed full-width navigation surface also protects the bottom safe area.
edit('components/bottom-nav/index.wxss',lambda s:s+'''
.bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:80;min-height:78px;padding:8px 16px calc(8px + env(safe-area-inset-bottom));border-radius:0;border:0;border-top:1px solid #e3e7de;background:#f5f6f2;box-sizing:border-box}.bottom-nav-item{min-height:55px}
''')
edit('packages/live-archive/pages/index/index.wxss',lambda s:s+'''
.bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:80;min-height:78px;padding:8px 16px calc(8px + env(safe-area-inset-bottom));border:0;border-top:1px solid #e3e7de;border-radius:0;background:#f5f6f2;box-sizing:border-box}.bottom-nav>button{min-height:55px}.page{overflow-x:hidden}.page .ui-search-row{min-width:0}.page .ui-search-input{border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;height:44px!important;min-height:0!important;box-shadow:none!important}.page .ui-search{border:1px solid #e3e7de;background:#f5f6f2}.page .search{height:44px;border:1px solid #e3e7de;border-radius:18px;font-size:12px;padding:0 14px;background:#f5f6f2;box-sizing:border-box}.page .ui-method-tabs{width:100%;min-width:0;gap:6px}.page .ui-method{flex:1 1 0!important;width:0!important;min-width:0!important;max-width:none!important;white-space:nowrap;padding:10px 4px!important}.poster-grid .poster image{object-fit:contain}.page.home-gallery .loading{position:fixed;z-index:75;top:68px;right:24px;font-size:10px;background:#f5f6f2;padding:3px 8px;border-radius:12px}
''')
edit('ui/add.wxss',lambda s:s+'''
.ui-add .ui-search,.page .ui-search{border:1px solid #e3e7de;background:#f5f6f2}.ui-add .ui-search-input,.page .ui-search-input{border:0!important;border-radius:0!important;background:transparent!important;padding:0!important;height:44px!important;min-height:0!important;box-shadow:none!important}.ui-add .ui-search-row,.page .ui-search-row{min-width:0}.ui-add .ui-method-tabs{min-width:0}.ui-add .ui-method{min-width:0!important}
''')

rel='packages/live-archive/pages/index/index.js'
s=(DEST/rel).read_text(encoding='utf-8')
s="const uiSpace=require('../../../../ui/space-navigation');\n"+s
s=s.replace('if (!["search", "link"].includes(e.currentTarget.dataset.value)) return;', 'if (!["search", "link", "manual"].includes(e.currentTarget.dataset.value)) return;')
# Update in-memory records immediately on return. Skip only a successful, recent
# read for the same account; explicit pull-to-refresh always reaches the backend.
s=s.replace('  refresh() {','  refresh(force=false) {\n    const app=getApp();\n    if(force!==true&&!this.token&&account.profile().loggedIn&&state.ownerKey&&uiSpace.recent("live",app)){this.update(state.records);this.setData({account:account.profile(),busy:false});return Promise.resolve();}',1)
s=s.replace('await this.refresh();\n    wx.stopPullDownRefresh();','await this.refresh(true);\n    wx.stopPullDownRefresh();')
s=s.replace('        this.loaded = true;','        this.loaded = true;\n        if(!this.token)uiSpace.mark("live",app);',1)
write(rel,s)
edit('packages/live-archive/pages/index/index.wxml',lambda s:s.replace('大麦链接</button>','大麦搜索</button>').replace('>大麦链接</view>','>大麦搜索</view>').replace('mode="aspectFill" lazy-load/><block wx:else>','mode="aspectFit" lazy-load/><block wx:else>'))
edit('packages/live-archive/pages/edit/edit.wxml',lambda s:s.replace('value="{{draft.date}}"','value="{{draft.date||\'\'}}"'))
edit('components/date-field/index.js',lambda s:s.replace('displayDate:value.replace','displayDate:String(value||\'\').replace'))

rel='pages/cabinet/index.js'
s=(DEST/rel).read_text(encoding='utf-8')
s="const uiSpace=require('../../ui/space-navigation');\n"+s
s=s.replace('if (typeof app.loadCloudCollection === "function") {','if (typeof app.loadCloudCollection === "function" && !uiSpace.recent("vinyl",app)) {',1)
s=s.replace('        if (payload) {\n          this.loadCabinet();','        if (payload) {\n          uiSpace.mark("vinyl",app);\n          this.loadCabinet();',1)
# The gallery still projects local records on every show, including saves/edits.
write(rel,s)

# Add a cover gesture without replacing the original detail page or its handlers.
for page,depth in [('pages/album-detail/index','../../'),('packages/live-archive/pages/detail/detail','../../../../')]:
    rel=page+'.js';s=(DEST/rel).read_text(encoding='utf-8')
    s="const uiDetailMotion=require('"+depth+"ui/detail-motion');\n"+s
    s=s.replace('Page({','Page({\n  ...uiDetailMotion,',1)
    s=s.replace('  data: {','  data: {\n    uiDragY:0,uiDetailOpacity:1,uiClosing:false,',1)
    write(rel,s)
    rel=page+'.wxml';s=(DEST/rel).read_text(encoding='utf-8')
    if page.startswith('pages/'):
        s=s.replace('class="screen detail-screen {{themeClass}}" style="{{themeStyle}}"','class="screen detail-screen ui-detail-page {{uiClosing?\'ui-closing\':\'\'}} {{themeClass}}" style="{{themeStyle}};transform:translateY({{uiDragY}}px);opacity:{{uiDetailOpacity}};"',1)
        s=s.replace('<image class="detail-cover" src="{{album.cover}}" mode="aspectFit" />','<view class="ui-detail-cover" bindtouchstart="uiCoverStart" catchtouchmove="uiCoverMove" bindtouchend="uiCoverEnd" bindtouchcancel="uiCoverCancel"><image class="detail-cover" src="{{album.cover}}" mode="aspectFit"/><view class="ui-cover-gloss"/></view>')
    else:
        s=s.replace('<view class="page">','<view class="page ui-detail-page {{uiClosing?\'ui-closing\':\'\'}}" style="transform:translateY({{uiDragY}}px);opacity:{{uiDetailOpacity}};">',1)
        s=s.replace('<view class="poster theme-{{record.theme}}">','<view class="poster theme-{{record.theme}}" bindtouchstart="uiCoverStart" catchtouchmove="uiCoverMove" bindtouchend="uiCoverEnd" bindtouchcancel="uiCoverCancel">',1)
        s=s.replace('mode="aspectFill" bindtap="previewPoster"','mode="widthFix" bindtap="previewPoster"',1)
    write(rel,s)
    edit(page+'.wxss',lambda s:s+'''
.ui-detail-page{animation:detail-reveal .32s ease-out;will-change:transform,opacity}.ui-detail-page.ui-closing{animation:none;transition:transform .18s,opacity .18s}.ui-detail-cover{position:relative;max-width:320px;margin:0 auto 24px;width:100%;height:calc(100vw - 40px);max-height:320px}.detail-screen .ui-detail-cover .detail-cover{width:100%;height:100%;aspect-ratio:1;border-radius:0;margin:0;box-shadow:0 14px 24px -12px #171a1760}.ui-cover-gloss{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px #ffffff88,inset -3px -3px 7px #0002;background:linear-gradient(135deg,#ffffff22,#fff0 45%,#ffffff15 49%,#fff0 55%)}.hero .poster{margin:0 auto;width:100%;max-width:320px;aspect-ratio:auto;height:auto;min-height:100px}.hero .poster image{display:block;width:100%;height:auto;position:static}
@keyframes detail-reveal{from{opacity:.1;transform:translateY(34px)}to{opacity:1;transform:translateY(0)}}
''')
