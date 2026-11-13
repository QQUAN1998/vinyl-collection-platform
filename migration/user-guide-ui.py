"""Keep the in-app manual aligned with the current collection workflows."""
sections = json.loads((UI / 'user-guide.json').read_text(encoding='utf-8'))
flows = {
 '02': [dict(screen='search',title='搜索唱片',caption='输入艺人或专辑名',action='搜索'),dict(screen='edit',title='确认收藏信息',caption='填写自己的收藏资料',action='保存收藏',fields=['收藏形式','数量','收藏日期']),dict(screen='saved',title='保存完成',caption='返回首页浏览收藏',action='返回首页'),dict(screen='card',title='查看唱片',caption='点击封面管理收藏',action='查看详情')],
 '03': [dict(screen='link',title='添加演出',caption='粘贴链接或手动新建',action='识别演出'),dict(screen='edit',title='确认演出信息',caption='核对观看日期和场馆',action='保存演出',fields=['观看日期','城市','演出场馆']),dict(screen='saved',title='保存完成',caption='添加后默认已看过',action='返回首页'),dict(screen='poster',title='演出集',caption='滑动海报回看现场',action='查看详情')],
 '05': [dict(screen='card',title='收藏卡片',caption='打开已收藏的记录',action='分享唱片'),dict(screen='poster',title='生成票根',caption='等待图片生成',action='正在生成'),dict(screen='poster',title='预览海报',caption='核对图片与收藏信息',action='保存海报'),dict(screen='saved',title='保存完成',caption='在相册查看和分享',action='完成')]
}
for section in sections:
    if section['index'] in flows: section['flow'] = flows[section['index']]
japanese = json.loads((UI / 'user-guide-ja.json').read_text(encoding='utf-8'))
assert len(japanese) == len(sections)
for section, translated in zip(sections, japanese): section['ja'] = translated
rel = 'pages/user-guide/index.js'
s = (DEST / rel).read_text(encoding='utf-8')
s, count = re.subn(r'guideSections: \[.*?\n    \]', 'guideSections: ' + json.dumps(sections, ensure_ascii=False, indent=4), s, count=1, flags=re.S)
assert count == 1, 'Manual section boundary changed'
s = s.replace('唱片柜小程序操作手册', '大收藏家 - 唱片演出记录 · 操作手册')
write(rel, s)
update('pages/account/index.wxml', lambda s: s.replace('class="onboarding-step-title">{{item.title}}', 'class="onboarding-step-title">{{i18n.guide(item.title,uiLanguage,item.ja.title)}}').replace('class="onboarding-step-desc">{{item.description}}', 'class="onboarding-step-desc">{{i18n.guide(item.description,uiLanguage,item.ja.description)}}'))
update('pages/user-guide/index.wxml', lambda s: s.replace('按真实流程查看常用操作，搜索收藏、今日推荐、试听、主题、更多收藏和微信分享都在这里。', '唱片柜与演出集的添加、编辑、分享和统计，按实际操作一步步说明。'))
update('pages/user-guide/index.wxml', lambda s: s.replace('{{item.title}}', '{{i18n.guide(item.title,uiLanguage,item.ja.title)}}').replace('{{item.description}}', '{{i18n.guide(item.description,uiLanguage,item.ja.description)}}').replace('{{item.steps}}', "{{uiLanguage==='ja'?item.ja.steps:item.steps}}").replace('{{step}}', '{{i18n.guide(step,uiLanguage)}}'))

# The same first-use steps appear in the account prompt and onboarding manual.
steps = [
    {'title': '搜索唱片', 'description': '从“添加”搜索刘德华，查看匹配的专辑。'},
    {'title': '添加收藏', 'description': '选择专辑，确认收藏形式、数量、品相和价格后保存。'},
    {'title': '编辑信息', 'description': '打开收藏卡片，点“编辑唱片”补充发行日期、收藏日期等资料。'},
    {'title': '查看详情', 'description': '点“查看详情”查看专辑资料与完整曲目。'},
    {'title': '分享票根', 'description': '点“分享唱片”生成纸质票根，可预览并保存海报。'},
    {'title': '整理收藏', 'description': '用“删除唱片”取消收藏，确认名称后再删除。'}
]
step_ja = [
    ('検索', '「追加」で刘德华を検索し、候補を確認します。'),
    ('所蔵に追加', '形式・枚数・状態・価格を確認して保存します。'),
    ('情報を編集', 'カードの「編集」で発売日や収集日を補足します。'),
    ('詳細を見る', '「詳細」で作品情報と全曲目を確認します。'),
    ('画像を共有', '「共有」で紙風の画像を作成・保存できます。'),
    ('所蔵を整理', '「削除」で所蔵を解除します。対象を確認して確定してください。')
]
for step, translated in zip(steps, step_ja): step['ja'] = {'title': translated[0], 'description': translated[1]}
rel = 'services/onboarding-service.js'
s = (DEST / rel).read_text(encoding='utf-8')
s, count = re.subn(r'const ONBOARDING_STEPS = \[.*?\n\];', 'const ONBOARDING_STEPS = ' + json.dumps(steps, ensure_ascii=False, indent=2) + ';', s, count=1, flags=re.S)
assert count == 1, 'Onboarding copy boundary changed'
write(rel, s)
