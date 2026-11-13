"""Brand assets and home typography; presentation only, no profile/storage writes."""
for file in (UI / 'brand').iterdir():
    if file.name == 'entry-logo.png':
        continue
    target = DEST / 'assets/ui/brand' / file.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(file, target)
# Entrance artwork remains in migration source and backups, but is no longer shipped.
for stale in ['components/brand-entry/index.js', 'components/brand-entry/index.json',
              'components/brand-entry/index.wxml', 'components/brand-entry/index.wxss',
              'assets/ui/brand/entry-logo.png']:
    (DEST / stale).unlink(missing_ok=True)

rel = 'components/collection-deck/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8')
start = markup.index('  <view class="n-view deck-summary">')
end = markup.index('\n  <block', start)
summary = '''<scroll-view class="deck-summary" scroll-x enhanced show-scrollbar="{{false}}"><view class="deck-summary-row">
    <view class="n-view deck-count">{{i18n.t('总收藏：',uiLanguage)}}{{totalQuantity}}{{uiLanguage==='en'?' ':''}}{{kind==='live'?i18n.t('场',uiLanguage):i18n.t('张',uiLanguage)}}</view>
    <text class="deck-summary-separator" aria-hidden="true"> | </text>
    <view class="n-view deck-unique">{{i18n.t('去重后：',uiLanguage)}}{{uniqueCount}}{{uiLanguage==='en'?' ':''}}{{kind==='live'?i18n.t('场',uiLanguage):i18n.t('张',uiLanguage)}}</view>
    <text wx:if="{{amountLabel}}" class="deck-summary-separator" aria-hidden="true"> | </text>
    <text wx:if="{{amountLabel}}" class="n-text deck-total">{{i18n.t('总花费：',uiLanguage)}}{{amountLabel}}</text>
  </view></scroll-view>'''
markup = markup[:start] + markup[end:]
title = re.search(r'<text class="n-text deck-greeting">.*?</text>', markup).group(0)
markup = markup.replace(title, '<view class="deck-heading">' + title + summary + '</view>', 1)
pattern = r'<text class="n-text deck-sequence">.*?</text>'
markup, count = re.subn(pattern, '''<text class="n-text deck-sequence" wx:if="{{current.sequence}}">{{i18n.t('人生第 ',uiLanguage)}}<text class="deck-sequence-number">{{current.sequence}}</text>{{kind==='live'?i18n.t(' 场现场',uiLanguage):i18n.t(' 张唱片',uiLanguage)}}</text>''', markup)
assert count == 1, 'ordinal markup drifted'
markup = markup.replace('class="n-image profile-placeholder" src="/assets/ui/nav-mine.svg" mode="aspectFit"', 'class="n-image default-avatar" src="/assets/ui/brand/default-avatar.jpg" mode="aspectFill"')
write(rel, markup)
rel = 'components/collection-deck/index.wxss'
write(rel, (DEST / rel).read_text(encoding='utf-8') + '''
/* Two compact lines share the avatar's vertical centre. */
.deck{padding-top:84px}
.deck .deck-top{height:76px;align-items:center}
.deck-heading{flex:1;min-width:0;margin-right:12px;display:flex;flex-direction:column;gap:4px;overflow:hidden}
.deck .deck-greeting{display:block;flex:none;margin:0;font-size:22px!important;font-weight:700;line-height:1.25;letter-spacing:-.3px;width:100%}
.deck .deck-summary{display:block;width:100%;height:16px;line-height:16px;padding:0!important;white-space:nowrap}
.deck-summary-row{display:inline-flex;align-items:baseline;padding:0;box-sizing:border-box;white-space:nowrap}
.deck .deck-count,.deck .deck-unique,.deck .deck-total,.deck .deck-summary-separator{display:block;flex:none;font-size:10px!important;font-weight:400!important;line-height:16px;color:var(--color-muted,#747871);letter-spacing:0;font-variant-numeric:tabular-nums;white-space:nowrap}
.deck-summary-separator{margin:0 4px}
.deck .deck-sequence-number{font-size:inherit!important;font-weight:700!important;color:#000!important}
.theme-dark.deck .deck-sequence-number{color:#fff!important}
.deck-profile .default-avatar{width:100%;height:100%}
''')

# Both the static title and locale lifecycle must use the shorter navigation label.
rel = 'pages/cabinet/index.json'
config = json.loads((DEST / rel).read_text(encoding='utf-8'))
config['navigationBarTitleText'] = '唱片柜'
write(rel, json.dumps(config, ensure_ascii=False, indent=2))
rel = 'pages/cabinet/index.js'
write(rel, (DEST / rel).read_text(encoding='utf-8').replace('},"我的唱片柜"));', '},"唱片柜"));'))

rel = 'components/space-header/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8').replace('src="/assets/ui/nav-mine.svg" mode="aspectFit"', 'src="/assets/ui/brand/default-avatar.jpg" mode="aspectFill"')
write(rel, markup)
rel = 'pages/account/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8')
markup, count = re.subn(r'<view wx:else class="profile-avatar">\{\{avatarInitial\}\}</view>', '<image wx:else class="profile-avatar" src="/assets/ui/brand/default-avatar.jpg" mode="aspectFill"/>', markup)
assert count == 2, 'account avatar markup drifted'
write(rel, markup)
rel = 'pages/user-profile/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8').replace('<view wx:else class="profile-avatar-large">{{avatarInitial}}</view>', '<image wx:else class="profile-avatar-large" src="/assets/ui/brand/default-avatar.jpg" mode="aspectFill"/>')
write(rel, markup)
rel = 'components/stats-board/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8').replace('<text class="n-text avatar">{{ownerInitial}}</text>', '<image class="n-image avatar" src="{{avatar||\'/assets/ui/brand/default-avatar.jpg\'}}" mode="aspectFill"/>')
write(rel, markup)
rel = 'packages/live-archive/pages/index/index.wxml'
markup = (DEST / rel).read_text(encoding='utf-8')
markup, count = re.subn(r'<view wx:else class="account-avatar account-initial">.*?</view>', '<image wx:else class="account-avatar" src="/assets/ui/brand/default-avatar.jpg" mode="aspectFill"/>', markup)
assert count == 1, 'live account avatar markup drifted'
write(rel, markup)

# Ticket branding and avatar fallback now live in the reproducible ticket-poster source.
# Keep statistics fallback artwork out of the persisted user profile and snapshot.
rel = 'ui/stats-poster.js'
script = (DEST / rel).read_text(encoding='utf-8')
script = "const DEFAULT_AVATAR='/assets/ui/brand/default-avatar.jpg';\n" + script
script = script.replace('const avatar=data.avatar;', 'const avatar=images.has(data.avatar)?data.avatar:DEFAULT_AVATAR;')
script = script.replace('[codeSrc,data.avatar,', '[codeSrc,data.avatar,DEFAULT_AVATAR,')
write(rel, script)

for rel, prefix in [('ui/locale-data.js', 'module.exports='), ('ui/locale.wxs', 'var dictionary=')]:
    script = (DEST / rel).read_text(encoding='utf-8')
    dictionary, length = json.JSONDecoder().raw_decode(script[len(prefix):])
    end = len(prefix) + length
    dictionary.update({'总收藏数':['Total collection: ', '総数 '], '去重':['Unique: ', '重複除外 '], '总收藏：':['Total: ', '総数：'], '去重后：':['Unique: ', '重複除外：'], '总花费：':['Spent: ', '総額：']})
    write(rel, prefix + json.dumps(dictionary, ensure_ascii=False, separators=(',', ':')) + script[end:])
