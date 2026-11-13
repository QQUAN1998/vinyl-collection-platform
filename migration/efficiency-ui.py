"""1.2.5: retained primary panes, coalesced reads and shared layout fixes."""

def update(rel, transform):
    write(rel, transform((DEST / rel).read_text(encoding='utf-8')))

def replace_once(text, old, new):
    assert old in text, 'Expected source fragment missing: ' + old[:90]
    return text.replace(old, new, 1)

for name in ['primary-tabs.js', 'primary-pane.js', 'collection-refresh.js', 'layout.wxss']:
    write('ui/' + name, (UI / name).read_text(encoding='utf-8'))

# Load only page dependencies at startup; keep all existing routes and settings.
config = json.loads((DEST / 'app.json').read_text(encoding='utf-8'))
config['lazyCodeLoading'] = 'requiredComponents'
write('app.json', json.dumps(config, ensure_ascii=False, indent=2))
config = json.loads((DEST / 'project.config.json').read_text(encoding='utf-8'))
ignored = config.setdefault('packOptions', {}).setdefault('ignore', [])
if not any(row.get('type') == 'folder' and row.get('value') == 'tests' for row in ignored):
    ignored.append({'type': 'folder', 'value': 'tests'})
# Keep immutable legacy artwork locally, but omit unused gold theme variants from upload.
pack_ignored_files = json.loads((ROOT / 'migration/pack-ignored-assets.json').read_text(encoding='utf-8'))
for asset in pack_ignored_files:
    assert (DEST / asset).is_file(), asset
    entry = {'type': 'file', 'value': asset}
    if entry not in ignored:
        ignored.append(entry)
write('project.config.json', json.dumps(config, ensure_ascii=False, indent=2))

# The native horizontal track keeps its extent, but mounts at most seven cards.
# Stable slide keys preserve image nodes across overlapping windows.
rel = 'components/collection-deck/index.wxml'
s = (DEST / rel).read_text(encoding='utf-8')
s = replace_once(s, 'wx:for="{{slides}}"', 'wx:for="{{visibleSlides}}"')
s = s.replace('index===slides.length-1', 'item.slideKey===slides.length-1')
s = s.replace('slideStyles[index]', 'slideStyles[item.slideKey]')
s = s.replace('item.cover&&index>=physical-3&&index<=physical+3', 'item.cover')
s = replace_once(s, '<view wx:for="{{visibleSlides}}"', '<view class="n-view gallery-spacer" style="width:{{windowBefore}}px;"/><view wx:for="{{visibleSlides}}"')
s = replace_once(s, '        </view>\n      </scroll-view>', '          <view class="n-view gallery-spacer" style="width:{{windowAfter}}px;"/>\n        </view>\n      </scroll-view>')
write(rel, s)
update('components/collection-deck/index.wxss', lambda s: s + '''
.gallery-spacer{flex:none;height:1px}
.deck{background:var(--color-screen);padding-bottom:14px}
.live-deck .art-picture .n-image{width:100%;height:100%;filter:drop-shadow(2px 2px 1px #0002) drop-shadow(0 12px 11px #171a173d)}
.live-deck .ticket-art{background:transparent!important}
.deck-caption{width:100%;min-width:0;flex:none}
.deck-pagination{flex:none;padding-bottom:12px}
''')

# Remove repeated page headings; keep the fixed account heading and section labels.
update('pages/add/index.wxml', lambda s: replace_once(s, '<view class="ui-page-title">添加唱片</view>', ''))
update('packages/live-archive/pages/index/index.wxml', lambda s: s.replace('<view class="ui-page-title">添加现场</view>', ''))
update('app.wxss', lambda s: s + '\n@import "ui/layout.wxss";\n')
update('components/stats-board/index.wxss', lambda s: s + '\n@import "../../ui/stats-layout.wxss";\n')
write('ui/stats-layout.wxss', (UI / 'stats-layout.wxss').read_text(encoding='utf-8'))

# Native image artwork must have an explicit light fill; avoid relying on SVG
# filter inheritance inside a custom component on Android.
icon = (DEST / 'assets/ui/edit.svg').read_text(encoding='utf-8')
write('assets/ui/edit-light.svg', icon.replace('fill="#000000"', 'fill="#ffffff"'))
for page in ['pages/album-detail/index', 'pages/album-detail/sheet', 'packages/live-archive/pages/detail/detail', 'packages/live-archive/pages/detail/sheet']:
    update(page + '.wxml', lambda s: s.replace('/assets/ui/edit.svg', '/assets/ui/edit-light.svg'))

# Share the same refresh promise and freshness window across page controllers.
for page, loader in [('pages/cabinet/index', 'loadCabinet'), ('pages/stats/index', 'loadStats')]:
    rel = page + '.js'
    s = (DEST / rel).read_text(encoding='utf-8')
    s = "const {refreshCollection}=require('../../ui/collection-refresh');\n" + s
    start = s.index('    if (typeof app.loadCloudCollection === "function"', s.index('  onShow()'))
    end = s.index('\n  },', start)
    s = s[:start] + '''    refreshCollection(app).then(payload => {
      if (payload && !this.uiDisposed) this.''' + loader + '''();
    }).catch(() => {});''' + s[end:]
    if loader == 'loadCabinet':
        s = replace_once(s, '  onLoad() {', '  onLoad(options={}) {')
        s = replace_once(s, '    this.loadCabinet();\n  },\n  onShow()', "    if(['add','stats'].includes(options.tab))this.uiPrimary(options.tab);\n  },\n  onShow()")
        s = replace_once(s, '  onUnload() {', '  onUnload() {\n    this.uiDisposed = true;')
        start = s.index('    const collectionByAlbumId =', s.index('  loadCabinet()'))
        end = s.index('    this.setData({', start)
        s = s[:start] + s[end:]
        start = s.index('    this.setData({\n      collectionCount:', s.index('  loadCabinet()'))
        end = s.index('    // New UI', start)
        body = s[start:end].replace('    this.setData({', '    const view = {', 1).replace('    });', '    };', 1)
        s = s[:start] + body + '''    const signature = JSON.stringify(view);
    if (signature !== this.uiCabinetSignature) {
      this.uiCabinetSignature = signature;
      this.setData(view);
    }
''' + s[end:]
        s = s.replace('Page({', "const uiPrimaryTabs=require('../../ui/primary-tabs');\nPage({\n  ...uiPrimaryTabs,", 1)
        s = s.replace('  data: {', "  data: {uiTab:'home',uiMounted:{add:false,stats:false},", 1)
        s = replace_once(s, '  onShareAppMessage() {', '  onShareAppMessage(event) {\n    const paneMessage=this.uiPaneShare(event);if(paneMessage)return paneMessage;')
        start = s.index('  openAdd() {'); end = s.index('\n  },', start) + len('\n  },')
        s = s[:start] + "  openAdd() {this.uiPrimary('add');}," + s[end:]
    else:
        s = replace_once(s, '  loadStats() {', '  onUnload() {this.uiDisposed=true;},\n  loadStats() {')
        # Unchanged rows must not reset filters or regenerate the statistics tree.
        old = '    this.setData({uiRecords:uiStats.vinylRecords(sourceAlbums,collectionItems),uiKind:"vinyl",uiOwner:app.globalData.userProfile?.name || "音乐收藏者",uiAvatar:app.globalData.userProfile?.avatar || ""});'
        new = '''    const view={uiRecords:uiStats.vinylRecords(sourceAlbums,collectionItems),uiKind:"vinyl",uiOwner:app.globalData.userProfile?.name || "音乐收藏者",uiAvatar:app.globalData.userProfile?.avatar || ""};
    const signature=JSON.stringify(view);
    if(signature===this.uiStatsSignature)return;
    this.uiStatsSignature=signature;
    this.setData(view);'''
        s = replace_once(s, old, new)
    write(rel, s)

# Keep search, batches, shared statistics and original secondary routes intact.
# Generate embedded panes from those same controllers after all patches.
update('pages/add/index.js', lambda s: replace_once(s, '    this.loadAddPage();\n  },\n  onShow()', '  },\n  onShow()'))
for name in ['add', 'stats']:
    page = 'pages/' + name + '/index'
    src = (DEST / (page + '.js')).read_text(encoding='utf-8')
    src = replace_once(src, 'Page({', "require('../../ui/primary-pane')({")
    write('pages/' + name + '/pane.js', src)
    markup = (DEST / (page + '.wxml')).read_text(encoding='utf-8')
    markup = re.sub(r'<bottom-nav\b[^>]*/>', '', markup)
    write('pages/' + name + '/pane.wxml', markup)
    write('pages/' + name + '/pane.wxss', (DEST / (page + '.wxss')).read_text(encoding='utf-8'))
    cfg = json.loads((DEST / (page + '.json')).read_text(encoding='utf-8'))
    cfg.update(component=True, styleIsolation='apply-shared')
    write('pages/' + name + '/pane.json', json.dumps(cfg, ensure_ascii=False, indent=2))

rel = 'pages/cabinet/index.wxml'
s = (DEST / rel).read_text(encoding='utf-8')
start = s.index('  <collection-deck'); end = s.index('/>', start) + 2
s = s[:start] + '<view hidden="{{uiTab!==\'home\'}}">' + s[start:end] + '</view>' + s[end:]
s = s.replace('  <home-dock/>', '''  <view wx:if="{{uiMounted.add}}" hidden="{{uiTab!=='add'}}"><add-pane id="ui-add" visible="{{uiTab==='add'}}"/></view>
  <view wx:if="{{uiMounted.stats}}" hidden="{{uiTab!=='stats'}}"><stats-pane id="ui-stats" visible="{{uiTab==='stats'}}"/></view>
  <home-dock active="{{uiTab}}"/>''')
write(rel, s)
cfg = json.loads((DEST / 'pages/cabinet/index.json').read_text(encoding='utf-8'))
cfg['usingComponents'].update({'add-pane': '/pages/add/pane', 'stats-pane': '/pages/stats/pane'})
write('pages/cabinet/index.json', json.dumps(cfg, ensure_ascii=False, indent=2))
update('components/home-dock/index.js', lambda s: replace_once(s,
    "if(this.data.kind==='live'&&page?.route==='packages/live-archive/pages/index/index'&&typeof page.uiPrimary==='function')",
    "if(typeof page?.uiPrimary==='function'&&['pages/cabinet/index','packages/live-archive/pages/index/index'].includes(page.route))"))

# The live page already owns its primary panes; preserve its visited gallery.
rel = 'packages/live-archive/pages/index/index.wxml'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace("<block wx:if=\"{{tab==='home'||tab==='collection'}}\">", "<block>")
s = s.replace("<collection-deck wx:if=\"{{tab==='home'}}\"", "<collection-deck wx:if=\"{{uiHomeMounted}}\" hidden=\"{{tab!=='home'}}\"")
write(rel, s)
rel = 'packages/live-archive/pages/index/index.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace('  data: {', '  data: {uiHomeMounted:false,', 1)
s = replace_once(s, '  uiPrimary(tab){', '  uiPrimary(tab){')
s = s.replace('this.setData({tab});this.filter();', "this.setData({tab,...(tab==='home'?{uiHomeMounted:true}:{})});this.filter();", 1)
s = replace_once(s, '  onShow() {', "  onShow() {\n    if(this.data.tab==='home'&&!this.data.uiHomeMounted)this.setData({uiHomeMounted:true});")
# Project records once for each actual change, keeping image src nodes untouched.
s = replace_once(s, '  update(records) {', '''  update(records) {
    const signature=JSON.stringify(records);
    if(signature===this.uiRecordsSignature)return;
    this.uiRecordsSignature=signature;''')
s = s.replace('r.date.slice(0, 4)', "String(r.date||'').slice(0, 4)")
write(rel, s)
