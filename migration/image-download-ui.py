"""Image viewing/saving stays separate from cover replacement and edit submission."""
write('ui/image-actions.js', (UI / 'image-actions.js').read_text(encoding='utf-8'))
for rel, depth, expression in [
    ('pages/collection-edit/index', '../../', 'album.cover'),
    ('pages/album-detail/index', '../../', 'album.cover'),
    ('pages/cabinet/index', '../../', 'albumCard.cover'),
    ('packages/live-archive/pages/edit/edit', '../../../../', 'draft.cover||draft.posterUrl'),
    ('packages/live-archive/pages/detail/detail', '../../../../', 'record.cover||record.posterUrl'),
    ('packages/live-archive/pages/index/index', '../../../../', 'uiPreviewRecord.cover||uiPreviewRecord.posterUrl'),
]:
    markup = (DEST / (rel + '.wxml')).read_text(encoding='utf-8')
    pattern = r'<image\b[^>]*\bsrc="{{' + re.escape(expression) + r'}}"[^>]*>'
    def bind_image(match):
        tag = re.sub(r'\s(?:bindtap|catchtap)="[^"]*"', '', match.group(0))
        tag = re.sub(r'\saria-(?:role|label)="[^"]*"', '', tag)
        end = '/>' if tag.endswith('/>') else '>'
        return tag[:-len(end)] + ' catchtap="uiImageActions" aria-role="button" aria-label="查看或保存图片"' + end
    markup, count = re.subn(pattern, bind_image, markup)
    assert count == (2 if rel == 'packages/live-archive/pages/edit/edit' else 1), (rel, count)
    write(rel + '.wxml', markup)
    script = (DEST / (rel + '.js')).read_text(encoding='utf-8')
    if rel == 'packages/live-archive/pages/detail/detail':
        write(rel + '.wxml', markup.replace('catchtap="uiImageActions"', 'catchtap="previewPoster"'))
        start = script.index('  previewPoster() {')
        end = script.index('  async mediaMenu(', start)
        script = script[:start] + '  previewPoster(){uiImageActions.openImage(this.data.record?.cover||this.data.record?.posterUrl);},\n' + script[end:]
        write(rel + '.js', "const uiImageActions=require('" + depth + "ui/image-actions');\n" + script)
        continue
    method = 'uiImageActions(){const d=this.data;uiImageActions.openImage(' + re.sub(r'\b(albumCard|album|draft|record|uiPreviewRecord)\.', r'd.\1?.', expression) + ');},\n'
    anchor = 'Page(uiLocale.page({'
    assert anchor in script, rel
    script = script.replace(anchor, anchor + method, 1)
    write(rel + '.js', "const uiImageActions=require('" + depth + "ui/image-actions');\n" + script)
