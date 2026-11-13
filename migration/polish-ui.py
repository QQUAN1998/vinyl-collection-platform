"""Screenshot-led presentation corrections; preserve service and storage contracts."""
import re

def patch(rel, fn):
    write(rel, fn((DEST / rel).read_text(encoding='utf-8')))

def css(rel, text):
    append(rel, '\n/* Unified screenshot refinement */\n' + text)

def safe_page_top(s):
    def root(m):
        tag=m.group(0)
        if 'style="' in tag:
            return tag.replace('style="','style="padding-top:{{uiChromeHeight}}px!important;',1)
        return tag[:-1]+' style="padding-top:{{uiChromeHeight}}px!important;">'
    return re.sub(r'<view\b[^>]*>',root,s,count=1)

# These two components were class-prefixed by an earlier migration stage.
# Work on semantic classes, then restore those native reset classes below.
for rel in ['components/collection-deck/index.wxml','components/stats-board/index.wxml']:
    patch(rel,lambda s:re.sub(r'\bn-(?:view|text|image|button|scroll-view)\s*','',s))

write('ui/chart-geometry.js',(UI/'chart-geometry.js').read_text(encoding='utf-8'))
for folder in ['data-chart','rolling-number']:
    for f in (UI/folder).iterdir():write('components/'+folder+'/'+f.name,f.read_text(encoding='utf-8'))
for rel in ['components/stats-board/index.json']:
    cfg=json.loads((DEST/rel).read_text(encoding='utf-8'))
    cfg.setdefault('usingComponents',{}).update({'data-chart':'/components/data-chart/index','rolling-number':'/components/rolling-number/index'})
    write(rel,json.dumps(cfg,ensure_ascii=False,indent=2))

# A fixed-size track avoids native scroll anchoring when nearby artwork changes.
patch('components/collection-deck/index.wxml', lambda s: s.replace('<view class="deck ', '<view hidden="{{!visible}}" class="deck ', 1)
    .replace('style="padding-left:{{inset}}px;padding-right:{{inset}}px;"', 'style="width:{{slides.length*pitch-22+inset*2}}px;"')
    .replace('<view class="gallery-spacer" style="width:{{windowBefore}}px;"/>', '')
    .replace('<view class="gallery-spacer" style="width:{{windowAfter}}px;"/>', '')
    .replace('style="width:{{cardSize}}px;margin-right:{{item.slideKey===slides.length-1?0:22}}px;"', 'style="width:{{cardSize}}px;left:{{inset+item.slideKey*pitch}}px;"'))
patch('components/collection-deck/index.js', lambda s: s.replace('properties:{items:', 'properties:{visible:{type:Boolean,value:true},loading:{type:Boolean,value:false},items:', 1)
    .replace("observers:{'items", "observers:{visible:function(v){if(v&&this.data.cards.length)this.jump(this.data.active,false);},'items",1))
css('components/collection-deck/index.wxss', '.gallery-track{display:block!important;position:relative;height:100%;box-sizing:content-box;padding:0!important}.gallery-slot{position:absolute;top:0;margin:0!important}.deck-top,.deck-summary{padding-left:20px!important;padding-right:20px!important}.deck-stage,.deck-caption,.deck-pagination{transform:translateY(-8px)}.deck-title{max-width:100%;font-size:21px;line-height:1.4}.deck[hidden]{display:none!important}')
patch('packages/live-archive/pages/index/index.wxml', lambda s: s.replace('<collection-deck wx:if="{{uiHomeMounted}}" hidden="{{tab!==\'home\'}}"', '<view hidden="{{tab!==\'home\'}}" style="display:{{tab===\'home\'?\'block\':\'none\'}}"><collection-deck wx:if="{{uiHomeMounted}}" visible="{{tab===\'home\'}}" loading="{{busy}}"').replace('bindempty="manual"/>', 'bindempty="manual"/></view>',1))
patch('components/collection-deck/index.wxml', lambda s: s.replace('<view wx:else class="deck-empty">','<view wx:else class="deck-empty"><view wx:if="{{loading}}" class="deck-loading">正在同步收藏…</view><block wx:else>').replace('</button></view>\n</view>', '</button></block></view>\n</view>'))
css('components/collection-deck/index.wxss', '.deck-loading{height:250px;display:flex;align-items:center;justify-content:center;color:#747871;font-size:13px}')

# All option menus use the OS picker, keeping their existing change-event payload.
write('components/ui-select/index.js', '''const locale=require('../../ui/locale-runtime');
Component({options:{multipleSlots:true},properties:{range:{type:Array,value:[]},rangeKey:{type:String,value:''},value:{type:null,value:0},disabled:{type:Boolean,value:false},label:{type:String,value:'选择'}},data:{labels:[]},observers:{'range,rangeKey,uiLanguage':function(){this.setData({labels:(this.data.range||[]).map(r=>locale.translate(this.data.rangeKey?r[this.data.rangeKey]:String(r)))});}},methods:{chooseNative(e){this.triggerEvent('change',{value:Number(e.detail.value)});}}});
''')
write('components/ui-select/index.wxml','<picker mode="selector" range="{{labels}}" value="{{value}}" disabled="{{disabled}}" bindchange="chooseNative" aria-label="{{label}}"><view class="select-anchor"><slot/></view></picker>')
write('components/ui-select/index.wxss', ':host{display:block;min-width:0;background:transparent}picker,.select-anchor{display:block;box-sizing:border-box;background:transparent!important;min-width:0}')
patch('components/date-field/index.js',lambda s:s.replace('  methods:{','  methods:{nativeChange(e){if(!this.data.disabled)this.select(e.detail.value);},',1))
write('components/date-field/index.wxml','<view class="date-control"><picker mode="date" value="{{value}}" start="{{start}}" end="{{end}}" disabled="{{disabled}}" bindchange="nativeChange"><view class="date-trigger {{!value?\'muted\':\'\'}}" aria-label="{{label}}">{{value||\'选择日期\'}}<image class="date-icon" src="/assets/ui/calendar.svg"/></view></picker><button wx:if="{{value&&!required}}" class="native-date-clear" bindtap="clear" disabled="{{disabled}}" aria-label="清除日期">×</button></view>')
css('components/date-field/index.wxss','.date-control{position:relative}.date-control .date-trigger{padding-right:46px}.native-date-clear{position:absolute;right:34px;top:0;width:24px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:0!important;background:transparent!important;border:0;font-size:18px!important;line-height:44px!important;color:#747871}.native-date-clear::after{border:0}')

# Home artwork opens a compact review card, then the existing full detail/editor.
patch('pages/cabinet/index.js', lambda s: s.replace('this.uiShowDetail({albumId});},', 'this.openAlbumCard(albumId,"home");},', 1)
    .replace('const contextAlbums = context === "wall" ?', 'const contextAlbums = context === "home" ? this.data.deckAlbums : context === "wall" ?',1))
patch('pages/cabinet/index.wxml', lambda s: re.sub(r'<button class="ui-dialog-secondary" bindtap="handleWallAction">.*?</button>', '', s, flags=re.S)
    .replace('<view class="ui-dialog-actions">', '''<view class="ui-preview-chips"><text>{{albumCard.style||albumCard.region}}</text><text>{{albumCard.mediumLabel}}</text><text>{{albumCard.priceLabel}}</text><text>{{albumCard.collectionDateLabel}}</text><text>{{albumCard.conditionLabel}}</text></view><scroll-view scroll-y class="ui-preview-tracks"><view class="ui-preview-track" wx:for="{{albumCard.tracksPreview}}" wx:key="index"><text>{{index+1}}</text><text>{{item.title}}</text></view></scroll-view><view class="ui-dialog-actions">''',1))
dialog_css='''.ui-album-dialog{position:fixed;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}.ui-album-sheet{position:relative!important;inset:auto!important;width:100%!important;max-width:420px;max-height:85vh!important;border-radius:26px!important;background:#f5f6f2;padding:20px!important;box-sizing:border-box;box-shadow:0 20px 80px #0004}.ui-dialog-head{font-size:12px;color:#747871;min-height:30px}.ui-dialog-cover{display:block!important;width:68%!important;height:230px!important;margin:0 auto 16px!important;border-radius:8px}.ui-dialog-title{font-size:24px!important;line-height:1.3;overflow-wrap:break-word}.ui-dialog-artist{font-size:14px!important}.ui-dialog-kicker{font-size:11px}.ui-preview-chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.ui-preview-chips text{background:#eef1e9;border-radius:12px;padding:5px 9px;font-size:11px}.ui-preview-tracks{max-height:110px;height:110px;border-top:1px solid #e3e7de}.ui-preview-track{display:flex;gap:12px;align-items:baseline;padding:8px 0;font-size:12px}.ui-preview-track text:first-child{color:#747871;width:20px;flex-shrink:0}.ui-dialog-actions{display:flex;gap:8px;margin-top:14px}.ui-dialog-actions button{flex:1;min-width:0!important;font-size:13px!important;height:44px!important;line-height:44px!important}.ui-dialog-pager{margin:8px 0 0;display:flex;justify-content:space-between;align-items:center;font-size:11px}.ui-dialog-pager button{width:38px;height:34px;line-height:30px;margin:0}.ui-dialog-delete{font-size:11px!important;margin:4px auto!important;color:#a65e4b!important;background:transparent!important}.ui-dialog-close{width:32px!important;height:32px!important;line-height:30px!important}.ui-album-sheet .ui-life{font-size:11px;margin-top:6px}'''
css('pages/cabinet/index.wxss',dialog_css)

# The live preview mirrors the record card without inventing album-only fields.
live_js='''
  uiPreview(e){const id=e.detail.id;const records=this.data.uiSeenRecords;const index=records.findIndex(r=>r.id===id);if(index<0)return;this.setData({uiPreviewRecord:records[index],uiPreviewIndex:index,uiPreviewPrice:uiStats.costs([ {expenses:records[index].expenses||[]} ]).map(r=>r.symbol+r.exact).join(' · ')});},
  uiPreviewClose(){this.setData({uiPreviewRecord:null});},
  uiPreviewMove(e){const rows=this.data.uiSeenRecords,n=rows.length;if(!n)return;const i=(this.data.uiPreviewIndex+Number(e.currentTarget.dataset.step)+n)%n;this.uiPreview({detail:{id:rows[i].id}});},
  uiPreviewDetail(){const id=this.data.uiPreviewRecord.id;this.uiPreviewClose();this.open({currentTarget:{dataset:{id}}});},
  uiPreviewEdit(){const id=this.data.uiPreviewRecord.id;this.uiPreviewClose();wx.navigateTo({url:routes.edit+'?id='+encodeURIComponent(id)});},
  async uiPreviewDelete(){const record=this.data.uiPreviewRecord;if(this.data.shared||this.data.busy||!record)return;const result=await wx.showModal({title:'删除收藏？',content:record.name});if(!result.confirm)return;this.setData({busy:true});try{await api.remove(record.id,record.version);this.uiPreviewClose();this.update(state.records);uiCache.save(wx,getApp().globalData.userId,state.records);}catch(e){api.error(e);}finally{this.setData({busy:false});}},
'''
patch('packages/live-archive/pages/index/index.js', lambda s: s.replace('  openDeck(e) { this.open({ currentTarget: { dataset: { id: e.detail.id } } }); },','  noop(){},\n  openDeck(e) { this.uiPreview(e); },'+live_js))
live_modal='''<view class="ui-album-dialog" wx:if="{{uiPreviewRecord}}" catchtouchmove="noop"><view class="album-card-scrim" bindtap="uiPreviewClose"/><scroll-view scroll-y class="ui-album-sheet"><view class="ui-dialog-head"><text>现场收藏</text><button class="ui-dialog-close" bindtap="uiPreviewClose" aria-label="关闭">×</button></view><image class="ui-dialog-cover" src="{{uiPreviewRecord.cover||uiPreviewRecord.posterUrl}}" mode="aspectFit"/><view class="ui-dialog-title">{{uiPreviewRecord.name}}</view><view class="ui-dialog-artist">{{uiPreviewRecord.artist}}</view><view class="ui-preview-chips"><text>{{uiPreviewRecord.date}}</text><text>{{uiPreviewRecord.city}}</text><text>{{uiPreviewRecord.type}}</text><text wx:if="{{!shared}}">{{uiPreviewPrice}}</text></view><view class="ui-preview-venue">{{uiPreviewRecord.venue}}</view><scroll-view scroll-y class="ui-preview-tracks"><view class="ui-preview-track" wx:for="{{uiPreviewRecord.songs}}" wx:key="index"><text>{{index+1}}</text><text>{{item}}</text></view></scroll-view><view class="ui-dialog-actions"><button class="primary" bindtap="uiPreviewDetail">详情</button><button wx:if="{{!shared}}" class="outline" bindtap="uiPreviewEdit">编辑</button></view><view class="ui-dialog-pager"><button data-step="-1" bindtap="uiPreviewMove" aria-label="上一场">‹</button><text>{{uiPreviewIndex+1}} / {{uiSeenCount}}</text><button data-step="1" bindtap="uiPreviewMove" aria-label="下一场">›</button></view></scroll-view></view>'''
append('packages/live-archive/pages/index/index.wxml',live_modal)
patch('packages/live-archive/pages/index/index.wxml',lambda s:s.replace('<text>{{uiPreviewIndex+1}} / {{uiSeenCount}}</text><button data-step="1" bindtap="uiPreviewMove" aria-label="下一场">›</button></view></scroll-view>', '<text>{{uiPreviewIndex+1}} / {{uiSeenCount}}</text><button data-step="1" bindtap="uiPreviewMove" aria-label="下一场">›</button></view><button wx:if="{{!shared}}" class="ui-dialog-delete" bindtap="uiPreviewDelete" disabled="{{busy}}">删除收藏</button></scroll-view>'))
css('packages/live-archive/pages/index/index.wxss',dialog_css+'.album-card-scrim{position:absolute;inset:0;background:#0006}.ui-preview-venue{font-size:12px;color:#747871;margin-bottom:12px}.ui-dialog-head{display:flex;justify-content:space-between;align-items:center}')

# Frontend cache is scoped to the existing account ID; share data is never cached.
write('ui/live-view-cache.js', '''const KEY='ui.live-view.v1';const TTL=86400000;
function read(api,owner,now=Date.now()){if(!owner)return null;try{const v=api.getStorageSync(KEY);return v&&v.owner===owner&&Array.isArray(v.records)&&now-v.at>=0&&now-v.at<TTL?v.records:null;}catch(_){return null;}}
function save(api,owner,records,now=Date.now()){if(!owner||!Array.isArray(records))return;try{api.setStorageSync(KEY,{owner,at:now,records});}catch(_){}}
module.exports={read,save};
''')
patch('packages/live-archive/pages/index/index.js', lambda s: "const uiCache=require('../../../../ui/live-view-cache');\n"+s.replace('    this.refresh();\n  },','''    if(!this.token&&account.profile().loggedIn){const owner=getApp().globalData.userId;const cached=uiCache.read(wx,owner);if(cached&&!state.records.length){state.records=cached;this.update(cached);}}
    this.refresh();
  },''',1).replace('if (!this.token && !this.data.shareReady) await this.prepareShare();','if(!this.token){uiCache.save(wx,app.globalData.userId,rows);if(!this.data.shareReady)this.prepareShare().catch(()=>{});}')
    .replace('if (!this.token && ["add","collection"].includes(this.data.tab)) await this.prepareAllShare();','if(!this.token&&["add","collection"].includes(this.data.tab))this.prepareAllShare().catch(()=>{});'))

# One restrained page title, aligned rails, no second hero-sized heading.
for rel in ['pages/collection-edit/index','packages/live-archive/pages/edit/edit']:
    patch(rel+'.wxml',lambda s: re.sub(r'<view class="ui-form-kicker">.*?</view>','',s,flags=re.S))
    css(rel+'.wxss','''.ui-form-kicker{display:none}.screen-header,.ui-page-title{display:none!important}.ui-form-card{padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}.edit-form{display:flex!important;flex-direction:column;gap:16px!important}.edit-cover-block{border:1px solid #d8dcd4;border-radius:20px;padding:14px!important;align-items:center;margin:0 0 26px!important}.edit-cover{width:78px!important;height:78px!important;flex:0 0 78px}.edit-album-title{font-size:18px!important;line-height:1.4}.edit-album-meta{font-size:12px!important}.cover-button{font-size:12px!important;padding:7px 14px!important}.ui-form-back{position:fixed!important;z-index:80;left:50%;bottom:calc(15px + env(safe-area-inset-bottom));transform:translateX(-50%);width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;border-radius:50%!important;font-size:0!important;background:#171a17!important;display:flex!important;align-items:center;justify-content:center;padding:12px!important;margin:0!important}.ui-form-back image{width:20px;height:20px;filter:brightness(0) invert(1)}.edit-actions{display:flex;gap:8px;margin-top:28px}.edit-actions button{min-width:0;flex:1;text-align:center;font-size:14px}.edit-actions button:last-child{flex:2}.track-edit-row{border:0!important;border-bottom:1px solid #d8dcd4!important;border-radius:0!important;background:transparent!important;padding:14px 0!important}.track-edit-list,.track-edit-section{background:transparent!important}.edit-screen,.live-edit-screen{padding:16px 20px 120px!important}.field-row{display:flex;flex-direction:column;gap:16px}.field{background:transparent!important}.field-label,.label{font-size:12px;line-height:1.5}.form-grid{grid-template-columns:1fr!important}.ui-form-card .field,.ui-form-card .field-row,.ui-form-card picker,.ui-form-card ui-select{background:transparent!important}''')

for rel in ['pages/album-detail/index','pages/album-detail/sheet','packages/live-archive/pages/detail/detail','packages/live-archive/pages/detail/sheet']:
    if not (DEST/(rel+'.wxml')).exists(): continue
    patch(rel+'.wxml',lambda s:s.replace('/assets/ui/edit-light.svg','/assets/ui/edit.svg'))
    css(rel+'.wxss','''.ui-detail-page{padding-left:20px!important;padding-right:20px!important;padding-bottom:110px!important}.ui-detail-cover,.detail-cover{width:68vw!important;max-width:280px!important;height:68vw!important;max-height:280px!important;margin-left:auto!important;margin-right:auto!important;border-radius:8px!important}.detail-title,.facts .title{font-size:23px!important;line-height:1.35!important;white-space:normal!important;word-break:break-word;text-align:center}.facts{text-align:center}.detail-artist{font-size:14px!important}.fact-grid{gap:10px!important}.fact,.fact-item{border:1px solid #d8dcd4!important;border-radius:17px!important;background:transparent!important;padding:14px!important}.detail-facts,.detail-section,.detail-toolbar{background:transparent!important;box-shadow:none!important}.detail-edit,.detail-actions .ghost-button{width:100%!important;background:transparent!important;border:1px solid #d8dcd4!important;color:#171a17!important;box-sizing:border-box;justify-content:center}.track-row,.song{background:transparent!important;border-radius:0!important;border-bottom:1px solid #d8dcd4!important}.track-list{background:transparent!important}.poster{width:64vw!important;max-width:260px;margin:0 auto 24px!important;background:transparent!important}.hero{background:transparent!important}.poster image{width:100%!important}.ui-sheet-nav{height:0!important;min-height:0!important;padding:0!important;overflow:hidden}.ui-detail-scroll{height:100vh!important;padding-top:12px!important;box-sizing:border-box}.ui-detail-back{position:fixed;z-index:200;bottom:calc(15px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:44px;height:44px;min-height:44px;background:#171a17;border-radius:50%;padding:12px;box-sizing:border-box;margin:0}.ui-detail-back image{display:block;width:20px;height:20px;filter:brightness(0) invert(1)}''')
    if rel.endswith('/sheet'):
        append(rel+'.wxml','<button style="{{uiThemeStyle}}" class="{{uiThemeClass}} ui-detail-back" bindtap="uiSheetClose" aria-label="返回"><image src="/assets/ui/back.svg"/></button>')

for rel in ['components/form-field/index.wxss','components/date-field/index.wxss']:
    css(rel,':host,.form-field{background:transparent!important}.form-field-label{font-size:12px;margin-bottom:8px}.form-field-control{font-size:15px!important;min-height:44px!important;border-radius:17px!important;box-sizing:border-box}')
for rel in ['pages/all-collection/index.wxss','components/add-pane/index.wxss','pages/add/index.wxss','components/stats-pane/index.wxss','pages/account/index.wxss']:
    if (DEST/rel).exists():css(rel,'.screen-title,.ui-catalog-title{font-size:18px!important;line-height:1.4}.ui-catalog-head{align-items:center}.screen-kicker{display:none}.ui-native-screen,.screen{padding-left:20px!important;padding-right:20px!important;box-sizing:border-box}.tv-actions{display:flex!important;gap:10px!important}.tv-actions button{flex:1!important;min-width:0!important;margin:0!important;text-align:center}.tv-device{display:flex;align-items:center;gap:14px}.tv-device-copy{flex:1;min-width:0}')
css('components/switch-cabinet/index.wxss','.space-switch{background:#e8ece3!important;border:1px solid #dde0d8;border-radius:24px!important;padding:4px!important;gap:0!important;width:132px!important}.space-switch .space-tab{width:61px!important;min-width:61px!important;flex-basis:61px!important}.space-tab.active{box-shadow:0 2px 6px #0002}')
css('components/space-header/index.wxss', '.space-header{padding-left:20px!important;padding-right:20px!important}')

# True multiline examples, not an XML entity printed inside a textarea attribute.
for rel in ['pages/add/index.wxml','pages/add/pane.wxml']:
    if (DEST/rel).exists():
        patch(rel,lambda s:s.replace('placeholder="伍佰 - 浪人情歌&#10;Adele - 21"', 'placeholder="{{uiBatchPlaceholder}}"'))
        patch(rel.replace('.wxml','.js'),lambda s:s.replace('uiBatchText:""','uiBatchPlaceholder:"伍佰 & China Blue - 浪人情歌\\n伍佰 & China Blue - 白鸽\\nAdele - 21",uiBatchText:""',1))

# Currency labels retain their ISO code where ambiguity exists; every amount has a symbol.
patch('ui/stats-model.js',lambda s:s.replace("function exact(n)","function symbol(c){return ({CNY:'￥',USD:'$',HKD:'HK$',TWD:'NT$',JPY:'JP¥',KRW:'₩',EUR:'€',GBP:'£'})[c]||c+' ';}\nfunction exact(n)",1)
    .replace('return {currency,value,exact:exact(value),display:compact(value)}','return {currency,symbol:symbol(currency),value,exact:exact(value),display:compact(value)}')
    .replace("currency:rankMetric==='amount'?currency:''", "symbol:rankMetric==='amount'?symbol(currency):'',currency:rankMetric==='amount'?currency:''")
    .replace('module.exports={MODULES,','module.exports={symbol,MODULES,'))
patch('ui/deck-model.js',lambda s:"const {symbol}=require('./stats-model');\n"+s.replace("row.currency + ' ' + money(row.value)","symbol(row.currency) + money(row.value)").replace("'CNY ' + money(price)","'￥' + money(price)").replace("'CNY 0'", "'￥0'"))

# Share uses a native open-type button, with its snapshot prepared before the click.
patch('components/stats-board/index.js',lambda s:s.replace("openShare(){this.setData", "openShare(){this.openLink();this.setData",1).replace("this.setData({panel:'link',panelTitle:'页面链接',sharePath:message.path});", "this.setData({sharePath:message.path});"))
patch('components/stats-board/index.wxml',lambda s:s.replace('<button class="share-choice" bindtap="openLink">','<button class="share-choice" open-type="share" disabled="{{!sharePath}}">').replace('>页面链接<','>发送给微信好友<').replace('>{{item.display}}</text>','>{{item.symbol}}{{item.display}}</text>').replace('>{{item.exact}}</text>','>{{item.symbol}}{{item.exact}}</text>').replace('<text>{{item.value}}</text></view></view>', '<text>{{item.symbol}}{{item.value}}</text></view></view>'))
patch('components/stats-board/index.js',lambda s: "const locale=require('../../ui/locale-runtime');\n"+s.replace("data:{year:","data:{selectedMonth:0,year:",1)
    .replace('this.setData({...view,',"view.months=view.months.map(r=>({...r,label:locale.current()==='en'?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.month-1]:r.month+(locale.current()==='ja'?'月':' 月')}));const selectedMonth=Math.min(11,this.data.selectedMonth||0),month=view.months[selectedMonth];const distribution=this.data.kind==='live'?view.cities:view.formats;this.setData({selectedMonth,selectedMonthLabel:month.label,selectedMonthCount:month.count,selectedMonthCosts:M.costs(month.entries).map(r=>r.symbol+r.exact).join(' · '),distribution,distributionTotal:distribution.reduce((n,r)=>n+r.count,0),...view,",1)
    .replace('    yearChange(e)',"    chartMonth(e){this.setData({selectedMonth:e.detail.index});this.rebuild();},\n    monthChoose(e){this.setData({selectedMonth:Number(e.detail.value)});this.rebuild();},\n    selectedMonthDetail(){this.monthDetail({currentTarget:{dataset:{month:this.data.selectedMonth+1}}});},\n    yearChange(e)",1))
patch('components/stats-board/index.wxml',lambda s:s.replace('{{item.symbol}}{{item.display}}</text>', '<rolling-number value="{{item.value}}" prefix="{{item.symbol}}"/></text>')
    .replace('{{item.value}}<text class="unit">','<rolling-number value="{{item.value}}"/><text class="unit">')
    .replace('<view class="months">','''<data-chart rows="{{months}}" selected="{{selectedMonth}}" bindmonth="chartMonth" label="每月收藏趋势"/><view class="trend-axis"><text>01</text><text>03</text><text>06</text><text>09</text><text>12</text></view><view class="trend-detail"><picker range="{{months}}" range-key="label" value="{{selectedMonth}}" bindchange="monthChoose"><view class="select">{{selectedMonthLabel}} ⌄</view></picker><view><text class="trend-count">{{selectedMonthCount}} {{kind==='live'?'场':'张'}}</text><text class="muted">{{selectedMonthCosts}}</text></view><button class="pill" bindtap="selectedMonthDetail">查看详情 ›</button></view><view class="months" hidden>''',1)
    .replace('<view class="heat">','<view class="heat" hidden>',1)
    .replace('<view class="donut" style="background:{{donutGradient}}"><view class=""><text class="">{{units}}</text><text class="">COLLECTIONS</text></view></view>', '<data-chart mode="ring" rows="{{formats}}" total="{{units}}" label="收藏"/>')
    .replace('<view wx:for="{{cities}}" wx:key="name" class="city"', '<data-chart mode="ring" rows="{{distribution}}" total="{{distributionTotal}}" label="现场"/><view wx:for="{{cities}}" wx:key="name" class="city"',1))
css('components/stats-board/index.wxss','''.card{border-radius:22px}.currency-total .amount{font-size:32px}.trend-axis{display:flex;justify-content:space-between;color:#747871;font-size:10px;padding:0 8px;margin-bottom:18px}.trend-detail{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #e3e7de}.trend-detail>view{flex:1;min-width:0;display:flex;flex-direction:column}.trend-count{font-size:18px;font-weight:650}.trend-detail .pill{font-size:11px;background:#eef1e9}.trend-detail .select{min-width:78px;font-size:12px}.metric{min-height:116px}.metric-label{white-space:normal;align-items:flex-start;min-height:30px}.metric-label text{line-height:1.4}.number{letter-spacing:-.5px}.board [hidden]{display:none!important}''')
patch('ui/stats-poster.js',lambda s:s.replace('text(r.exact,350,y+i*46,26', 'text(M.symbol(r.currency)+r.exact,350,y+i*46,34').replace('text(r.value,x+12,y+48,23','text(r.value,x+12,y+48,30').replace("r.currency+' '+r.exact", "M.symbol(r.currency)+r.exact").replace("text('COLLECTION',314,y+59,7", "text('ARCHIVE / DATA',314,y+59,7"))
patch('ui/stats-poster.js',lambda s:"const G=require('./chart-geometry');\n"+s.replace("if(module.id==='calendar')add(394", "if(module.id==='calendar')add(394"))
# Keep all 12 exact monthly counts below the same curve in exported posters.
patch('ui/stats-poster.js',lambda s:re.sub(r"if\(module.id==='calendar'\)add\(394,.*?\n  if\(module.id==='genres'\)",'''if(module.id==='calendar')add(350,y=>{round(20,y,350,334);text(module.label,40,y+22,17,ink,700);text(data.year,350,y+26,11,muted,400,'right');const pts=G.points(data.months.map(r=>r.count),310,128,10).map(p=>({...p,x:p.x+40,y:p.y+y+60}));ctx.beginPath();G.line(ctx,pts);ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();data.months.forEach((r,i)=>{const x=40+(i%6)*52,top=y+215+Math.floor(i/6)*52;text(r.label,x,top,9,muted);text(r.count,x,top+18,19,ink,650);});});
  if(module.id==='genres')''',s,count=1,flags=re.S))

# Followed by localization so new labels participate in all three languages.
patch('components/stats-board/index.wxml',lambda s:s.replace('<text class="">{{item.value}}</text></view></view>', '<text class="">{{item.symbol}}{{item.value}}</text></view></view>'))
for rel in ['packages/live-archive/pages/detail/detail.wxml','packages/live-archive/pages/detail/sheet.wxml']:
    patch(rel,lambda s:s.replace('{{item.currency}} {{item.amount}}','{{i18n.money(item.currency,item.amount)}}').replace('<view class="detail-toolbar"', '<view class="fact-grid"><view class="fact-item"><text>观看日期</text><text>{{record.date||\'未填写\'}}</text></view><view class="fact-item"><text>城市</text><text>{{record.city||\'未填写\'}}</text></view><view class="fact-item"><text>类型</text><text>{{record.type}}</text></view><view class="fact-item"><text>状态</text><text>{{record.status}}</text></view></view><view class="detail-toolbar"',1))
    css(rel.replace('.wxml','.wxss'),'.fact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:24px 0}.fact-item{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid #dde0d8;border-radius:17px;min-width:0}.fact-item text:first-child{font-size:11px;color:#747871}.fact-item text:last-child{font-size:15px;line-height:1.4;overflow-wrap:break-word}')

# Remove obsolete wall-only test expectations; the user explicitly omitted it.
patch('tests/miniprogram-static.test.js',lambda s:s.replace('assert.ok(cabinetMarkup.includes("/assets/ui/add.svg"), "album card wall action uses downloaded wall icons");','assert.ok(cabinetMarkup.includes("ui-preview-tracks"), "preview card preserves track information");').replace('assert.ok(cabinetMarkup.includes("handleWallAction"), "album card can move albums up or down the photo wall");','assert.ok(!cabinetMarkup.includes(\'bindtap="handleWallAction"\'), "preview card omits the wall action as requested");').replace('assert.ok(accountMarkup.includes("设置"), "account page links to theme settings");','assert.ok(accountMarkup.includes("显示与语言"), "account page uses the explicit display and language label");'))
patch('pages/account/index.wxml', lambda s:s.replace('>主题设置<','>显示与语言<').replace('>设置<','>显示与语言<'))
css('pages/account/index.wxss','.device-row{display:flex!important;align-items:center!important;gap:14px!important;padding:20px!important;border:1px solid #dde0d8;border-radius:22px}.device-icon{display:flex!important;width:54px!important;height:54px!important;flex:0 0 54px;align-items:center;justify-content:center;background:#fff;border-radius:17px}.device-copy{flex:1!important;min-width:0!important}.device-name{font-size:16px!important;line-height:1.4!important}.device-actions{display:flex!important;gap:10px!important;margin-top:16px}.device-actions .sync-button{flex:1!important;min-width:0!important;text-align:center;justify-content:center;padding:12px 6px!important;font-size:12px!important}.state-pill{flex:none;font-size:11px!important}')

# Deep routes have a single bottom return control and custom system-safe top area.
for rel,title,back in [('pages/album-detail/index','专辑详情','uiPageBack'),('packages/live-archive/pages/detail/detail','现场详情','uiPageBack'),('pages/collection-edit/index','编辑收藏','cancelEdit'),('packages/live-archive/pages/edit/edit','现场收藏','uiCancel'),('pages/all-collection/index','全部唱片','uiPageBack')]:
    cfg=json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'));cfg['navigationStyle']='custom';write(rel+'.json',json.dumps(cfg,ensure_ascii=False,indent=2))
    def deep_markup(s):
        s=re.sub(r'<space-header\b[^>]*/>','',s)
        if back=='uiPageBack':s+='<button style="{{uiThemeStyle}}" class="{{uiThemeClass}} ui-form-back" bindtap="uiPageBack" aria-label="返回"><image src="/assets/ui/back.svg"/></button>'
        s=s.replace('<wxs', '<wxs',1)
        # Root inline padding adapts to the status bar, including Android devices.
        s=safe_page_top(s)
        if rel=='pages/all-collection/index':s=re.sub(r'<bottom-nav\b[^>]*/>','',s)
        return s
    patch(rel+'.wxml',deep_markup)
    if back=='uiPageBack':patch(rel+'.js',lambda s:s.replace('Page({','Page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},',1))
    css(rel+'.wxss','.ui-form-back{position:fixed!important;left:50%;bottom:calc(15px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:300;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;border-radius:50%!important;background:#171a17!important;padding:12px!important;margin:0!important;font-size:0!important;box-sizing:border-box;display:flex!important;align-items:center;justify-content:center}.ui-form-back image{width:20px;height:20px;filter:brightness(0) invert(1)}.all-collection-screen bottom-nav{display:none}.ui-catalog-title{font-size:18px!important}.screen,.page{padding-bottom:110px!important}')
    if rel.endswith('edit/edit'):
        patch(rel+'.wxml',lambda s:s.replace('<view class="ui-form-card">','<view class="ui-form-card"><view wx:if="{{draft.cover||draft.posterUrl}}" class="live-edit-summary"><image src="{{draft.cover||draft.posterUrl}}" mode="aspectFit"/><view><text>{{draft.name}}</text><text>{{draft.artist}} · {{draft.date}}</text><button bindtap="uploadPoster">替换海报</button></view></view>',1))
        # The existing upload button uses choosePoster, preserved here after inspection.
        patch(rel+'.wxml',lambda s:s.replace('bindtap="uploadPoster"','bindtap="cover"'))
        css(rel+'.wxss','.live-edit-summary{display:flex;gap:16px;align-items:center;padding:14px;border:1px solid #dde0d8;border-radius:20px;margin-bottom:24px}.live-edit-summary>image{width:72px;height:96px;flex:none}.live-edit-summary>view{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.live-edit-summary text:first-child{font-size:17px;font-weight:650;line-height:1.4}.live-edit-summary text:nth-child(2){font-size:11px;color:#747871}.live-edit-summary button{font-size:12px;margin:0;padding:6px 12px;align-self:flex-start}.live-edit-screen .row{flex-wrap:wrap;gap:16px}.live-edit-screen .field.half{flex:1 1 100%;width:100%}.live-edit-screen .ticket-price-row{flex-wrap:nowrap}.live-edit-screen .field{margin-bottom:18px}')

for rel in ['components/collection-deck/index.wxml','components/stats-board/index.wxml']:
    def native_classes(s):
        return re.sub(r'<(view|text|image|button|scroll-view)\b([^>]*?)>',lambda m:'<'+m[1]+(re.sub(r'class="', 'class="n-'+m[1]+' ', m[2],count=1) if 'class="' in m[2] else ' class="n-'+m[1]+'"'+m[2])+'>',s)
    patch(rel,native_classes)

patch('components/stats-board/index.js',lambda s:s.replace("'records,kind,snapshotOptions':", "'records,kind,snapshotOptions,uiLanguage':"))
patch('components/stats-board/index.wxml',lambda s:s.replace('<text class="n-text amount"', '<view class="n-view amount"').replace('prefix="{{item.symbol}}"/></text>', 'prefix="{{item.symbol}}" color="#f7f8f2"/></view>'))
write('ui/stats-polish.wxss',(UI/'stats-polish.wxss').read_text(encoding='utf-8'))
css('components/stats-board/index.wxss','@import "../../ui/stats-polish.wxss";')

# Native canvas must leave the tree under overlays and inactive retained panes.
# Defined in the component source; inserting before a particular first property
# silently failed when avatar became that first property.
assert 'visible:{type:Boolean,value:true}' in (DEST/'components/stats-board/index.js').read_text(encoding='utf-8')
patch('components/stats-board/index.wxml',lambda s:s.replace('<data-chart ', '<data-chart visible="{{visible&&!panel}}" '))
patch('pages/stats/pane.wxml',lambda s:s.replace('<stats-board ', '<stats-board visible="{{visible}}" '))

# Secondary routes share status-bar spacing, title scale and one bottom return.
deep_routes=['pages/manual-add/index','pages/batch-input/index','pages/search-results/index','pages/batch-confirm/index','pages/user-profile/index','pages/archive-profile/index','pages/tv-download/index','pages/theme-settings/index','pages/user-guide/index','pages/easter-library/index']
write('ui/deep-pages.wxss',(UI/'deep-pages.wxss').read_text(encoding='utf-8'))
for rel in deep_routes:
    cfg=json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'));cfg['navigationStyle']='custom';write(rel+'.json',json.dumps(cfg,ensure_ascii=False,indent=2))
    def secondary_markup(s):
        s=re.sub(r'<space-header\b[^>]*/>','',s)
        s=re.sub(r'<view class="ui-form-kicker">.*?</view>','',s)
        s=safe_page_top(s)
        if 'class="ui-form-back"' not in s:
            s+='<button class="{{uiThemeClass}} ui-form-back" style="{{uiThemeStyle}}" bindtap="uiPageBack" aria-label="返回"><image src="/assets/ui/back.svg"/></button>'
        return s
    patch(rel+'.wxml',secondary_markup)
    if 'uiPageBack' not in (DEST/(rel+'.js')).read_text(encoding='utf-8'):
        patch(rel+'.js',lambda s:s.replace('Page({','Page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},',1))
    css(rel+'.wxss','@import "../../ui/deep-pages.wxss";')
for rel in ['pages/album-detail/index','pages/collection-edit/index','pages/all-collection/index','packages/live-archive/pages/edit/edit','packages/live-archive/pages/detail/detail']:
    css(rel+'.wxss','@import "'+('../../../../' if rel.startswith('packages/') else '../../')+'ui/deep-pages.wxss";')
# Buttons on the editor are views in the original page; style their real classes.
css('pages/collection-edit/index.wxss','.edit-actions .danger-button,.edit-actions .ghost-button,.edit-actions .primary-button{flex:1;min-width:0;text-align:center;font-size:14px}.edit-actions .primary-button{flex:2}')

# Posters use the same muted olive chart palette and legible data scale.
patch('ui/stats-poster.js',lambda s:s.replace("const bg='#f5f6f2',ink='#171a17',muted='#687063',lime='#d1ff66',line='#e3e7de';", "const dark=data.uiThemeClass==='theme-dark';const bg=dark?'#101113':'#f5f6f2',ink=dark?'#f7f3ea':'#171a17',muted=dark?'#b4b0a7':'#687063',lime='#d1ff66',line=dark?'#363b35':'#e3e7de',surface=dark?'#1d2020':'#ffffff',graph=dark?'#d1ff66':'#53664b';")
    .replace("r=18,color='#fff'", "r=22,color=surface")
    .replace("18,i===0?lime:'#fff'", "20,i===0?lime:surface")
    .replace("text(r.label,x+12,y+16,10,ink,650)", "text(r.label,x+12,y+16,10,i===0?'#171a17':ink,550)")
    .replace("text(r.value,x+12,y+48,30,ink,650)", "text(r.value,x+12,y+48,30,i===0?'#171a17':ink,600)")
    .replace("ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();data.months", "ctx.strokeStyle=graph;ctx.lineWidth=2.2;ctx.stroke();data.months")
    .replace("round(278,y+16,72,72,18,ink)", "round(278,y+16,72,72,18,'#171a17')")
    .replace("round(20,y,350,87+data.totals.length*46,18,ink)", "round(20,y,350,87+data.totals.length*46,22,'#171a17')")
    .replace("text(Array.from(owner)[0],42,y+31,18,ink", "text(Array.from(owner)[0],42,y+31,18,'#171a17'")
    .replace("text('花费',40,y+22,17,'#fff',700);", "text('花费',40,y+22,12,'#c9d0c3',500);for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(260+i*14,y+16);ctx.lineTo(260+i*14,y+56);ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;ctx.stroke();}")
    .replace("text('ARCHIVE / DATA',314,y+59,7", "text('ARCHIVE / DATA',314,y+59,7"))

# Calendar uses a complete twelve-month rail, including months with zero entries.
calendar = """<block wx:if="{{module.id==='calendar'}}"><view class="between"><view class="h2"><image class="ico" src="/assets/ui/calendar.svg"/>{{module.label}}</view><text class="muted">{{year}}</text></view><view class="calendar-summary"><text>{{selectedMonthLabel}}</text><text class="calendar-total">{{selectedMonthCount}} {{kind==='live'?'场':'张'}}</text><text class="muted">{{selectedMonthCosts}}</text></view><scroll-view scroll-x enhanced show-scrollbar="{{false}}" class="month-rail" scroll-into-view="month-{{selectedMonth+1}}" scroll-with-animation><view class="month-track"><view wx:for="{{months}}" wx:key="month" id="month-{{item.month}}" class="month-stop"><button class="month-capsule {{selectedMonth===index?'selected':''}}" data-index="{{index}}" bindtap="monthTap" aria-label="{{item.label}}，{{item.count}}{{kind==='live'?'场':'张'}}"><text>{{item.label}}</text><text>{{item.count}} {{kind==='live'?'场':'张'}}</text></button><view class="month-baseline"><view class="month-dot {{selectedMonth===index?'selected':''}}"/></view></view></view></scroll-view><view class="calendar-footer"><text class="muted">{{selectedMonthLabel}} · {{selectedMonthCount}} {{kind==='live'?'场':'张'}}</text><button class="pill" bindtap="selectedMonthDetail">查看详情 ›</button></view></block>"""
patch('components/stats-board/index.wxml',lambda s:re.sub(r'<block wx:if="{{module.id===\'calendar\'}}">.*?</block>',native_classes(calendar),s,count=1,flags=re.S))
patch('components/stats-board/index.js',lambda s:s.replace('    chartMonth(e)',"    monthTap(e){const index=Number(e.currentTarget.dataset.index);if(Number.isInteger(index)&&index>=0&&index<12){this.setData({selectedMonth:index});this.rebuild();}},\n    chartMonth(e)",1))
# Export the same twelve-month layout on statistics posters.
patch('ui/stats-poster.js',lambda s:re.sub(r"if\(module.id==='calendar'\)add\(350,.*?\n  if\(module.id==='genres'\)","""if(module.id==='calendar')add(260,y=>{round(20,y,350,244);text(module.label,40,y+22,17,ink,700);text(data.year,350,y+26,11,muted,400,'right');data.months.forEach((r,i)=>{const x=40+(i%6)*53,top=y+65+Math.floor(i/6)*81;round(x,top,45,68,22,r.count?lime:(dark?'#30372c':'#f0f2eb'));text(r.label,x+22,top+14,10,r.count?'#171a17':muted,500,'center');text(r.count,x+22,top+38,18,r.count?'#171a17':ink,600,'center');});});
  if(module.id==='genres')""",s,count=1,flags=re.S))

# Normalize both preview dialogs around one bounded body and a fixed footer.
write('ui/preview-card.wxss',(UI/'preview-card.wxss').read_text(encoding='utf-8'))
for rel in ['pages/cabinet/index','packages/live-archive/pages/index/index']:
    def preview_shell(s):
        start=s.index('<view class="album-card-modal ui-album-dialog"' if rel.startswith('pages/') else '<view class="ui-album-dialog"')
        end=s.index('</scroll-view></view>',s.index('<view class="ui-dialog-pager"',start))+len('</scroll-view></view>')
        modal=s[start:end]
        modal=modal.replace('<scroll-view scroll-y class="ui-album-sheet" catchtap="noop">','<view class="ui-album-sheet" catchtap="noop">').replace('<scroll-view scroll-y class="ui-album-sheet">','<view class="ui-album-sheet">')
        head_end=modal.index('</view>',modal.index('<view class="ui-dialog-head"'))+len('</view>')
        modal=modal[:head_end]+'<scroll-view scroll-y class="ui-preview-body"><view class="ui-preview-content">'+modal[head_end:]
        modal=modal.replace('<scroll-view scroll-y class="ui-preview-tracks">','<view class="ui-preview-tracks">').replace('</view></scroll-view><view class="ui-dialog-actions">','</view></view></view></scroll-view><view class="ui-preview-footer"><view class="ui-dialog-actions">',1)
        # Delete belongs in the header, freeing footer space for navigation.
        delete=re.search(r'<button[^>]*class="ui-dialog-delete".*?</button>',modal)
        if delete:
            button=delete.group(0);modal=modal.replace(button,'');modal=modal.replace('<button class="ui-dialog-close"',button+'<button class="ui-dialog-close"',1)
        modal=modal.removesuffix('</scroll-view></view>')+'</view></view></view>'
        return s[:start]+modal+s[end:]
    patch(rel+'.wxml',preview_shell)
    css(rel+'.wxss','@import "'+('../../' if rel.startswith('pages/') else '../../../../')+'ui/preview-card.wxss";')

patch('tests/miniprogram-static.test.js',lambda s:s.replace('scroll-view scroll-y class="ui-album-sheet"','scroll-view scroll-y class="ui-preview-body"'))

patch('components/stats-board/index.js',lambda s:s.replace("detailRecords:rows,detailCosts:withCosts?M.costs(rows):[]", "detailRecords:rows,detailEmpty:!rows.length,detailCosts:withCosts?M.costs(rows):[]").replace("panelTitle:'花费明细',detailRecords:[]", "panelTitle:'花费明细',detailEmpty:false,detailRecords:[]"))
patch('components/stats-board/index.wxml',lambda s:s.replace('!detailRecords.length&&!detailCosts.length','detailEmpty||(!detailRecords.length&&!detailCosts.length)'))
# Retired line-chart handlers are no longer part of the screen API.
patch('components/stats-board/index.js',lambda s:re.sub(r'    (?:chartMonth|monthChoose)\(e\).*?\n','',s))
patch('ui/stats-poster.js',lambda s:s.replace("const G=require('./chart-geometry');\n",''))

# Sibling overlays need their own theme scope; they cannot inherit from the page.
patch('packages/live-archive/pages/index/index.wxml',lambda s:s.replace('<view class="ui-album-dialog"','<view class="{{uiThemeClass}} ui-album-dialog" style="{{uiThemeStyle}}"').replace('class="primary" bindtap="uiPreviewDetail"','class="ui-dialog-primary" bindtap="uiPreviewDetail"').replace('class="outline" bindtap="uiPreviewEdit"','class="ui-dialog-secondary" bindtap="uiPreviewEdit"'))
patch('tests/miniprogram-static.test.js',lambda s:s.replace('"yearChange","monthDetail",','"yearChange","monthTap",'))

# Match preview pagination to the gallery's current sorting, including ties.
patch('components/collection-deck/index.js',lambda s:s.replace("this.triggerEvent('select',{id,album:item});", "this.triggerEvent('select',{id,album:item,...(this.data.kind==='live'?{ids:this.data.cards.map(row=>row.id)}:{})});"))
patch('packages/live-archive/pages/index/index.js',lambda s:s.replace('uiPreview(e){const id=e.detail.id;const records=this.data.uiSeenRecords;', "uiPreview(e){const id=e.detail.id;const source=this.data.uiSeenRecords;const ids=e.detail.ids||this.data.uiPreviewIds;const byId=new Map(source.map(r=>[r.id,r]));const records=ids?ids.map(id=>byId.get(id)).filter(Boolean):source;this.setData({uiPreviewIds:records.map(r=>r.id)});").replace('uiPreviewMove(e){const rows=this.data.uiSeenRecords,n=rows.length;', 'uiPreviewMove(e){const byId=new Map(this.data.uiSeenRecords.map(r=>[r.id,r]));const rows=(this.data.uiPreviewIds||[]).map(id=>byId.get(id)).filter(Boolean),n=rows.length;'))
