"""Reproducible frontend patch over the verified, immutable native baseline."""
from pathlib import Path
import json, re, shutil, hashlib, html, datetime

ROOT = Path(__file__).resolve().parent.parent
META = json.loads((ROOT / 'migration/baseline.json').read_text(encoding='utf-8'))
BASE = ROOT / META['backup']
DEST = ROOT / META['project']
UI = ROOT / 'migration/ui'

def read(rel):
    return (BASE / rel).read_text(encoding='utf-8-sig')

def write(rel, text):
    target = DEST / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8', newline='\n')

def append(rel, text):
    write(rel, read(rel).rstrip() + '\n\n' + text.strip() + '\n')

# Always rebuild baseline files before applying presentation patches. This prevents
# repeated builds from accumulating wrappers or selectors in partially patched pages.
for rel, digest in META['files'].items():
    source = BASE / rel
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest, f'Backup changed: {rel}'
    target = DEST / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read_bytes())

for name in ['global.wxss', 'pages.wxss', 'live.wxss', 'deck-model.js', 'home-navigation.js','gallery-motion.js','guide-hint.js','release-date.js','detail-motion.js','detail-component.js','space-navigation.js', 'stats-model.js','stats-snapshot.js','stats-poster.js','stats-share-media.js']:
    write('ui/' + name, (UI / name).read_text(encoding='utf-8'))
# The main package cannot import a subpackage. Generate its read-only share
# configuration from the same immutable source, without a second editable config.
write('ui/live-share-config.js', read('packages/live-archive/config.js'))
for file in (UI / 'collection-deck').iterdir():
    write('components/collection-deck/' + file.name, file.read_text(encoding='utf-8'))
for folder in ['stats-board','space-header','home-dock']:
    for file in (UI / folder).iterdir(): write('components/' + folder + '/' + file.name, file.read_text(encoding='utf-8'))
for file in (UI / 'vendor').iterdir(): write('ui/vendor/' + file.name, file.read_text(encoding='utf-8'))
append('app.wxss', '@import "ui/global.wxss";')
for path in (BASE / 'pages').glob('*/*.wxss'):
    append(path.relative_to(BASE).as_posix(), '@import "../../ui/pages.wxss";')
for path in (BASE / 'packages/live-archive/pages').glob('*/*.wxss'):
    append(path.relative_to(BASE).as_posix(), '@import "../../../../ui/live.wxss";')

# Theme presets still use the original persistence, normalizer and custom/dark paths.
theme = read('services/theme-service.js')
light, rest = theme.split('const darkVars =', 1)
for a, b in {'#fbfaf6':'#f5f6f2','#1a1a1a':'#171a17','#686a63':'#747871','#d8d5cc':'#dde0d8','#efede6':'#edf0e8','#65764d':'#171a17','#e7d37c':'#d1ff66','#b96d5b':'#171a17','#c9dcdd':'#e7ece3','#dfe8d3':'#d1ff66','#f1e8c3':'#edf0e8','#ead0ca':'#e7ece3','rgba(239, 237, 230, 0.96)':'rgba(255, 255, 255, 0.98)'}.items():
    light = light.replace(a, b)
write('services/theme-service.js', light + 'const darkVars =' + rest)

# Existing switch handler still owns the routes; two pills only change its appearance.
write('components/switch-cabinet/index.wxml', '<view class="space-switch"><button class="space-tab {{current===\'vinyl\'?\'active\':\'\'}}" bindtap="open" aria-label="切换空间，当前{{current===\'vinyl\'?\'唱片柜\':\'演出集\'}}">唱片柜</button><button class="space-tab {{current===\'live\'?\'active\':\'\'}}" bindtap="open" aria-label="切换空间">演出集</button></view>')
write('components/switch-cabinet/index.wxss', ':host{display:block;flex:none;width:284rpx;order:0}.space-switch{display:flex;gap:4rpx;padding:6rpx;background:var(--color-soft,#edf0e8);border-radius:36rpx}.space-tab{width:136rpx;min-width:0;margin:0;padding:0;line-height:68rpx;height:68rpx;border:0;border-radius:30rpx;font-size:22rpx;font-weight:600;color:var(--color-ink,#171a17);background:transparent}.space-tab::after{border:0}.space-tab.active{background:#171a17;color:#fff}')

# Native navigation uses the exact four SVGs selected in the design.
icons = json.loads((ROOT / 'design-preview-20261029/navigation-icons.json').read_text(encoding='utf-8'))
for key, value in icons.items():
    write('assets/ui/' + key + '.svg', value['svg'].replace('currentColor', '#171a17'))
nav = read('components/bottom-nav/index.wxml').replace('{{item.iconSrc}}', "/assets/ui/nav-{{item.key==='cabinet'?'home':item.key==='account'?'mine':item.key}}.svg")
write('components/bottom-nav/index.wxml', nav.replace('{{item.label}}', "{{item.key==='cabinet'?'唱片柜':item.label}}"))
append('components/bottom-nav/index.wxss', '''
.bottom-nav{left:24rpx;right:24rpx;bottom:calc(16rpx + env(safe-area-inset-bottom));padding:10rpx;border:1rpx solid var(--color-line,#dde0d8);border-radius:36rpx;background:var(--theme-nav-surface,#fff);gap:6rpx;box-shadow:0 8rpx 30rpx rgba(0,0,0,.05)}
.bottom-nav-item{min-height:108rpx;border-radius:28rpx;gap:8rpx;color:var(--color-muted,#747871)}.bottom-nav-item.is-active{background:#d1ff66;color:#171a17}.bottom-nav-item.is-active::after{display:none}.bottom-nav-icon{width:42rpx;height:42rpx;opacity:.6}.is-active .bottom-nav-icon{opacity:1;filter:none}.bottom-nav-label{font-size:21rpx;font-weight:500}
''')
append('components/form-field/index.wxss', '.form-field-label{font-size:23rpx;font-weight:500;line-height:1.5;margin-bottom:12rpx}.form-field-control{min-height:88rpx;border-radius:36rpx;padding:0 24rpx;font-size:25rpx;font-weight:400;background:var(--theme-input-surface,#fff)}.form-field-control.is-textarea{padding:24rpx;line-height:1.6}')
append('components/media-format-selector/index.wxss', '.media-format-chip{border-radius:28rpx;font-size:23rpx;font-weight:500}.media-format-chip.is-selected{background:#d1ff66;color:#171a17}')

# Pure view adapters: existing cloud payloads, mutations, authorization and handlers untouched.
cab = read('pages/cabinet/index.js')
cab = cab.replace('      recentAlbums,\n      albumCard,', '      recentAlbums,\n      deckAlbums: collectedAlbums,\n      deckCollections: liveCollectionItems,\n      deckOwner: app.globalData.userProfile?.name || "",\n      deckAvatar: app.globalData.userProfile?.avatar || "",\n      albumCard,')
assert 'deckAlbums: collectedAlbums' in cab
cab = cab.replace('  openAlbum(event) {', '  togglePhotoWall() { this.setData({ photoWallExpanded: !this.data.photoWallExpanded }); },\n  openUiAccount() { wx.navigateTo({ url: "/pages/account/index" }); },\n  openAlbum(event) {')
write('pages/cabinet/index.js', cab)
cab = read('pages/cabinet/index.wxml')
header = '<view class="screen-title">我的唱片柜</view>'
cab = cab.replace(header, header + '<view class="ui-profile-entry" bindtap="openUiAccount" aria-role="button" aria-label="个人中心"><image wx:if="{{deckAvatar}}" src="{{deckAvatar}}" mode="aspectFill"/><text wx:else>我</text></view>')
cab = cab.replace('  <view class="photo-wall-section">', '  <collection-deck items="{{deckAlbums}}" collections="{{deckCollections}}" count="{{collectionCount}}" owner="{{deckOwner}}" bindselect="openAlbum" bindempty="openAdd"/>\n  <view class="photo-wall-section">')
cab = cab.replace('<view class="photo-wall-head">\n      <view class="screen-kicker">PHOTO WALL</view>\n    </view>', '<view class="ui-legacy-head" bindtap="togglePhotoWall" aria-role="button" aria-label="{{photoWallExpanded?\'收起\':\'展开\'}}照片墙"><view class="section-title">照片墙</view><text class="ui-fold">{{photoWallExpanded?\'收起 −\':\'展开 ＋\'}}</text></view>')
cab = cab.replace('<view class="photo-wall">', '<view class="photo-wall" wx:if="{{photoWallExpanded}}">')
write('pages/cabinet/index.wxml', cab)
config = json.loads(read('pages/cabinet/index.json'))
config.setdefault('usingComponents', {})['collection-deck'] = '/components/collection-deck/index'
write('pages/cabinet/index.json', json.dumps(config, ensure_ascii=False, indent=2))

live = read('packages/live-archive/pages/index/index.wxml')
live = live.replace('class="row page-head"', 'class="row page-head {{tab===\'home\'?\'home-head\':\'\'}}"')
live = live.replace('</text></view>\n  <view class="loading"', '</text><button wx:if="{{tab===\'home\'&&!shared}}" class="ui-live-profile" bindtap="openAccount" aria-label="个人中心"><image wx:if="{{account.avatar}}" src="{{account.avatar}}" mode="aspectFill"/><text wx:else>{{account.initial||"我"}}</text></button></view>\n  <view class="loading"', 1)
live = live.replace('  <block wx:if="{{tab===\'home\'}}">', '  <block wx:if="{{tab===\'home\'}}">\n    <collection-deck kind="live" items="{{records}}" count="{{count}}" owner="{{shared?\'\':account.name}}" show-amount="{{!shared}}" read-only="{{shared}}" bindselect="openDeck" bindempty="manual"/>')
live = live.replace('src="/packages/live-archive/assets/icons/{{item.id}}{{tab===item.id?\'-active\':\'\'}}.svg"', 'src="/assets/ui/nav-{{item.id}}.svg"')
write('packages/live-archive/pages/index/index.wxml', live.replace('{{item.label}}', "{{item.id==='home'?'演出集':item.label}}"))
livejs = read('packages/live-archive/pages/index/index.js')
livejs = livejs.replace('  open(e) {', '  openDeck(e) { this.open({ currentTarget: { dataset: { id: e.detail.id } } }); },\n  open(e) {')
# Navigation chrome color is presentation only.
livejs = livejs.replace('backgroundColor: "#fbfaf6"', 'backgroundColor: "#f5f6f2"')
write('packages/live-archive/pages/index/index.js', livejs)
config = json.loads(read('packages/live-archive/pages/index/index.json'))
config.setdefault('usingComponents', {})['collection-deck'] = '/components/collection-deck/index'
write('packages/live-archive/pages/index/index.json', json.dumps(config, ensure_ascii=False, indent=2))

# Remove decorative English only; operational hints, states and help stay readable.
for file in (BASE / 'pages').glob('*/index.wxml'):
    rel = file.relative_to(BASE).as_posix()
    if rel == 'pages/cabinet/index.wxml': continue
    text = read(rel)
    text = re.sub(r'<view class="screen-kicker">(?:DATA|ADD|MANUAL|BATCH|EDIT|PROFILE|ARCHIVE|SEARCH|CONFIRM|ACCOUNT|COLLECTION|THEME|GUIDE|TV)</view>', '', text)
    if text != read(rel): write(rel, text)

# Latest user decision: only TV sync is added back from features absent in the new design.
cab = (DEST / 'pages/cabinet/index.wxml').read_text(encoding='utf-8')
start = cab.index('  <view class="photo-wall-section">')
end = cab.index('  <view class="catalog-section', start)
cab = cab[:start] + cab[end:]
cab = re.sub(r'  <view class="add-fab"[^>]*></view>\s*', '', cab)
write('pages/cabinet/index.wxml', cab)
cabjs = (DEST / 'pages/cabinet/index.js').read_text(encoding='utf-8')
cabjs = cabjs.replace('    this.refreshDailyRecommendation(sourceAlbums, liveCollectionItems);', '    // New UI has no daily recommendation; collection and audio detail services stay unchanged.')
write('pages/cabinet/index.js', cabjs)
live = (DEST / 'packages/live-archive/pages/index/index.wxml').read_text(encoding='utf-8')
start = live.index('    <view class="section" wx:if="{{recent.length}}">')
end = live.index('    <view class="catalog">', start)
live = live[:start] + live[end:]
live = re.sub(r'      <view class="row status-tabs">.*?</view>\s*', '', live)
live = re.sub(r'        <picker class="sort-filter"[^\n]*\n', '', live)
live = live.replace('items="{{records}}" count="{{count}}"', 'items="{{uiSeenRecords}}" count="{{uiSeenCount}}"')
write('packages/live-archive/pages/index/index.wxml', live.replace('{{item.label}}', "{{item.id==='home'?'演出集':item.label}}"))
livejs = (DEST / 'packages/live-archive/pages/index/index.js').read_text(encoding='utf-8')
livejs = livejs.replace('      count: records.length,', '      count: records.length,\n      uiSeenRecords: records.filter(record => record.status === "已看过"),\n      uiSeenCount: records.filter(record => record.status === "已看过").length,')
livejs = livejs.replace('this.setData({ filtered: rows });', 'this.setData({ filtered: rows.filter(record => record.status === "已看过") });')
write('packages/live-archive/pages/index/index.js', livejs)
edit = read('packages/live-archive/pages/edit/edit.wxml')
edit = re.sub(r'<view class="field half"><view class="label">状态</view><picker[\s\S]*?</picker></view>', '', edit)
write('packages/live-archive/pages/edit/edit.wxml', edit)
detail = read('packages/live-archive/pages/detail/detail.wxml')
detail = re.sub(r'<picker class="status-picker"[\s\S]*?</picker>', '', detail)
write('packages/live-archive/pages/detail/detail.wxml', detail)

# Update obsolete visual assertions without changing functional assertions.
test = read('tests/miniprogram-data.test.js').replace('#fbfaf6', '#f5f6f2')
write('tests/miniprogram-data.test.js', test)
test = read('tests/miniprogram-static.test.js')
test = test.replace('path.resolve(root, "..", "api", "public", "downloads",', 'path.resolve(process.env.TV_ARTIFACT_ROOT || path.resolve(root, "..", "api"), "public", "downloads",')
a = test.index('  assert.ok(cabinetMarkup.includes("preview-player-card")')
b = test.index('  assert.match(cabinetStyles, /\\.search-box', a)
test = test[:a] + '  assert.ok(cabinetMarkup.includes("collection-deck"), "home uses the new native collection deck");\n  assert.doesNotMatch(cabinetMarkup, /preview-player-card|daily-recommend|photo-wall-section/, "old-only home sections follow the approved removal");\n' + test[b:]
test = test.replace('assert.ok(addMarkup.includes(">ADD<"), "add page includes a right-side header badge");', 'assert.doesNotMatch(addMarkup, />ADD</, "new UI omits decorative header badge");')
write('tests/miniprogram-static.test.js', test)

write('ui/artist-expenses.js',read('packages/live-archive/shared/artist-expenses.js'))
write('packages/live-archive/shared/artist-expenses.js',"module.exports=require('../../../ui/artist-expenses');\n")
# Shared native stats board implements the complete approved design using real data.
for kind, rel in [('vinyl','pages/stats/index'),('live','packages/live-archive/pages/index/index')]:
    config = json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'))
    config.setdefault('usingComponents',{}).update({'stats-board':'/components/stats-board/index','space-header':'/components/space-header/index'})
    write(rel+'.json',json.dumps(config,ensure_ascii=False,indent=2))
script=read('pages/stats/index.js')
script=script.replace('const { albums }', 'const uiStats = require("../../ui/stats-model");\nconst uiSnapshot = require("../../ui/stats-snapshot");\nconst { albums }',1)
script=script.replace('  onShow() {', '  onLoad(options) {\n    if(options.uiSnapshot) { try {const snap=uiSnapshot.decode(options.uiSnapshot);this.uiReadOnly=true;this.setData({uiRecords:snap.records,uiKind:snap.kind,uiOwner:snap.owner,uiReadOnly:true,uiSnapshotOptions:snap});} catch(e){wx.showToast({title:e.message,icon:"none"});this.uiReadOnly=true;} }\n  },\n  uiSelect(e) { if(this.uiReadOnly)return; this.openAlbumDetail({currentTarget:{dataset:{albumId:e.detail.id}}}); },\n  uiShare(e) { this.uiStatsShare=e.detail.message; },\n  onShow() {\n    if(this.uiReadOnly)return;',1)
script=script.replace('    const stats = calculateCollectionStats', '    this.setData({uiRecords:uiStats.vinylRecords(sourceAlbums,collectionItems),uiKind:"vinyl",uiOwner:app.globalData.userProfile?.name || "音乐收藏者",uiAvatar:app.globalData.userProfile?.avatar || ""});\n    const stats = calculateCollectionStats',1)
script=script.replace('    return createShareMessage();', '    if(this.uiStatsShare)return this.uiStatsShare;\n    return createShareMessage();')
write('pages/stats/index.js',script)
write('pages/stats/index.wxml','<view class="ui-native-screen"><space-header wx:if="{{!uiReadOnly}}" avatar="{{uiAvatar}}"/><stats-board records="{{uiRecords}}" kind="{{uiKind||\'vinyl\'}}" owner="{{uiOwner}}" read-only="{{uiReadOnly}}" snapshot-options="{{uiSnapshotOptions}}" bindselect="uiSelect" bindsnapshot="uiShare"/><bottom-nav wx:if="{{!uiReadOnly}}" active="stats"/></view>')
script=(DEST/'packages/live-archive/pages/index/index.js').read_text(encoding='utf-8')
script='const uiStats=require("../../../../ui/stats-model");\n'+script
script=script.replace('  calc() {','  uiSelect(e) { this.open({currentTarget:{dataset:{id:e.detail.id}}}); },\n  uiShare(e) { this.uiStatsShare=e.detail.message; },\n  calc() {\n    this.setData({uiStatsRecords:uiStats.liveRecords(this.data.records)});',1)
script=script.replace('  onShareAppMessage(event) {','  onShareAppMessage(event) {\n    if(this.data.tab==="stats"&&this.uiStatsShare)return this.uiStatsShare;',1)
write('packages/live-archive/pages/index/index.js',script)
markup=(DEST/'packages/live-archive/pages/index/index.wxml').read_text(encoding='utf-8')
a=markup.index('  <block wx:if="{{tab===\'stats\'}}">');b=markup.index('  <block wx:if="{{tab===\'mine\'}}">',a)
markup=markup[:a]+'  <block wx:if="{{tab===\'stats\'}}"><stats-board records="{{uiStatsRecords}}" kind="live" owner="{{account.name}}" read-only="{{shared}}" bindselect="uiSelect" bindsnapshot="uiShare"/></block>\n'+markup[b:]
write('packages/live-archive/pages/index/index.wxml',markup)
# Unified header on every primary tab, with no extra page-title bar above it.
for rel in ['pages/cabinet/index','pages/add/index']:
    config=json.loads((DEST/(rel+'.json')).read_text(encoding='utf-8'));config.setdefault('usingComponents',{})['space-header']='/components/space-header/index';write(rel+'.json',json.dumps(config,ensure_ascii=False,indent=2))
    markup=(DEST/(rel+'.wxml')).read_text(encoding='utf-8')
    if rel=='pages/cabinet/index':
        a=markup.index('  <view class="screen-header">'); b=markup.index('  <collection-deck',a)
        markup=markup[:a]+'  <space-header avatar="{{deckAvatar}}"/>\n'+markup[b:]
        markup=markup.replace('<view class="catalog-section home-catalog-section">','<view wx:if="{{collectionCount}}" class="catalog-section home-catalog-section">')
    else:
        markup=markup.replace('  <view class="screen-header">','  <space-header/>\n  <view class="screen-header">',1)
    write(rel+'.wxml',markup)
markup=(DEST/'packages/live-archive/pages/index/index.wxml').read_text(encoding='utf-8')
a=markup.index('<view class="row page-head');b=markup.index('<view class="loading"',a)
markup=markup[:a]+'<space-header wx:if="{{tab!==\'mine\'&&!shared}}" kind="live" avatar="{{account.avatar}}"/>'+markup[b:]
write('packages/live-archive/pages/index/index.wxml',markup)
# Exact prototype dimensions, while the OS continues to own the WeChat navigation chrome.
append('app.wxss', '@import "ui/global.wxss";\n.ui-native-screen{padding:16px 20px 124px;background:#f5f6f2;min-height:100vh;box-sizing:border-box}')
# Direct pill switch keeps the same original two destinations.
script=read('components/switch-cabinet/index.js')
script=script.replace('    open() {','    open(event) {\n      const requested=event?.currentTarget?.dataset?.space;\n      if(requested){if(requested!==this.properties.current)wx.reLaunch({url:requested==="live"?"/packages/live-archive/pages/index/index":"/pages/cabinet/index",fail:()=>wx.showToast({title:"切换失败，请重试",icon:"none"})});return;}')
write('components/switch-cabinet/index.js',script)
markup=(DEST/'components/switch-cabinet/index.wxml').read_text(encoding='utf-8').replace('bindtap="open"','data-space="vinyl" bindtap="open"',1)
a=markup.index('>唱片柜</button>'); markup=markup[:a]+markup[a:].replace('bindtap="open"','data-space="live" bindtap="open"',1)
write('components/switch-cabinet/index.wxml',markup)
write('components/switch-cabinet/index.wxss',':host{display:block;width:126px;flex:0 0 126px}.space-switch{display:flex;width:126px;box-sizing:border-box;gap:4px;padding:4px;background:#eef1e9;border-radius:18px}.space-switch .space-tab{box-sizing:border-box;width:57px!important;min-width:57px!important;max-width:57px;flex:0 0 57px;margin:0!important;padding:0!important;line-height:32px!important;height:32px!important;min-height:32px!important;border:0;border-radius:18px!important;font-size:11px!important;font-weight:600;color:#171a17;background:transparent}.space-tab::after{border:0}.space-tab.active{background:#171a17;color:#fff}')
# Source SVGs retain the exact supplied icon geometry.
icons=json.loads((ROOT/'design-preview-20261029/iconfont-icons.json').read_text(encoding='utf-8'))
for name,value in icons.items():
    if isinstance(value,dict) and 'svg' in value: write('assets/ui/'+name+'.svg',value['svg'].replace('currentColor','#171a17'))
exec(compile((ROOT/'migration/refine-ui.py').read_text(encoding='utf-8'), 'refine-ui.py', 'exec'))
exec(compile((ROOT/'migration/homepage-ui.py').read_text(encoding='utf-8'), 'homepage-ui.py', 'exec'))
exec(compile((ROOT/'migration/interaction-ui.py').read_text(encoding='utf-8'), 'interaction-ui.py', 'exec'))
exec(compile((ROOT/'migration/collection-sharing-ui.py').read_text(encoding='utf-8'), 'collection-sharing-ui.py', 'exec'))
exec(compile((ROOT/'migration/statistics-sharing-ui.py').read_text(encoding='utf-8'), 'statistics-sharing-ui.py', 'exec'))
exec(compile((ROOT/'migration/refinement-ui.py').read_text(encoding='utf-8'), 'refinement-ui.py', 'exec'))
exec(compile((ROOT/'migration/icon-artwork.py').read_text(encoding='utf-8'), 'icon-artwork.py', 'exec'))
exec(compile((ROOT/'migration/efficiency-ui.py').read_text(encoding='utf-8'), 'efficiency-ui.py', 'exec'))
exec(compile((ROOT/'migration/polish-ui.py').read_text(encoding='utf-8'), 'polish-ui.py', 'exec'))
exec(compile((ROOT/'migration/statistics-refinement-ui.py').read_text(encoding='utf-8'), 'statistics-refinement-ui.py', 'exec'))
exec(compile((ROOT/'migration/release-year-ui.py').read_text(encoding='utf-8'), 'release-year-ui.py', 'exec'))
exec(compile((ROOT/'migration/user-guide-ui.py').read_text(encoding='utf-8'), 'user-guide-ui.py', 'exec'))
exec(compile((ROOT/'migration/preferences-ui.py').read_text(encoding='utf-8'), 'preferences-ui.py', 'exec'))
exec(compile((ROOT/'migration/mobile-fixes.py').read_text(encoding='utf-8'), 'mobile-fixes.py', 'exec'))
exec(compile((ROOT/'migration/disclosure-ui.py').read_text(encoding='utf-8'), 'disclosure-ui.py', 'exec'))
exec(compile((ROOT/'migration/ticket-sharing-ui.py').read_text(encoding='utf-8'), 'ticket-sharing-ui.py', 'exec'))
exec(compile((ROOT/'migration/image-download-ui.py').read_text(encoding='utf-8'), 'image-download-ui.py', 'exec'))
exec(compile((ROOT/'migration/brand-presentation-ui.py').read_text(encoding='utf-8'), 'brand-presentation-ui.py', 'exec'))
write('ui/share-covers.js', (UI / 'share-covers.js').read_text(encoding='utf-8'))
for file in (UI / 'share-cards').glob('*.png'):
    target = DEST / 'assets/ui/share-cards' / file.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(file, target)
# Preserve cascade order while avoiding upload's unused-file dependency pruning
# of late imports. The IDE compiler and the upload compiler resolve them differently.
rel = 'components/stats-board/index.wxss'
style = (DEST / rel).read_text(encoding='utf-8')
for name in ['stats-layout', 'stats-polish', 'stats-refinement']:
    marker = '@import "../../ui/' + name + '.wxss";'
    assert style.count(marker) == 1, name
    style = style.replace(marker, '/* ' + name + ' */\n' + (UI / (name + '.wxss')).read_text(encoding='utf-8'))
write(rel, style)
exec(compile((ROOT/'migration/live-cleanup-ui.py').read_text(encoding='utf-8'), 'live-cleanup-ui.py', 'exec'))
exec(compile((ROOT/'migration/onboarding-gallery-ui.py').read_text(encoding='utf-8'), 'onboarding-gallery-ui.py', 'exec'))
exec(compile((ROOT/'migration/stats-short-share-ui.py').read_text(encoding='utf-8'), 'stats-short-share-ui.py', 'exec'))
# Known removals are explicit, rather than silently weakening the contract check.
allowed_removals = {
    # User explicitly removed appearance selection; language preferences remain.
    'pages/theme-settings/index.wxml': {'handleCustomColorInput','saveCustomColor','selectCustomSwatch','selectTheme'},
    'components/bottom-nav/index.wxml': {'handleTap'},
    'pages/cabinet/index.wxml': {'handleWallAction','openUiAccount','openPreviewPlayerDetail','togglePreviewPlayer','openDailyRecommendation','openAlbum','togglePhotoWall','handleCatalogSearch','clearCatalogSearch','selectCatalogScope'},
    'packages/live-archive/pages/index/index.wxml': {'status','view','year','annual','artistRanking','artistCurrency','rank','openAccount','refresh','tab'},
    'pages/add/index.wxml': {'goBatchInput'},
    'pages/stats/index.wxml': {'handleYearChange','openMonthDetail','toggleRank','openProfile','closeMonthDetail','openAlbumDetail'},
    'packages/live-archive/pages/detail/detail.wxml': {'status'},
}

# Verify original events against the newly approved feature boundary.
def events(text):
    return set(re.findall(r'(?:bind[\w:]*|catch[\w:]*)="([\w]+)"', text))
contracts = []
for file in BASE.rglob('*.wxml'):
    rel = file.relative_to(BASE).as_posix()
    old = events(read(rel)); new = events((DEST / rel).read_text(encoding='utf-8'))
    missing = sorted(old - new)
    contracts.append({'path':rel,'originalEvents':sorted(old),'missing':missing})
    unexpected = set(missing) - allowed_removals.get(rel, set())
    assert not unexpected, f'{rel}: unexpected removed original events {unexpected}'
protected = []
for rel, digest in META['files'].items():
    if rel in ['app.json', 'project.config.json']:
        expected = json.loads(read(rel))
        if rel == 'app.json':
            expected['lazyCodeLoading'] = 'requiredComponents'
            expected['window'].update(backgroundColor='#f5f6f2',navigationBarBackgroundColor='#f5f6f2')
            expected['preloadRule']={'pages/cabinet/index':{'network':'all','packages':['packages/live-archive']}}
        else:
            ignored = expected.setdefault('packOptions', {}).setdefault('ignore', [])
            ignored.append({'type':'folder','value':'tests'})
            ignored.extend({'type':'file','value':asset} for asset in pack_ignored_files)
        assert json.loads((DEST / rel).read_text(encoding='utf-8')) == expected, f'Unexpected config change: {rel}'
        continue
    if rel == 'services/catalog-api.js':
        current = (DEST / rel).read_text(encoding='utf-8')
        assert current.replace('    releaseDate: candidate.releaseDate || previousAlbum.releaseDate || undefined,\n','') == read(rel)
        continue
    if rel == 'services/cloud-api.js':
        current = (DEST / rel).read_text(encoding='utf-8')
        assert current.replace("const releaseDates=require('../ui/release-date');\n",'').replace('    releaseDate: album.releaseDate === undefined ? undefined : releaseDates.normalize(album.releaseDate) || null,\n','') == read(rel)
        continue
    if rel == 'services/onboarding-service.js':
        # Only the six instructional strings change; persistence/login gating stays exact.
        current = (DEST / rel).read_text(encoding='utf-8')
        assert current[current.index('function getWxApi'):] == read(rel)[read(rel).index('function getWxApi'):]
        continue
    if rel in locale_patched_scripts or rel == 'pages/theme-settings/index.js': continue
    if rel == 'pages/all-collection/index.js': continue
    if rel in ['packages/live-archive/shared/artist-expenses.js','services/theme-service.js','tests/miniprogram-data.test.js','tests/miniprogram-static.test.js']: continue
    if rel in ['pages/manual-add/index.js','pages/collection-edit/index.js','pages/album-detail/index.js','packages/live-archive/pages/detail/detail.js','pages/account/index.js','pages/cabinet/index.js', 'packages/live-archive/pages/index/index.js','packages/live-archive/pages/edit/edit.js','pages/stats/index.js','components/switch-cabinet/index.js','pages/add/index.js','components/form-field/index.js','components/media-format-selector/index.js']: continue
    if rel.endswith(('.wxml','.wxss')) or rel.endswith('.json') and rel not in ['app.json','project.config.json','sitemap.json']: continue
    actual = hashlib.sha256((DEST / rel).read_bytes()).hexdigest()
    assert actual == digest, f'Protected file changed: {rel}'
    protected.append(rel)
result = {'checkedAt':datetime.datetime.now().isoformat(),'baseline':META['backup'],'project':str(DEST),'contracts':contracts,'protectedUnchanged':protected}
(ROOT / 'migration/功能契约核对.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
changed = [rel for rel, digest in META['files'].items() if hashlib.sha256((DEST / rel).read_bytes()).hexdigest() != digest]
(ROOT / 'migration/变更清单.json').write_text(json.dumps(changed, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'changedExistingFiles':len(changed),'eventContracts':len(contracts),'protectedUnchanged':len(protected)},ensure_ascii=False))
