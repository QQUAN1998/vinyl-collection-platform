"""Local display preferences. Never translate or rewrite stored collection data."""
import os

dictionary = {}
for line in (UI / 'translations.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip(): continue
    values = line.split('|')
    assert len(values) == 3, line
    assert values[0] not in dictionary, 'Duplicate translation: ' + values[0]
    dictionary[values[0]] = values[1:]
for key, compact in json.loads((UI / 'japanese-compact.json').read_text(encoding='utf-8')).items():
    assert key in dictionary, 'Unknown Japanese UI key: ' + key
    dictionary[key][1] = compact
encoded = json.dumps(dictionary, ensure_ascii=False, separators=(',', ':'))
traditional = json.loads((UI / 'traditional-data.json').read_text(encoding='utf-8'))
converter = 'var data=' + json.dumps(traditional, ensure_ascii=False, separators=(',', ':')) + ''';
var characters={};
for(var i=0;i<data.pairs.length;i+=2)characters[data.pairs.charAt(i)]=data.pairs.charAt(i+1);
function convert(value){
  if(typeof value!=='string')return value;
  if(data.phrases[value])return data.phrases[value];
  var result='';for(var i=0;i<value.length;i++){var c=value.charAt(i);result+=characters[c]||c;}return result;
}
module.exports={convert:convert};
'''
write('ui/traditional.js', converter)
write('ui/traditional.wxs', converter)
write('ui/locale-data.js', 'module.exports=' + encoded + ';\n')
write('ui/locale.wxs', '''var dictionary=''' + encoded + ''';
var traditional=require('./traditional.wxs');
function t(value, language) {
  if (typeof value !== 'string') return value;
  var start=0,end=value.length;
  while(start<end && (value[start]===' ' || value[start]==='\\t' || value[start]==='\\n')) start++;
  while(end>start && (value[end-1]===' ' || value[end-1]==='\\t' || value[end-1]==='\\n')) end--;
  var key=value.slice(start,end);
  if (language === 'zh' || !dictionary[key]) return value;
  if (language === 'zh-Hant') return value.replace(key,traditional.convert(key));
  var index = language === 'en' ? 0 : language === 'ja' ? 1 : -1;
  return index < 0 ? value : value.replace(key,dictionary[key][index]);
}
function owner(name, kind, language) {
  var title=t(kind === 'live' ? '演出集' : '唱片柜',language);
  if (language === 'en') return name + "'s " + title;
  return name + (language === 'ja' ? 'の' : '的') + title;
}
function money(currency,amount){var symbols={CNY:'￥',USD:'$',HKD:'HK$',TWD:'NT$',JPY:'JP¥',KRW:'₩',EUR:'€',GBP:'£'};return (symbols[currency]||currency+' ')+amount;}
function guide(value,language,japanese){if(language==='ja'&&japanese)return japanese;return language==='zh-Hant'?traditional.convert(value):t(value,language);}
function status(value,language){if(typeof value!=='string')return value;var parts=value.split(' · ');parts[0]=t(parts[0],language);return parts.join(' · ');}
module.exports={t:t,owner:owner,money:money,guide:guide,status:status};
''')
write('ui/locale-runtime.js', (UI / 'locale-runtime.js').read_text(encoding='utf-8'))

# One appearance. Legacy dark/custom settings safely fall back to Standard.
rel = 'services/theme-service.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace('const WHITE_BACKGROUND = "#ffffff";\n', '').replace('  if (mode === "white") return WHITE_BACKGROUND;\n', '')
start = s.index('const themeOptions ='); end = s.index('function getWxApi', start)
s = s[:start] + '''const themeOptions = [
  { mode: "standard", label: "普通模式", description: "柔和底色与青柠点缀", swatch: STANDARD_BACKGROUND }
];
const customSwatches = [];

''' + s[end:]
s = s.replace('["standard", "white", "dark", "custom"].includes', '["standard"].includes')
s = re.sub(r'const darkVars = \{.*?\n\};\n', '', s, flags=re.S)
s = s.replace('const DARK_BACKGROUND = "#101113";\n', '').replace('  if (mode === "dark") return DARK_BACKGROUND;\n', '')
s = s.replace('  if (normalized.mode === "dark") {\n    return { ...darkVars };\n  }\n', '')
start = s.index('  const customColor = mode === "custom"'); end = s.index('\n\n  return {', start)
s = s[:start] + '  const customColor = getDefaultColor(mode);' + s[end:]
start = s.index('  const background = normalized.mode === "white"'); end = s.index('\n  return {', start)
s = s[:start] + '''  const background = getDefaultColor(normalized.mode);
  const baseVars = lightBaseVars;
''' + s[end:]
write(rel, s)
for suffix in ['js', 'wxml', 'wxss']:
    write('pages/theme-settings/index.' + suffix, (UI / ('settings.' + suffix)).read_text(encoding='utf-8'))
settings_config = json.loads((DEST / 'pages/theme-settings/index.json').read_text(encoding='utf-8'))
settings_config['navigationBarTitleText'] = '语言设置'
write('pages/theme-settings/index.json', json.dumps(settings_config, ensure_ascii=False, indent=2))
update('pages/account/index.wxml', lambda s: s.replace('>主题设置<', '>设置<'))
update('pages/account/index.wxml', lambda s: s.replace('显示与语言', '语言设置'))
update('pages/account/index.wxml', lambda s: s.replace('{{themeSummary}} · 背景与顶部栏', '简体中文 / 繁體中文 / English / 日本語'))
update('pages/account/index.wxml', lambda s: s.replace('{{tvDeviceName}}', "{{tvDeviceName==='未绑定电视'?'未绑定电视':tvDeviceName}}").replace('{{tvMeta}}', '{{i18n.status(tvMeta,uiLanguage)}}'))

# Make generated UI colors inherit the existing theme variables, including
# isolated components and live subpackage pages. Artwork pixels are untouched.
colors = {
    '#f5f6f2': 'var(--color-screen)', '#fff': 'var(--theme-card-surface)',
    '#ffffff': 'var(--theme-card-surface)', '#171a17': 'var(--color-ink)',
    '#747871': 'var(--color-muted)', '#687063': 'var(--color-muted)',
    '#9a9b94': 'var(--color-faint)', '#e3e7de': 'var(--color-line)',
    '#dde0d8': 'var(--color-line)', '#d8dcd4': 'var(--color-line)',
    '#eef1e9': 'var(--color-soft)', '#edf0e8': 'var(--color-soft)',
    '#e8ece3': 'var(--color-soft)', '#edf3e3': 'var(--color-soft)',
    '#e1f4bb': 'var(--ui-heat-light)', '#b9ee45': 'var(--ui-heat-strong)'
}
for f in DEST.rglob('*.wxss'):
    if f.as_posix().endswith('pages/theme-settings/index.wxss'): continue # Preview thumbnails depict each theme.
    css = f.read_text(encoding='utf-8')
    css = re.sub(r'#[0-9a-fA-F]{3,8}\b', lambda m: colors.get(m[0].lower(), m[0]), css)
    write(f.relative_to(DEST).as_posix(), css)

theme_css = '''
.theme-standard,.theme-dark{--ink:var(--color-ink);--muted:var(--color-muted);--line:var(--color-line);--soft:var(--color-soft);--paper:var(--color-screen);--action:var(--color-action);background:var(--color-screen);color:var(--color-ink)}
.theme-standard{--ui-heat-light:#e1f4bb;--ui-heat-strong:#b9ee45}
.theme-dark{--ui-heat-light:#304129;--ui-heat-strong:#55782e}
.theme-dark .ui-icon,.theme-dark .ico,.theme-dark .tool-symbol,.theme-dark .device-symbol{filter:brightness(0) invert(1)}
.theme-dark .currency-card{background:#20251f;color:#f7f3ea}
.theme-dark .currency-card .ico{filter:invert(88%) sepia(67%) saturate(537%) hue-rotate(27deg) brightness(104%)}
.theme-dark .metric:first-child,.theme-dark .tone-3,.theme-dark .tone-4{color:#171a17}
.theme-dark .metric:first-child .ico{filter:none}
.theme-dark .tone-3 .month-label,.theme-dark .tone-4 .month-label{color:#26341d}
.theme-dark .tone-3 .month-number,.theme-dark .tone-4 .month-number{color:#171a17}
.theme-dark .ui-primary .ui-icon,.theme-dark .primary .ico{filter:none}
.theme-dark .edit-button{background:#d1ff66;color:#171a17}
.theme-dark .edit-button .ui-action-icon{filter:brightness(0)}
.theme-dark .profile-avatar{color:#171a17}
.theme-dark .deck-empty .n-button{background:#d1ff66;color:#171a17}
.theme-dark .dock-button.is-active{background:#d1ff66}
.theme-dark .dock-button .n-image{filter:brightness(0) invert(1)}
.theme-dark .dock-button.is-active .n-image{filter:brightness(0)}
.theme-dark .profile-placeholder,.theme-dark .space-profile .n-image{filter:var(--theme-icon-filter)}
.theme-dark .space-profile .n-image:not(.profile-placeholder){filter:none}
.theme-dark .ui-form-back,.theme-dark .ui-detail-back{background:#d1ff66!important}
.theme-dark .ui-form-back image,.theme-dark .ui-detail-back image{filter:brightness(0)!important}
.theme-dark .detail-edit,.theme-dark .detail-actions .ghost-button{color:#f2f3ed!important}
.theme-dark .detail-edit image,.theme-dark .detail-actions .ghost-button image{filter:brightness(0) invert(1)}
'''
theme_css = theme_css.replace('.theme-standard,.theme-dark{', '.theme-standard{')
theme_css = re.sub(r'\.theme-dark[^{}]*\{[^{}]*\}', '', theme_css)
write('ui/preference-theme.wxss', theme_css)
update('app.wxss', lambda s: s + '\n@import "ui/preference-theme.wxss";\n')
# Isolated components need their own theme selectors; do not rely on page CSS.
for f in DEST.rglob('*.json'):
    cfg = json.loads(f.read_text(encoding='utf-8'))
    if not cfg.get('component'): continue
    css = f.with_suffix('.wxss')
    if not css.exists(): continue
    ref = os.path.relpath(DEST / 'ui/preference-theme.wxss', css.parent).replace('\\', '/')
    update(css.relative_to(DEST).as_posix(), lambda s: s + '\n@import "' + ref + '";\n')

# All display targets subscribe to the same local preferences; listeners are
# removed on unload/detach. Existing event payloads and lifecycle hooks survive.
locale_patched_scripts = set()
for f in DEST.rglob('*.js'):
    rel = f.relative_to(DEST).as_posix()
    if rel.startswith(('tests/', 'services/', 'data/')) or rel == 'ui/locale-runtime.js': continue
    src = f.read_text(encoding='utf-8')
    cfg_path = f.with_suffix('.json')
    navigation_title = json.loads(cfg_path.read_text(encoding='utf-8')).get('navigationBarTitleText') if cfg_path.exists() else None
    # Supply the native route title without changing page configuration or routes.
    # Keep native Page/Component calls in the route module. The mini-program
    # loader associates registration with that module's current route.
    changed = src
    for native, wrapper in [('Page', 'page'), ('Component', 'component')]:
        match = re.search(r'\b' + native + r'\(\{', changed)
        if not match: continue
        # Existing controllers end their native declaration with });.
        closing = changed.rfind('});')
        assert closing > match.start(), rel
        title_arg = ',' + json.dumps(navigation_title, ensure_ascii=False) if native == 'Page' and navigation_title else ''
        changed = changed[:closing] + '}' + title_arg + '));' + changed[closing+3:]
        changed = re.sub(r'\b' + native + r'\(\{', native + '(uiLocale.' + wrapper + '({', changed, count=1)
    for old, new in [('showToast','toast'), ('showModal','modal'), ('showLoading','loading'), ('setNavigationBarTitle','title')]:
        changed = changed.replace('wx.' + old + '(', 'uiLocale.' + new + '(wx,')
    if changed == src: continue
    ref = os.path.relpath(DEST / 'ui/locale-runtime', f.parent).replace('\\', '/')
    if not ref.startswith('.'): ref = './' + ref
    write(rel, 'const uiLocale=require(' + json.dumps(ref) + ');\n' + changed)
    locale_patched_scripts.add(rel)

for rel in ['components/space-header/index.wxml', 'components/collection-deck/index.wxml']:
    update(rel, lambda s: re.sub(r'{{owner(?:\|\|\'我\')?}}的{{kind===\'live\'\?\'演出集\':\'唱片柜\'}}', "{{i18n.owner(owner||'我',kind,uiLanguage)}}", s))

tag_pattern = r'<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>'
def text_value(value):
    # Replace only display literals. Conditions and stored enum values stay Chinese.
    out = []
    for part in re.split(r'({{.*?}})', value, flags=re.S):
        if part.startswith('{{'):
            expr = part[2:-2]
            def display_literal(m):
                if not re.search('[\u4e00-\u9fff]', m[2]): return m[0]
                if re.search(r'(?:===|!==|==|!=)\s*$', expr[:m.start()]) or re.match(r'\s*(?:===|!==|==|!=)', expr[m.end():]): return m[0]
                if m[2].strip() not in dictionary: return m[0]
                return 'i18n.t(' + m[0] + ',uiLanguage)'
            expr = re.sub(r"(['\"])([^'\"]*)\1", display_literal, expr)
            # Only known UI labels, never album titles, artist names, notes or user input.
            if re.fullmatch(r'(?:item\.(?:label|description|unit)|module\.label|panelTitle|themeSummary|themeLabel|selectedLabel|profileActionLabel|tvStatusLabel|label|fact\.label|filterCity|filterType|filterYear|timelineYear|year)', expr.strip()):
                expr = 'i18n.t(' + expr + ',uiLanguage)'
            out.append('{{' + expr + '}}')
        else:
            clean = part.strip()
            if clean in dictionary:
                key = json.dumps(clean, ensure_ascii=False).replace("'", "\\'")
                # single quotes work inside WXML double-quoted attributes
                key = "'" + clean.replace('\\', '\\\\').replace("'", "\\'").replace('"', '&quot;') + "'"
                out.append(part.replace(clean, '{{i18n.t(' + key + ',uiLanguage)}}'))
            else: out.append(part)
    return ''.join(out)

for f in DEST.rglob('*.wxml'):
    src = f.read_text(encoding='utf-8')
    if f.relative_to(DEST).as_posix() == 'pages/easter-library/index.wxml':
        src = src.replace(' 张 · 未收藏 ', " {{i18n.t('张',uiLanguage)}} · {{i18n.t('未收藏',uiLanguage)}} ")
    parts = re.split('(' + tag_pattern + ')', src)
    first = True
    for index, part in enumerate(parts):
        if not part.startswith('<'): parts[index] = text_value(part); continue
        part = re.sub(r'(placeholder|aria-label)="([^"]*)"', lambda m: m[1] + '="' + text_value(m[2]) + '"', part)
        if first and re.match(r'<view\b', part):
            first = False
            if 'class="' in part: part = part.replace('class="', 'class="{{uiThemeClass}} ', 1)
            else: part = part.replace('<view', '<view class="{{uiThemeClass}}"', 1)
            if 'style="' in part: part = re.sub(r'style="([^"]*)"', lambda m: 'style="' + m[1] + ';{{uiThemeStyle}}"', part, count=1)
            else: part = part.replace('>', ' style="{{uiThemeStyle}}">', 1)
        parts[index] = part
    ref = os.path.relpath(DEST / 'ui/locale.wxs', f.parent).replace('\\', '/')
    result=''.join(parts)
    result=result.replace('custom-style="height:100%;background:#f5f6f2;"', 'custom-style="height:100%;background:{{uiThemeClass===\'theme-dark\'?\'#101113\':\'#f5f6f2\'}};"')
    if f.parent.name == 'ui-select':
        result=result.replace('{{rangeKey?item[rangeKey]:item}}', '{{i18n.t(rangeKey?item[rangeKey]:item,uiLanguage)}}')
    if f.parent.name == 'form-field':
        result=result.replace('placeholder="{{placeholder}}"', 'placeholder="{{i18n.t(placeholder,uiLanguage)}}"')
    for name in ['message', 'uiError', 'error']:
        result=result.replace('{{'+name+'}}', '{{i18n.t('+name+',uiLanguage)}}')
    if f.name == 'sheet.wxml':
        result=result.replace('<scroll-view class="ui-detail-scroll"', '<scroll-view style="{{uiThemeStyle}}" class="{{uiThemeClass}} ui-detail-scroll"')
    write(f.relative_to(DEST).as_posix(), '<wxs module="i18n" src="' + ref + '"/>\n' + result)

# The three old custom-mode assertions are superseded by the requested preset-only policy.
rel = 'tests/miniprogram-data.test.js'
s = (DEST / rel).read_text(encoding='utf-8')
s = s.replace('theme settings normalize standard, white, dark, and custom modes', 'theme settings normalize the two supported modes and migrate removed settings')
s = s.replace('mode: "white",\n    customColor: "#ffffff",', 'mode: "standard",\n    customColor: "#f5f6f2",')
s = s.replace('white.themeStyle, /--color-screen:\\s*#ffffff/', 'white.themeStyle, /--color-screen:\\s*#f5f6f2/')
s = s.replace('white.navigationBarBackgroundColor, "#ffffff"', 'white.navigationBarBackgroundColor, "#f5f6f2"')
s = s.replace('mode: "custom",\n    customColor: "#ddeedd",', 'mode: "standard",\n    customColor: "#f5f6f2",')
s = s.replace('custom.themeStyle, /--color-paper:\\s*#ddeedd/', 'custom.themeStyle, /--color-paper:\\s*#f5f6f2/')
s = s.replace('custom.themeStyle, /--color-screen:\\s*#ddeedd/', 'custom.themeStyle, /--color-screen:\\s*#f5f6f2/')
s = s.replace('custom.navigationBarBackgroundColor, "#ddeedd"', 'custom.navigationBarBackgroundColor, "#f5f6f2"')
s = s.replace('mode: "custom",\n    customColor: "#eef7f0",', 'mode: "standard",\n    customColor: "#f5f6f2",')
s = s.replace('navCalls[0].backgroundColor, "#eef7f0"', 'navCalls[0].backgroundColor, "#f5f6f2"')
s = s.replace('backgroundColor: "#eef7f0"', 'backgroundColor: "#f5f6f2"').replace('backgroundColorTop: "#eef7f0"', 'backgroundColorTop: "#f5f6f2"').replace('backgroundColorBottom: "#eef7f0"', 'backgroundColorBottom: "#f5f6f2"')
write(rel, s)

# Current single-appearance behavior replaces historical dark preset assertions.
s = s.replace('the two supported modes', 'the standard mode')
s = s.replace('mode: "dark",\n    customColor: "#101113",', 'mode: "standard",\n    customColor: "#f5f6f2",')
s = s.replace('  assert.match(dark.themeStyle, /--color-paper:\\s*#101113/);', '  assert.deepEqual(dark, standard);')
s = re.sub(r'^  assert\.(?:match|equal)\(dark\.[^\n]+\n', '', s, flags=re.M)
write(rel, s)

rel = 'tests/miniprogram-static.test.js'
s = (DEST / rel).read_text(encoding='utf-8').replace('.includes("wx.showModal")', '.includes("uiLocale.modal(wx,")')
s = s.replace('accountMarkup.includes("主题设置")', 'accountMarkup.includes("语言设置")').replace('accountMarkup.includes("显示与语言")', 'accountMarkup.includes("语言设置")')
s = s.replace('themeSettingsScript.includes("app.setTheme")', 'themeSettingsScript.includes("getApp().setTheme")')
s = s.replace('assert.ok(themeSettingsMarkup.includes("显示模式"), "theme settings page exposes preset theme modes");', 'assert.ok(themeSettingsMarkup.includes("主题样式"), "settings exposes theme presets");')
s = s.replace('assert.ok(themeSettingsMarkup.includes("自定义底色"), "theme settings page exposes custom background color");', 'assert.ok(themeSettingsMarkup.includes("界面语言"), "settings exposes language selection");')
s = s.replace('assert.ok(themeSettingsMarkup.includes("customSwatches"), "theme settings page exposes custom color swatches");', 'assert.ok(themeSettingsMarkup.includes("selectLanguage"), "settings applies language selection");')
s = s.replace('assert.ok(themeSettingsMarkup.includes("theme-status-row"), "theme settings page follows the shared compact status-row style");', 'assert.ok(themeSettingsMarkup.includes("theme-choices"), "settings uses compact theme previews");')
s = s.replace('assert.ok(themeSettingsMarkup.includes("theme-palette.svg"), "theme settings page uses the provided palette icon");', 'assert.ok(themeSettingsMarkup.includes("theme-mini"), "settings previews all theme appearances");')
s = s.replace('assert.ok(themeSettingsScript.includes("normalizeHexColor"), "theme settings page validates custom hex colors");', 'assert.ok(themeSettingsScript.includes("themeOptions.some"), "settings validates supported presets");')
s = s.replace('assert.match(themeSettingsStyles, /\\.theme-option-desc\\s*\\{[^}]*font-size:\\s*23rpx/s);', 'assert.match(themeSettingsStyles, /\\.choice-label\\s*\\{[^}]*max-width:\\s*100%/s);')
s = s.replace('assert.match(themeSettingsStyles, /\\.theme-option-desc\\s*\\{[^}]*line-height:\\s*1\\.35/s);', 'assert.match(themeSettingsStyles, /\\.theme-choice\\s*\\{[^}]*min-width:\\s*0/s);')
start = s.index('  assert.ok(themeSettingsMarkup.includes("主题样式")')
end = s.index('  for (const text of [', start)
s = s[:start] + '''  assert.ok(themeSettingsMarkup.includes("界面语言"), "settings keeps language selection");
  assert.ok(themeSettingsMarkup.includes("selectLanguage"), "settings applies language selection");
  assert.doesNotMatch(themeSettingsMarkup, /theme-choices|selectTheme|暗夜模式/, "appearance selection is removed");
''' + s[end:]
start = s.index('  for (const text of [', start)
end = s.index('\n});', start)
s = s[:start] + '''  for (const text of ["小程序操作手册", "首次收藏流程", "查看唱片", "编辑收藏", "添加与编辑演出", "删除唱片", "统计与排行", "语言设置", "账号与同步", "导入导出", "更多收藏", "分享票根"]) {
    assert.ok((userGuideMarkup + userGuideScript).includes(text), `operation manual documents ${text}`);
  }
  assert.ok(userGuideScript.includes("发行日期"), "manual explains editable release dates");
  assert.ok(userGuideScript.includes("单价 × 数量"), "manual documents quantity-aware totals");
  assert.doesNotMatch(userGuideScript, /今日推荐|照片墙|暗夜模式|自定义底色/, "manual does not advertise removed features");
''' + s[end:]
write(rel, s)
