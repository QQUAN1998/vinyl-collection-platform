"""Native templates for the approved HTML layout. Executed by apply-ui.py."""
def append(rel,text):
    write(rel,(DEST/rel).read_text(encoding='utf-8').rstrip()+'\n'+text.strip()+'\n')
for folder in ['ui-select','date-field']:
    for file in (UI/folder).iterdir(): write('components/'+folder+'/'+file.name,file.read_text(encoding='utf-8'))
write('ui/add.wxss',(UI/'add.wxss').read_text(encoding='utf-8'))

script=read('pages/add/index.js')
adapter=(UI/'add-adapter.js').read_text(encoding='utf-8')
script=adapter+'\n'+script
script=script.replace('Page({','Page({\n  ...uiAddMethods,',1)
script=script.replace('    query: "",','    uiMethod:"search",uiBatchText:"",uiError:"",uiAvatar:"",\n    query: "",',1)
script=script.replace('      collectionCount: stats.albumCount,','      uiAvatar:app.globalData.userProfile?.avatar||"",\n      collectionCount: stats.albumCount,',1)
script=script.replace('  onShareAppMessage() {\n    return createShareMessage();','  onShareAppMessage(event) {\n    if(event?.target?.dataset?.uiAll){const app=getApp(),ownerId=encodeURIComponent(app.globalData.userId||"");return createShareMessage({title:(app.globalData.userProfile?.name||"音乐收藏者")+"的全部唱片收藏",path:ownerId?"/pages/all-collection/index?ownerId="+ownerId:"/pages/all-collection/index"});}\n    return createShareMessage();',1)
write('pages/add/index.js',script)
write('pages/add/index.wxml',(UI/'add.wxml').read_text(encoding='utf-8'))
append('pages/add/index.wxss','@import "../../ui/pages.wxss";\n@import "../../ui/add.wxss";')

# Default presentation values prevent transient incompatible component bindings.
script=(DEST/'pages/cabinet/index.js').read_text(encoding='utf-8').replace('  data: {','  data: {\n    deckAlbums:[],deckCollections:[],deckOwner:"",deckAvatar:"",',1)
write('pages/cabinet/index.js',script)
script=(DEST/'pages/stats/index.js').read_text(encoding='utf-8').replace('  data: {','  data: {\n    uiRecords:[],uiOwner:"音乐收藏者",uiAvatar:"",uiReadOnly:false,uiSnapshotOptions:null,',1)
script=script.replace('if(options.uiSnapshot) { try {','if(options.uiSnapshot) { this.setData({uiReadOnly:true});try {')
script=script.replace('uiSnapshotOptions:snap});','uiSnapshotOptions:snap});const media=require("../../ui/stats-share-media");media.hydrate(snap,media.readShared).then(uiRecords=>this.setData({uiRecords})).catch(()=>wx.showToast({title:"部分封面暂不可用，请重试",icon:"none"}));')
write('pages/stats/index.js',script)
script=(DEST/'packages/live-archive/pages/index/index.js').read_text(encoding='utf-8')
script=script.replace('addEntry: "search"', 'addEntry: "link"', 1)
script=script.replace('  data: {','  data: {\n    uiSeenRecords:[],uiSeenCount:0,uiStatsRecords:[],uiShareToken:"",',1)
script=script.replace('this.setData({ shareReady: true });','this.setData({ shareReady: true, uiShareToken:token });')
script=script.replace('["search", "link"].includes(value)','["search", "link", "manual"].includes(value)')
write('packages/live-archive/pages/index/index.js',script)
markup=(DEST/'packages/live-archive/pages/index/index.wxml').read_text(encoding='utf-8')
markup=markup.replace('avatar="{{account.avatar}}"','avatar="{{account.avatar||\'\'}}"').replace('owner="{{account.name}}"','owner="{{account.name||\'音乐收藏者\'}}"').replace("owner=\"{{shared?'':account.name}}\"","owner=\"{{shared?'':account.name||''}}\"")
markup=markup.replace('kind="live" owner=', 'kind="live" media-share="{{uiShareToken}}" owner=')
markup=re.sub(r'    <view class="collection-block">[^\n]+\n','',markup)
markup=markup.replace('<view class="catalog">','<view wx:if="{{uiSeenCount}}" class="catalog">',1)
start=markup.index('    <view class="entry-tabs');end=markup.index('    <view class="all-collection-card',start)
entry=markup[start:end]
entry=entry.replace('<view class="entry-tabs section">','<view class="ui-page-title">添加现场</view><view class="ui-method-tabs">')
entry=entry.replace('class="{{addEntry', 'class="ui-method {{addEntry')
entry=entry.replace('>大麦链接</button></view>','>大麦链接</button><button class="ui-method {{addEntry===\'manual\'?\'active\':\'\'}}" data-value="manual" bindtap="entry" disabled="{{busy}}">手动添加</button></view>')
entry=entry.replace('<view wx:if="{{addEntry===\'search\'}}" class="section">','<view class="ui-add-card ui-live-add"><view wx:if="{{addEntry===\'search\'}}"><view class="ui-h2">秀动搜索</view>')
entry=entry.replace('<view class="search-line">','<view class="ui-search-row"><view class="ui-search"><image class="ui-icon" src="/assets/ui/search.svg"/>',1)
entry=entry.replace('class="search" placeholder="艺人名称"','class="ui-search-input" placeholder="艺人名称"',1).replace('aria-label="搜索艺人"/><button class="primary"','aria-label="搜索艺人"/></view><button class="ui-primary"',1)
entry=entry.replace('class="section surface link-import"><textarea','class="ui-live-add"><view class="ui-h2">大麦链接</view><textarea class="ui-add-textarea"')
entry=entry.replace('<button class="primary" bindtap="importLink"','<button class="ui-primary ui-full" bindtap="importLink"')
entry=entry.replace('    <button class="link manual-action" bindtap="manual" disabled="{{busy}}">手动添加</button>','    <view wx:elif="{{addEntry===\'manual\'}}"><view class="ui-h2">手动添加</view><button class="ui-manual-entry" bindtap="manual" disabled="{{busy}}"><image class="ui-icon" src="/assets/ui/add.svg"/><text>记录一场现场</text></button></view></view>')
share='''    <view class="ui-share-card"><view class="ui-between"><view class="ui-h2">全部收藏</view><button wx:if="{{allShareReady}}" class="ui-link" open-type="share" data-scope="all" disabled="{{!count||busy}}"><image class="ui-icon" src="/assets/ui/share.svg"/>分享</button><button wx:else class="ui-link" bindtap="prepareAllShare" disabled="{{!count||busy||preparingAllShare}}" loading="{{preparingAllShare}}"><image class="ui-icon" src="/assets/ui/share.svg"/>分享</button></view><button class="ui-share-open" bindtap="allCollection"><view class="ui-menu-icon"><image class="ui-icon" src="/assets/ui/ticket.svg"/></view><view class="ui-result-copy"><text class="ui-share-count">{{count}} 场现场</text><text class="ui-muted">查看全部收藏</text></view><text>›</text></button></view>
'''
blockend=markup.index('  </block>',end)
markup=markup[:start]+entry+share+markup[blockend:]
write('packages/live-archive/pages/index/index.wxml',markup)
append('packages/live-archive/pages/index/index.wxss','@import "../../../../ui/live.wxss";\n@import "../../../../ui/add.wxss";')

# Shared date/condition controls preserve each page's change event and original field key.
script=read('components/form-field/index.js').replace('  methods: {','  data:{isDate:false,isCondition:false,conditions:["M","NM","VG+","VG","G+","G","F","P"],conditionIndex:0},\n  observers:{"label,value":function(label,value){this.setData({isDate:label.includes("日期"),isCondition:label.includes("品相"),conditionIndex:Math.max(0,["M","NM","VG+","VG","G+","G","F","P"].indexOf(value))});}},\n  methods: {\n    conditionChange(e){this.triggerEvent("change",{value:this.data.conditions[Number(e.detail.value)]});},')
write('components/form-field/index.js',script)
markup=read('components/form-field/index.wxml').replace('  <textarea','  <date-field wx:if="{{isDate}}" value="{{value}}" label="{{label}}" disabled="{{disabled}}" bindchange="handleInput"/>\n  <ui-select wx:elif="{{isCondition}}" range="{{conditions}}" value="{{conditionIndex}}" disabled="{{disabled}}" bindchange="conditionChange" label="品相"><view class="condition-control">{{value||\'选择品相\'}}<text>⌄</text></view></ui-select>\n  <textarea',1).replace('wx:if="{{mode === \'textarea\'}}"','wx:elif="{{mode === \'textarea\'}}"')
write('components/form-field/index.wxml',markup)
config=json.loads(read('components/form-field/index.json'));config.setdefault('usingComponents',{}).update({'date-field':'/components/date-field/index','ui-select':'/components/ui-select/index'});write('components/form-field/index.json',json.dumps(config,ensure_ascii=False,indent=2))
append('components/form-field/index.wxss','.form-field-label{font-size:11px;line-height:1.5;margin-bottom:8px;color:#687063;font-weight:500}.form-field-control{font-size:13px;line-height:20px;min-height:44px;padding:12px 14px;box-sizing:border-box;background:#fff;border:1px solid #e3e7de;border-radius:18px}.condition-control{min-height:44px;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #e3e7de;border-radius:18px;box-sizing:border-box;font-size:13px;color:#171a17}')

markup=(DEST/'packages/live-archive/pages/edit/edit.wxml').read_text(encoding='utf-8')
a=markup.index('<view class="date-control">');b=markup.index('</view></view></view><view class="row">',a)+len('</view>')
markup=markup[:a]+'<date-field value="{{draft.date}}" label="观看日期" disabled="{{busy}}" bindchange="dateChange" bindclear="clearDate"/>'+markup[b:]
write('packages/live-archive/pages/edit/edit.wxml',markup)

# All selector pickers use the prototype's compact anchored dropdown, with unchanged payloads.
for directory in ['pages','packages/live-archive/pages','components/stats-board','components/media-format-selector']:
    for file in (DEST/directory).rglob('*.wxml'):
        rel=file.relative_to(DEST).as_posix();markup=file.read_text(encoding='utf-8')
        markup=re.sub(r'<picker\b(?![^>]*mode="(?:date|time|multiSelector|region)")([^>]*)>',r'<ui-select\1>',markup)
        markup=markup.replace('</picker>','</ui-select>')
        if '<ui-select' not in markup and '<date-field' not in markup:continue
        write(rel,markup)
        cfg=file.with_suffix('.json');config=json.loads(cfg.read_text(encoding='utf-8'))
        config.setdefault('usingComponents',{}).update({'ui-select':'/components/ui-select/index','date-field':'/components/date-field/index'})
        write(cfg.relative_to(DEST).as_posix(),json.dumps(config,ensure_ascii=False,indent=2))

# Detail hero and form grids follow the new single-column mobile composition.
append('packages/live-archive/pages/detail/detail.wxss','''@import "../../../../ui/live.wxss";
.hero{display:flex;flex-direction:column;gap:24px;align-items:stretch;margin:0}.hero .poster{width:100%;max-width:320px;height:auto;aspect-ratio:3/4;border-radius:18px;margin:0}.hero .facts{width:100%;min-width:0}.hero .title{font-size:30px;line-height:1.25;letter-spacing:-1px;font-weight:750}.detail-artist{font-size:18px;line-height:1.6;margin:15px 0}.detail-date,.detail-place{font-size:12px;line-height:1.8}.detail-toolbar{margin:20px 0}.detail-toolbar .detail-edit{background:#171a17;color:#fff;width:auto!important;padding:12px 16px;font-size:12px;min-height:44px;border:0}.detail-section{padding:20px;background:#fff;border:0;border-radius:18px;margin-top:20px}.detail-section .section-title{font-size:17px;line-height:1.35;margin-bottom:20px}.detail-section .tiny,.detail-section .muted{font-size:11px}.source-action{margin-top:20px}.source-action .source-link{font-size:12px;border-radius:18px;background:#eef1e9;min-height:44px;padding:12px}.page .danger{font-size:12px;min-height:44px;border:0;border-radius:18px}
''')
append('packages/live-archive/pages/edit/edit.wxss','''@import "../../../../ui/live.wxss";
.page{display:flex;flex-direction:column;gap:20px;padding-bottom:124px}.field{margin:0;min-width:0}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.half{width:auto;min-width:0;flex:initial}.label{font-size:11px;font-weight:500;color:#687063;margin:0 0 8px;line-height:1.5}.field-input,.select,.price-amount{font-size:13px;min-height:44px;line-height:20px;padding:12px 14px;box-sizing:border-box;border:1px solid #e3e7de;border-radius:18px;background:#fff}.field-input{height:44px}.price-row{display:flex;align-items:center;gap:8px;margin-top:12px}.price-currency{flex:0 0 75px}.price-amount{flex:1;min-width:0;width:50px}.price-preset{flex:0 0 68px;font-size:11px}.price-remove{flex:0 0 24px;width:24px!important;margin:0!important;padding:0;font-size:20px}.price-add{font-size:11px;margin-top:16px}.cover-preview{max-width:150px;height:200px;border-radius:18px;margin:15px 0}.edit-actions{position:static;padding:0;background:none;border:0}.edit-actions .primary{width:100%!important;margin:0!important;min-height:44px;font-size:12px;padding:12px;border-radius:18px;background:#171a17}.field .actions{display:flex;gap:12px;justify-content:flex-start}.field .actions .outline{width:auto!important;margin:0!important;font-size:12px;min-height:44px;padding:12px;background:#eef1e9;border:0}
''')

# One final stylesheet translates the supplied page geometry; service code is untouched.
write('ui/exact-pages.wxss',(UI/'exact-pages.wxss').read_text(encoding='utf-8').replace('.screen .manual-add-screen .section-title','.manual-add-screen .section-title'))
for page in ['cabinet','add','all-collection','manual-add','collection-edit','detail','account','profile','batch-input','search-results','search-detail']:
    if (DEST/f'pages/{page}/index.wxss').exists():append(f'pages/{page}/index.wxss','@import "../../ui/exact-pages.wxss";')
script=(DEST/'pages/cabinet/index.js').read_text(encoding='utf-8')
script='const {buildDeck:uiBuildDeck}=require("../../ui/deck-model");\n'+script
script=script.replace('  data: {','  uiAllCollection(){wx.navigateTo({url:"/pages/all-collection/index"});},\n  data: {\n    uiLife:{},',1)
script=script.replace('deckAlbums: collectedAlbums,','uiLife:Object.fromEntries(uiBuildDeck(collectedAlbums,liveCollectionItems,"vinyl").cards.map(r=>[r.id,r.sequence])),\n      deckAlbums: collectedAlbums,')
write('pages/cabinet/index.js',script)
markup=(DEST/'pages/cabinet/index.wxml').read_text(encoding='utf-8')
a=markup.index('<view class="album-card-modal"');b=markup.index('  <bottom-nav',a)
markup=markup[:a]+(UI/'album-dialog.wxml').read_text(encoding='utf-8')+'\n'+markup[b:]
markup=markup.replace('>全部唱片</view>','>我的收藏</view>',1).replace('<view class="catalog-count-label">{{catalogCountLabel}}</view>','<view class="ui-all-link" bindtap="uiAllCollection">全部收藏 ›</view>')
markup=markup.replace('<view class="album-tile-meta">{{item.year}}</view>','<view class="album-tile-meta">{{item.artist}}</view><view wx:if="{{uiLife[item.id]}}" class="ui-life">人生第 {{uiLife[item.id]}} 张唱片</view>')
write('pages/cabinet/index.wxml',markup)

markup=(DEST/'pages/all-collection/index.wxml').read_text(encoding='utf-8')
a=markup.index('  <view class="owner-panel">');b=markup.index('  <view class="collection-search-tools">',a)
markup=markup[:a]+'  <view wx:if="{{!canManageCollection}}" class="ui-shared-owner">{{userName}} 的唱片柜 · {{stats.albumCount}} 张</view>\n'+markup[b:]
a=markup.index('  <view class="album-card-modal"');
dialog=(UI/'album-dialog.wxml').read_text(encoding='utf-8')
dialog=re.sub(r'<button class="ui-dialog-secondary"[^>]*bindtap="(?:handleCardCollectionAction|handleWallAction)".*?</button>','',dialog)
dialog=re.sub(r'<button class="ui-dialog-delete".*?</button>','',dialog)
dialog=dialog.replace('class="ui-dialog-actions"','class="ui-dialog-actions ui-dialog-readonly"')
markup=markup[:a]+dialog+'\n</view>\n'
write('pages/all-collection/index.wxml',markup)
append('pages/all-collection/index.wxss','.ui-dialog-readonly{grid-template-columns:1fr}')

for page,form in [('manual-add','manual-form'),('collection-edit','edit-form')]:
    path=f'pages/{page}/index.wxml';markup=(DEST/path).read_text(encoding='utf-8')
    a=markup.index('  <view class="screen-header">');b=markup.index('  </view>',a)+len('  </view>')
    markup=markup[:b]+'\n<view class="ui-form-card">'+markup[b:]
    markup=markup.rsplit('</view>',1)[0]+'</view>\n</view>\n'
    markup=re.sub(r'(<form-field\s+)(label="(?:唱片名称|唱片名|专辑名称|专辑名|艺人|备注)"[^>]*?/>)',r'\1class="ui-form-full" \2',markup)
    markup=re.sub(r'<view class="section-title">(?:唱片信息|收藏信息|收藏字段)</view>','',markup)
    write(path,markup)

    cancel='cancelManualAdd' if page=='manual-add' else 'cancelEdit'
    markup=(DEST/path).read_text(encoding='utf-8')
    markup=markup.replace('<view class="screen-header">',f'<button class="ui-form-back" bindtap="{cancel}">‹ 返回</button><view class="ui-form-kicker">'+('MANUAL ENTRY' if page=='manual-add' else 'EDIT COLLECTION')+'</view><view class="screen-header">',1)
    markup=markup.replace('>手动添加</view>','>新建唱片</view>',1)
    markup=re.sub(r'<view class="section-title">唱片资料</view>','',markup)
    write(path,markup)

# The live form uses the same card, spacing and native back action as vinyl.
path='packages/live-archive/pages/edit/edit.wxml';markup=(DEST/path).read_text(encoding='utf-8')
markup=markup.replace('<view class="row"><view class="field half"><view class="label">观看日期','<view class="row date-row"><view class="field half"><view class="label">观看日期',1)
markup=markup.replace('<view class="page">','<view class="page live-edit-screen"><space-header kind="live"/><button class="ui-form-back" bindtap="uiCancel">‹ 返回</button><view class="ui-form-kicker">LIVE ENTRY</view><view class="ui-page-title">{{draft.id?\'编辑现场\':\'新建现场\'}}</view><view class="ui-form-card">',1)
markup=markup.rsplit('</view>',1)[0]+'</view></view>'
markup=markup.replace('<view class="edit-actions"><button','<view class="edit-actions"><button class="outline" bindtap="uiCancel" disabled="{{busy}}">取消</button><button',1)
write(path,markup)
script=read('packages/live-archive/pages/edit/edit.js').replace('  input(e) {','  uiCancel(){if(!this.data.busy)wx.navigateBack();},\n  input(e) {',1);write('packages/live-archive/pages/edit/edit.js',script)
cfg=json.loads((DEST/'packages/live-archive/pages/edit/edit.json').read_text(encoding='utf-8'));cfg['usingComponents']['space-header']='/components/space-header/index';write('packages/live-archive/pages/edit/edit.json',json.dumps(cfg,ensure_ascii=False,indent=2))
for page in ['manual-add','collection-edit']:
    rel=f'pages/{page}/index';markup=(DEST/(rel+'.wxml')).read_text(encoding='utf-8').replace('  <button class="ui-form-back"','  <button class="ui-form-back"',1)
    markup=markup.replace('  <view class="screen-header">','  <view class="screen-header">',1)
    markup=markup.replace('\n  <button class="ui-form-back"','\n  <space-header/>\n  <button class="ui-form-back"',1)
    write(rel+'.wxml',markup)
    cfg=json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'));cfg.setdefault('usingComponents',{})['space-header']='/components/space-header/index';write(rel+'.json',json.dumps(cfg,ensure_ascii=False,indent=2))
append('packages/live-archive/pages/edit/edit.wxss','''
.live-edit-screen{display:block}.live-edit-screen .ui-form-card{display:flex;flex-direction:column;gap:20px;padding:20px;background:#fff;border:0;border-radius:18px}.live-edit-screen .ui-page-title{font-size:30px;line-height:1.25;letter-spacing:-1px;font-weight:750;margin-bottom:24px}.live-edit-screen .edit-actions{display:flex;justify-content:flex-end;gap:8px}.live-edit-screen .edit-actions .primary{width:auto!important;margin:0!important}.live-edit-screen .edit-actions .outline{padding:12px 16px;font-size:12px;min-height:44px;border:0;background:#eef1e9;margin:0;line-height:20px}.live-edit-screen .price-row{display:grid;grid-template-columns:75px minmax(0,1fr) 24px;gap:8px}.live-edit-screen .price-currency{grid-column:1;grid-row:1}.live-edit-screen .price-amount{grid-column:2;grid-row:1;width:100%}.live-edit-screen .price-remove{grid-column:3;grid-row:1;min-height:44px}.live-edit-screen .price-preset{grid-column:1/-1;grid-row:2;padding:0;font-size:11px;min-height:0}.live-edit-screen .row{gap:12px}.live-edit-screen .ui-form-card>.date-row{grid-template-columns:1fr}
''')

script=read('components/media-format-selector/index.js').replace('    handleSelect(event) {','    handleOption(event) {').replace('  methods: {','  data:{selectedIndex:0,selectedLabel:"黑胶"},\n  observers:{"options,selectedKey":function(options,key){const index=Math.max(0,options.findIndex(r=>r.key===key));this.setData({selectedIndex:index,selectedLabel:options[index]?.label||"黑胶"});}},\n  methods: {\n    handleSelect(e){const row=this.data.options[Number(e.detail.value)];if(row)this.handleOption({currentTarget:{dataset:{key:row.key}}});},',1)
write('components/media-format-selector/index.js',script)
write('components/media-format-selector/index.wxml','<view class="media-format-selector"><view class="media-format-label">{{label}}</view><ui-select range="{{options}}" range-key="label" value="{{selectedIndex}}" bindchange="handleSelect" label="{{label}}"><view class="media-format-control">{{selectedLabel}}<text>⌄</text></view></ui-select></view>')
write('components/media-format-selector/index.wxss',':host{display:block;min-width:0}.media-format-label{font-size:11px;color:#687063;font-weight:500;margin-bottom:8px;line-height:1.5}.media-format-control{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:12px 14px;font-size:13px;color:#171a17;background:#fff;border:1px solid #e3e7de;border-radius:18px;box-sizing:border-box}')
cfg=json.loads(read('components/media-format-selector/index.json'));cfg['usingComponents']={'ui-select':'/components/ui-select/index'};write('components/media-format-selector/index.json',json.dumps(cfg,ensure_ascii=False))

# Component styles cannot use tag or attribute selectors under WeChat style isolation.
# Add stable classes to each native tag, then rewrite selector-only text (never values).
for name in ['stats-board','collection-deck','space-header','home-dock','date-field','ui-select','media-format-selector']:
    prefix='components/'+name+'/index';markup=(DEST/(prefix+'.wxml')).read_text(encoding='utf-8');css=(DEST/(prefix+'.wxss')).read_text(encoding='utf-8')
    tags=['view','text','button','image','scroll-view','label','checkbox']
    for tag in tags:
        cls='n-'+tag
        def tag_class(match):
            attrs=match.group(1)
            if 'class="' in attrs:attrs=attrs.replace('class="','class="'+cls+' ',1)
            else:attrs=' class="'+cls+'"'+attrs
            return '<'+tag+attrs+'>'
        markup=re.sub(r'<'+tag+r'(?![\w-])([^>]*)>',tag_class,markup)
    def selector_classes(match):
        selector=match.group(1)
        if selector.strip().startswith('@'):return selector+'{'
        selector=re.sub(r'(?<![\w.\-])('+ '|'.join(tags) +r')(?![\w\-])',lambda m:'.n-'+m.group(1),selector)
        selector=selector.replace('[disabled]','.is-disabled')
        return selector+'{'
    css=re.sub(r'([^{}]+)\{',selector_classes,css)
    css+='\n.n-button{margin:0!important}.n-button::after{border:0}\n'
    write(prefix+'.wxml',markup);write(prefix+'.wxss',css)
append('components/ui-select/index.wxss','.select-menu .selected{background:#171a17;color:#fff}')
append('components/stats-board/index.wxss','.sheet{background:#f5f6f2}.layout-row{background:#fff;border:0;border-radius:18px;padding:14px;margin:8px 0}.sheet-scroll{flex:initial}.n-button{width:auto}')
append('components/collection-deck/index.wxss','.deck-empty .n-button{background:#d1ff66;color:#171a17;border:0}.deck-empty .n-button::after{border:0}')
append('components/bottom-nav/index.wxss','.bottom-nav{left:16px;right:16px;bottom:calc(12px + env(safe-area-inset-bottom));padding:5px;gap:5px;border:1px solid #e3e7de;border-radius:18px;background:#fff;box-shadow:none}.bottom-nav-item{min-height:55px;border-radius:18px;gap:4px}.bottom-nav-icon{width:22px;height:22px}.bottom-nav-label{font-size:10px;font-weight:600}')
path='components/date-field/index.wxml';markup=(DEST/path).read_text(encoding='utf-8').replace("{{value||'选择日期'}}","{{displayDate||'选择日期'}}").replace("{{item.today?'today':''}}","{{item.today?'today':''}} {{item.disabled?'is-disabled':''}}")
write(path,markup)
script=(DEST/'components/date-field/index.js').read_text(encoding='utf-8').replace('  methods:{','  observers:{value(value){this.setData({displayDate:value.replace(/-/g,"/")});}},\n  methods:{',1)
write('components/date-field/index.js',script)

# Preserve behavioral checks; port only assertions tied to the superseded visual markup.
path='tests/miniprogram-static.test.js';test=(DEST/path).read_text(encoding='utf-8')
test=test.replace('["全部唱片", "catalogSearch"','["我的收藏", "catalogSearch"')
test=test.replace('["add-fab", "album-tile-cover", "catalog-smart-chips"]','["collection-deck", "album-tile-cover", "catalog-smart-chips"]')
test=test.replace('["album-card-modal", "album-modal-card", "rarity-corner", "cardPositionLabel"]','["album-card-modal", "ui-album-sheet", "ui-dialog-actions", "cardPositionLabel"]')
test=test.replace('assert.doesNotMatch(cabinetMarkup + addMarkup + statsMarkup + accountMarkup + allCollectionMarkup, /open-type="share"/);','assert.match(addMarkup,/open-type="share"/);\n  assert.match(readText("pages/add/index.js"),/ownerId/);')
for old,new in [('modal-delete-entry','ui-dialog-delete'),('delete-action.svg','handleCardDeleteAction'),('screen-header','space-header'),('search-action.png','/assets/ui/search.svg'),('查看全部在线结果','查看全部结果'),('all-collection-card','ui-share-card')]:
    if old=='screen-header':test=test.replace('addMarkup.includes("screen-header")','addMarkup.includes("space-header")')
    else:test=test.replace(f'cabinetMarkup.includes("{old}")',f'cabinetMarkup.includes("{new}")').replace(f'addMarkup.includes("{old}")',f'addMarkup.includes("{new}")')
test=test.replace('assert.ok(addMarkup.includes("在线资料"),','assert.ok(addMarkup.includes("ui-search-results"),')
test=test.replace('cabinetMarkup.includes("wall-down-muted")','cabinetMarkup.includes("/assets/ui/add.svg")').replace('cabinetMarkup.includes("modal-edit-action")','cabinetMarkup.includes("handleCardCollectionAction")').replace('cabinetMarkup.includes("modal-wall-action")','cabinetMarkup.includes("handleWallAction")').replace('cabinetMarkup.includes(\'<scroll-view scroll-y class="modal-track-scroll"\')','cabinetMarkup.includes(\'<scroll-view scroll-y class="ui-album-sheet"\')')
a=test.index('  assert.ok(\n    addMarkup.indexOf("资料库没有？")');b=test.index('  assert.doesNotMatch(addMarkup, /扫码',a)
test=test[:a]+'  assert.ok(addMarkup.indexOf("ui-method-tabs")<addMarkup.indexOf("ui-share-card"),"approved add methods precede the collection card");\n'+test[b:]
test=test.replace('assert.ok(allCollectionMarkup.includes("按唱片价格排序"),','assert.ok(allCollectionMarkup.includes("ui-shared-owner"),').replace('assert.ok(allCollectionMarkup.includes("collection-summary-grid"),','assert.ok(allCollectionMarkup.includes("stats.albumCount"),')
test=test.replace('assert.ok(batchInputMarkup.includes(">BATCH<"),','assert.doesNotMatch(batchInputMarkup,/>BATCH</,')
a=test.index('  for (const text of ["month-grid"');b=test.index('  assert.ok(accountMarkup.includes("screen-header")',a)
test=test[:a]+'''  assert.match(statsMarkup,/<stats-board/);
  const statsScript=readText("pages/stats/index.js"),board=readText("components/stats-board/index.wxml"),boardScript=readText("components/stats-board/index.js");
  for(const event of ["yearChange","monthDetail","rankChange","timelineChange","openLayout","openShare","generatePoster"]){assert.ok(board.includes(event),`approved statistics control ${event}`);assert.ok(boardScript.includes(event),`statistics handler ${event}`);}
  assert.match(readText("ui/stats-poster.js"),/canvasToTempFilePath/);
  assert.match(readText("ui/stats-snapshot.js"),/uiSnapshot=/);
  assert.doesNotMatch(statsMarkup,/all-albums-entry|查看完整收藏清单/);
'''+test[b:]
write(path,test)


# A local binding refresh must not claim that data reached a physical television.
path='pages/account/index.js';script=read(path)
a=script.index('  manualSync() {');b=script.index('  unbindTvSync() {',a)
script=script[:a]+'  manualSync() {\n    this.loadAccount();\n    wx.showToast({title:this.data.tvBinding?"已刷新本地绑定状态":"请先扫码绑定电视",icon:"none"});\n  },\n'+script[b:]
script=script.replace('bindTvLoginSession, triggerTvSync, unbindTvLoginSession','bindTvLoginSession, unbindTvLoginSession')
write(path,script)

# WXML attribute values keep HTML entities literal in component placeholders.
path='pages/manual-add/index.wxml'
write(path,(DEST/path).read_text(encoding='utf-8').replace('伍佰 &amp; China Blue','伍佰 & China Blue'))
