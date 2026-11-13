# Keep the original image; ship the same-size, high-quality JPEG within the package limit.
shutil.copyfile(UI / 'miniprogram-code-device.jpg', DEST / 'assets/ui/miniprogram-code.jpg')
(DEST / 'assets/ui/miniprogram-code.webp').unlink(missing_ok=True)
"""Use the supplied SVG geometry for disclosure controls, after localization.

Navigation pagers retain their paired previous/next controls. Only presentation
changes here; picker bindings, conditional branches and hit targets stay intact.
"""
for name in ['chevron-down', 'chevron-right', 'reorder-up', 'reorder-down']:
    write('assets/ui/' + name + '.svg', (UI / (name + '.svg')).read_text(encoding='utf-8'))
write('ui/disclosure-icons.wxss', (UI / 'disclosure-icons.wxss').read_text(encoding='utf-8'))

def with_class(attrs, name):
    if re.search(r'\bclass="', attrs):
        return re.sub(r'\bclass="([^"]*)"', lambda m: 'class="' + m[1] + ' ' + name + '"', attrs, count=1)
    return attrs + ' class="' + name + '"'

def icon(direction, attrs=''):
    return '<image' + with_class(attrs, 'ui-disclosure ui-disclosure-' + direction) + ' src="/assets/ui/chevron-' + direction + '.svg" mode="aspectFit" aria-hidden="true"/>'

def replace_control(m):
    tag, attrs, body = m[1], m[2] or '', m[3]
    # These arrows move between records rather than expand or open a destination.
    if re.search(r'data-(?:direction|step)=|\bis-next\b', attrs):
        return m[0]
    if body == "{{selectedArtist.id===item.id?'✓':'›'}}":
        return '<text' + attrs + ' wx:if="{{selectedArtist.id===item.id}}">✓</text>' + icon('right', ' wx:else')
    for old, new in [('常用金额 ▾', '常用金额'), ('选择场次 ▾', '选择场次'), ('生成海报 ›', '生成海报')]:
        body = body.replace("i18n.t('" + old + "'", "i18n.t('" + new + "'")
    direction = 'down' if any(c in m[3] for c in '⌄▾') else 'right'
    label = re.sub('[⌄▾›]', '', body).rstrip()
    if not label.strip():
        return icon(direction, attrs)
    # Image siblings avoid font baselines and image-inside-text native behavior.
    inner = '<text>' + label + '</text>' + icon(direction)
    return '<' + ('view' if tag == 'text' else tag) + with_class(attrs, 'ui-disclosure-row') + '>' + inner + '</' + ('view' if tag == 'text' else tag) + '>'

changed_folders = set()
for file in sorted(DEST.rglob('*.wxml')):
    original = file.read_text(encoding='utf-8')
    result = re.sub(r'<(text|view|button)(\s[^<>]*?)?>([^<>]*[⌄▾›][^<>]*)</\1>', replace_control, original)
    if result != original:
        write(file.relative_to(DEST).as_posix(), result)
        changed_folders.add(file.parent)

# Component style isolation requires each owner to import the shared rules.
# Included WXML fragments such as add/pane.wxml use their owner's index.wxss.
for folder in sorted(changed_folders):
    for stylesheet in sorted(folder.glob('*.wxss')):
        depth = len(stylesheet.relative_to(DEST).parts) - 1
        rules = stylesheet.read_text(encoding='utf-8')
        write(stylesheet.relative_to(DEST).as_posix(), rules.rstrip() + '\n@import "' + '../' * depth + 'ui/disclosure-icons.wxss";\n')
