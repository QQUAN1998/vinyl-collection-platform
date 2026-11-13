"""Shared statistics chrome, direct month details and standalone timeline shares."""

rel = 'components/collection-deck/index.wxml'
patch(rel, lambda s: s.replace('去重收藏 {{uniqueCount}} 张', '去重后 {{uniqueCount}} 张').replace('总张数 {{totalQuantity}} 张', '总收藏 {{totalQuantity}} 张').replace('<text>去重后 {{uniqueCount}} 张</text><text>总收藏 {{totalQuantity}} 张</text>', '<text>总收藏 {{totalQuantity}} 张</text><text>去重后 {{uniqueCount}} 张</text>'))

rel = 'components/stats-board/index.wxml'
s = (DEST / rel).read_text(encoding='utf-8')
s = re.sub(r'<view class="n-view title-row">.*?</picker></view>\s*', '', s, count=1)
# Selectors have already become ui-select by this stage.
s = re.sub(r'<view class="n-view title-row">.*?</ui-select></view>\s*', '', s, count=1)
old = '<view class="n-view card currency-card"><view class="n-view h2"><image class="n-image ico lime-icon" src="/assets/ui/wallet.svg"/>花费</view>'
header = '''<view wx:if="{{viewScope!=='timeline'}}" class="card currency-card"><view class="currency-head"><view class="h2"><image class="ico inverse" src="/assets/ui/wallet.svg"/>花费</view><ui-select range="{{years}}" value="{{yearIndex}}" bindchange="yearChange" disabled="{{readOnly}}"><view class="select year-select" aria-label="统计年份"><text>{{year}}</text><text class="select-chevron">⌄</text></view></ui-select></view>'''
assert old in s, 'statistics total-card header changed'
s = s.replace(old, native_classes(header), 1)
s = s.replace('<view class="n-view metrics">', '<view wx:if="{{viewScope!==\'timeline\'}}" class="n-view metrics">', 1)
s = re.sub(r'<view class="n-view calendar-footer">.*?</button></view>', '', s, count=1)

# Both the overview and every record-detail sheet use the same timeline markup.
event_list = '''<template name="record-timeline"><view class="timeline record-timeline"><view wx:for="{{rows}}" wx:key="id" class="timeline-event" data-id="{{item.id}}" bindtap="selectRecord"><image wx:if="{{item.cover}}" class="timeline-art {{kind==='live'?'portrait':''}}" src="{{item.cover}}" data-src="{{item.cover}}" binderror="imageError" mode="aspectFill"/><view wx:else class="timeline-art initial">{{kind==='live'?'LIVE':'♪'}}</view><view class="timeline-info"><text>{{item.date||'日期待补'}}</text><text class="timeline-title">{{item.title}}</text><text>{{kind==='live'?(item.city||'城市待补')+(item.venue?' · '+item.venue:''):item.artist}}</text><text wx:if="{{item.sequence}}" class="life-tag">人生第 {{item.sequence}} {{kind==='live'?'场演出':'张唱片'}}</text></view><text wx:if="{{!readOnly}}" class="timeline-arrow">›</text></view></view></template>'''
template_data = 'kind:kind,readOnly:readOnly,uiLanguage:uiLanguage'
timeline = '''<block wx:elif="{{module.id==='timeline'}}"><view class="timeline-header"><view class="h2"><image class="ico" src="/assets/ui/calendar.svg"/>时间线</view><button wx:if="{{!readOnly}}" class="timeline-share" bindtap="openTimelineShare" aria-label="分享时间线"><image class="ico" src="/assets/ui/share.svg"/></button></view><view class="timeline-filter-row"><ui-select range="{{timelineYearLabels}}" value="{{timelineYearIndex}}" bindchange="timelineChange" disabled="{{readOnly}}"><view class="select timeline-select"><text>{{timelineYear}}</text><text class="select-chevron">⌄</text></view></ui-select><text class="muted">{{timeline.length}} {{kind==='live'?'场':'张'}}</text></view><template is="record-timeline" data="{{rows:timelinePreview,'''+template_data+'''}}"/><view wx:if="{{!timeline.length}}" class="empty">这一年还没有记录</view><button wx:if="{{timeline.length&&viewScope!=='timeline'}}" class="timeline-more" bindtap="openTimeline"><text>查看完整时间线</text><view><text>{{timeline.length}}</text><text class="timeline-arrow">›</text></view></button></block>'''
s, count = re.subn(r'<block wx:elif="{{module.id===\'timeline\'}}">.*?</block>', native_classes(timeline), s, count=1, flags=re.S)
assert count == 1
start = s.index('<view wx:for="{{detailRecords}}"')
end = s.index('<view wx:if="{{detailEmpty', start)
s = s[:start] + '<template is="record-timeline" data="{{rows:detailRecords,'+template_data+'}}"/>' + s[end:]
s = s.replace('<view class="n-view sheet">', '<view class="n-view sheet {{panel===\'share\'||panel===\'timelineShare\'?\'share-sheet\':\'\'}}">', 1)
s = s.replace('<button class="n-button close"', native_classes('''<button wx:if="{{panel==='timeline'&&!readOnly}}" class="timeline-share" bindtap="openTimelineShare" aria-label="分享时间线"><image class="ico" src="/assets/ui/share.svg"/></button>''') + '<button class="n-button close"', 1)
s = s.replace(' · {{year}}</text>', " · {{viewScope==='timeline'?timelineYear:year}}</text>", 1)
s = s.replace('发送给微信好友', '分享统计页面给好友')
s = s.replace('/assets/ui/copy.svg', '/assets/ui/share.svg')
share_timeline = '''<block wx:elif="{{panel==='timelineShare'}}"><button class="share-choice" open-type="share" disabled="{{!sharePath}}"><image class="ico" src="/assets/ui/share.svg"/><view><text>分享时间线给好友</text><text>{{timelineYear}} · {{timeline.length}} {{kind==='live'?'场':'张'}}</text></view><text>›</text></button><button class="share-choice" bindtap="generateTimelinePoster" loading="{{generating}}" disabled="{{generating}}"><image class="ico" src="/assets/ui/image.svg"/><view><text>时间线长图</text><text>仅包含当前时间线</text></view><text>›</text></button></block>'''
s = s.replace('<block wx:elif="{{panel===\'modules\'}}">', native_classes(share_timeline) + '<block wx:elif="{{panel===\'modules\'}}">', 1)
# Define after the themed root so its theme wrapper still applies to the board.
s += '\n' + native_classes(event_list)
write(rel, s)

rel = 'components/stats-board/index.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace('data:{selectedMonth:0,', "data:{viewScope:'stats',selectedMonth:0,", 1)
s = s.replace('year:opt.year,timelineYear:', "viewScope:opt.scope||'stats',year:opt.year,timelineYear:", 1)
s = s.replace('timelinePreview:view.timeline.slice(0,5)', "timelinePreview:this.data.viewScope==='timeline'?view.timeline:view.timeline.slice(0,5)", 1)
s = s.replace('this.setData({selectedMonth:index});this.rebuild();', 'this.setData({selectedMonth:index});this.rebuild();this.monthDetail({currentTarget:{dataset:{month:index+1}}});', 1)
s = s.replace("panel:'timeline',panelTitle:'完整时间线',detailRecords:this.data.timeline,detailCosts:[]", "panel:'timeline',panelTitle:'完整时间线',detailRecords:this.data.timeline,detailEmpty:!this.data.timeline.length,detailCosts:[]", 1)
s = s.replace("rows=rows.map(row=>", "rows=M.timelineRows(rows,this.data.records).map(row=>", 1)
s = s.replace("    openLink(){try{const data=", "    openLink(scope='stats'){this.setData({sharePath:''});try{const data=", 1)
s = s.replace('},message=snapshot.message(data);', "},message=snapshot.message({...data,scope:scope==='timeline'?'timeline':'stats'});", 1)
s = s.replace('    copyPath(){', '''    openTimelineShare(){this.openLink('timeline');this.setData({panel:'timelineShare',panelTitle:'分享时间线'});},
    async generateTimelinePoster(){return this.generatePoster(['timeline']);},
    copyPath(){''', 1)
s = s.replace('async generatePoster(){const modules=this.data.posterChoices.filter(r=>r.selected).map(r=>r.id);', 'async generatePoster(selected){const modules=Array.isArray(selected)?selected:this.data.posterChoices.filter(r=>r.selected).map(r=>r.id);', 1)
write(rel, s)

# A timeline share reuses the existing read-only route; it cannot open edit actions.
rel = 'ui/stats-snapshot.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace('return {v:1,kind:data.kind,', "return {v:1,scope:data.scope==='timeline'?'timeline':'stats',kind:data.kind,", 1)
s = s.replace('layout:M.normalizeLayout(data.kind,data.layout)', "layout:M.normalizeLayout(data.kind,data.layout).map(r=>data.scope==='timeline'?{...r,visible:r.id==='timeline'}:r)", 1)
s = s.replace("+'统计 · '+snap.year", "+(snap.scope==='timeline'?'时间线 · '+snap.timelineYear:'统计 · '+snap.year)", 1)
write(rel, s)

# Ring and legend stay matched in both themes, including empty rings.
rel = 'components/data-chart/index.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace("dark?'#30372c':'#edf0e8'", "dark?'#333333':'#eeeeee'")
s = s.replace("row.color||(dark?'#d1ff66':'#53664b')", "dark&&row.color!=='#d1ff66'?'#'+(0xffffff-parseInt((row.color||'#242424').slice(1),16)).toString(16).padStart(6,'0'):(row.color||'#242424')")
write(rel, s)

write('ui/stats-refinement.wxss', (UI / 'stats-refinement.wxss').read_text(encoding='utf-8'))
css('components/stats-board/index.wxss', '@import "../../ui/stats-refinement.wxss";')
