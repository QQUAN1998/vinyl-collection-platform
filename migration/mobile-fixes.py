"""Phone-specific fixes, applied after localization so all handlers are retained."""
def mobile_css(rel, text):
    write(rel,(DEST/rel).read_text(encoding='utf-8')+'\n'+text+'\n')
write('ui/editor-chrome.wxss',(UI/'editor-chrome.wxss').read_text(encoding='utf-8'))
for rel,title in [('pages/collection-edit/index','编辑收藏'),('packages/live-archive/pages/edit/edit','编辑现场')]:
    markup=(DEST/(rel+'.wxml')).read_text(encoding='utf-8')
    match=re.search(r'<button\b[^>]*class="[^"]*\bui-form-back\b[^"]*"[^>]*>.*?</button>',markup,flags=re.S)
    assert match, f'Missing editor return action: {rel}'
    back=match.group(0)
    title_expr="draft.id?i18n.t('编辑现场',uiLanguage):i18n.t('新建现场',uiLanguage)" if rel.startswith('packages/') else 'i18n.t('+repr(title)+',uiLanguage)'
    nav='<view class="{{uiThemeClass}} ui-editor-nav" style="{{uiThemeStyle}};height:{{uiChromeHeight}}px;padding-top:{{uiStatusHeight}}px">'+back+'<text class="ui-editor-title">{{'+title_expr+'}}</text></view>'
    markup=markup[:match.start()]+markup[match.end():]
    # Keep the chrome a sibling of the scrolling page, so content scroll cannot move it.
    at=markup.index('/>')+2 if markup.startswith('<wxs') else 0
    write(rel+'.wxml',markup[:at]+nav+markup[at:])
    mobile_css(rel+'.wxss','@import "'+('../../../../' if rel.startswith('packages/') else '../../')+'ui/editor-chrome.wxss";')

# Separate the clear action from the native picker's calendar icon.
mobile_css('components/date-field/index.wxss','''.date-control{display:flex;align-items:center;box-sizing:border-box;border:1px solid var(--color-line);border-radius:18px;background:var(--theme-card-surface);overflow:hidden}.date-control>picker{display:block;flex:1;min-width:0}.date-control .date-trigger{border:0!important;background:transparent!important;padding:12px 14px!important}.date-control .native-date-clear{position:static!important;flex:0 0 32px;width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;line-height:32px!important;margin:0 8px 0 0!important;padding:0!important;border-left:1px solid var(--color-line)!important;border-radius:0!important}.date-control .native-date-clear::after{border:0!important}''')
rel='packages/live-archive/pages/index/index.wxml'
write(rel,(DEST/rel).read_text(encoding='utf-8').replace('ui-album-dialog"','ui-album-dialog ui-live-preview"'))

# Keep the page itself and native overscroll surface in the selected palette.
# Explicit page-meta also covers Android, where backgroundColorBottom is iOS-only.
for f in DEST.rglob('*.json'):
    cfg=json.loads(f.read_text(encoding='utf-8'))
    if cfg.get('component') or not f.with_suffix('.wxml').exists(): continue
    markup=f.with_suffix('.wxml').read_text(encoding='utf-8')
    at=markup.index('/>')+2 if markup.startswith('<wxs') else 0
    meta='<page-meta background-color="{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}}" background-color-top="{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}}" background-color-bottom="{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}}" page-style="background:{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}};min-height:100vh;"/>'
    meta=meta.replace('<page-meta ', '<page-meta root-background-color="{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}}" ')
    if f.relative_to(DEST).as_posix() in ['pages/cabinet/index.json','packages/live-archive/pages/index/index.json']:
        meta=re.sub(r'(root-background-color|background-color-bottom)="[^"]*"',r'\1="{{uiModalBackground}}"',meta)
    write(f.with_suffix('.wxml').relative_to(DEST).as_posix(),markup[:at]+meta+markup[at:])

write('ui/mobile-polish.wxss',(UI/'mobile-polish.wxss').read_text(encoding='utf-8'))
for rel in ['app.wxss','pages/collection-edit/index.wxss','packages/live-archive/pages/edit/edit.wxss']:
    ref=os.path.relpath(DEST/'ui/mobile-polish.wxss',(DEST/rel).parent).replace('\\','/')
    mobile_css(rel,'@import "'+ref+'";')
polish=(UI/'mobile-polish.wxss').read_text(encoding='utf-8').splitlines()
for rel,prefix in [('components/home-dock/index.wxss','.home-dock'),('components/collection-deck/index.wxss','.deck-slide')]:
    mobile_css(rel,'\n'.join(line for line in polish if line.startswith(prefix)))
calendar=(DEST/'assets/ui/calendar.svg').read_text(encoding='utf-8')
write('assets/ui/calendar-light.svg',calendar.replace('#171a17','#ffffff'))
rel='components/date-field/index.wxml'
write(rel,(DEST/rel).read_text(encoding='utf-8').replace('/assets/ui/calendar.svg',"/assets/ui/calendar{{uiThemeClass==='theme-dark'?'-light':''}}.svg"))
for name in ['detail','delete']:
    svg=(UI/(name+'.svg')).read_text(encoding='utf-8')
    write('assets/ui/'+name+'.svg',svg)
    write('assets/ui/'+name+'-light.svg',svg.replace('#000000','#ffffff'))
write('assets/ui/back.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# Move existing actions, preserving permission conditions and delete confirmation.
for rel in ['pages/cabinet/index.wxml','packages/live-archive/pages/index/index.wxml']:
    markup=(DEST/rel).read_text(encoding='utf-8')
    deleted=re.search(r'<button\b[^>]*class="ui-dialog-delete"[^>]*>.*?</button>',markup,re.S)
    assert deleted, 'Missing preview delete: '+rel
    delete_button=deleted.group(0)
    markup=markup[:deleted.start()]+markup[deleted.end():]
    start=markup.index('<view class="ui-dialog-actions">')
    end=markup.index('</view>',start)
    actions=markup[start:end]+delete_button
    for cls,icon,label in [('ui-dialog-primary','detail','详情'),('ui-dialog-secondary','edit','编辑'),('ui-dialog-delete','delete','删除收藏')]:
        pattern=r'(<button\b[^>]*class="'+cls+r'"[^>]*>).*?</button>'
        def icon_button(m):
            tag=m[1][:-1]+' aria-label="{{i18n.t(\''+label+'\',uiLanguage)}}">'
            # Use explicit SVG fills; Android image filters can differ by renderer.
            return tag+'<image src="/assets/ui/'+icon+'{{uiThemeClass===\'theme-dark\'?\'-light\':\'\'}}.svg" mode="aspectFit"/></button>'
        actions,count=re.subn(pattern,icon_button,actions,flags=re.S)
        assert count==1,(rel,cls,count)
    write(rel,markup[:start]+actions+markup[end:])

rel='pages/collection-edit/index.wxml'
markup=(DEST/rel).read_text(encoding='utf-8').replace('class="edit-cover" src="{{album.cover}}" mode="aspectFill"','class="edit-cover" src="{{album.cover}}" mode="aspectFit"')
match=re.search(r'<view class="ghost-button cover-button".*?</view>',markup,re.S)
assert match
button=match.group(0)
markup=markup[:match.start()]+markup[match.end():]
start=markup.index('<view class="edit-cover-copy">')
end=markup.index('</view>\n  </view>',start)+len('</view>')
write(rel,markup[:end]+button+markup[end:])

rel='packages/live-archive/pages/edit/edit.wxml'
markup=(DEST/rel).read_text(encoding='utf-8')
markup=markup.replace('src="{{draft.cover||draft.posterUrl}}" mode="widthFix"','src="{{draft.cover||draft.posterUrl}}" mode="aspectFit"')
match=re.search(r'<button bindtap="cover">.*?</button>',markup,re.S)
assert match
button=match.group(0).replace('<button ','<button class="ui-replace-cover" ')
markup=markup[:match.start()]+markup[match.end():]
start=markup.index('class="live-edit-summary"')
end=markup.index('</view></view>',start)+len('</view>')
write(rel,markup[:end]+button+markup[end:])

config=json.loads((DEST/'app.json').read_text(encoding='utf-8'))
config['window'].update(backgroundColor='#f5f6f2',navigationBarBackgroundColor='#f5f6f2')
config['preloadRule']={'pages/cabinet/index':{'network':'all','packages':['packages/live-archive']}}
write('app.json',json.dumps(config,ensure_ascii=False,indent=2))
