"""Final homepage help and illustrated manual; generated from reviewed sources."""
rel='components/collection-deck/index.wxml'
s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace("n-view deck {{kind", "n-view deck {{guideHintVisible&&!readOnly?'has-guide-hint':''}} {{kind",1)
marker='</scroll-view></view><button'
assert marker in s
hint='''</scroll-view><view wx:if="{{guideHintVisible&&!readOnly}}" class="n-view home-guide-notice"><view class="n-view home-guide-link" bindtap="openGuide" aria-role="link" aria-label="{{i18n.t('第一次使用？查看新手教程',uiLanguage)}}"><image class="n-image" src="/assets/ui/detail.svg"/><text class="n-text">{{i18n.t('第一次使用？查看新手教程',uiLanguage)}}</text><text class="n-text home-guide-arrow">→</text></view><button class="n-button home-guide-dismiss" bindtap="dismissGuide" aria-label="{{i18n.t('关闭',uiLanguage)}}">×</button></view></view><button'''
s=s.replace(marker,hint,1)
s=s.replace('bindtouchend="touchEnd" bindtouchcancel="touchEnd" bindtouchend="touchEnd" bindtouchcancel="touchEnd"','bindtouchend="touchEnd" bindtouchcancel="touchEnd"')
write(rel,s)
append('components/collection-deck/index.wxss','''
.deck.has-guide-hint{padding-top:104px}.deck.has-guide-hint .deck-top{height:104px}.has-guide-hint .deck-profile{align-self:flex-start;margin-top:18px!important}
.home-guide-notice{display:flex;align-items:center;gap:4px;min-height:28px;margin-top:2px;width:100%;box-sizing:border-box}
.home-guide-link{display:flex;align-items:center;gap:5px;min-width:0;flex:1;font-size:11px;line-height:16px;color:#53623c;min-height:28px}
.home-guide-link image{width:13px;height:13px;flex:none;opacity:.7}.home-guide-link text{white-space:normal;overflow-wrap:anywhere}.home-guide-arrow{flex:none;margin-left:2px}
.home-guide-dismiss{flex:none;width:28px!important;height:28px!important;min-height:0!important;margin:0!important;padding:0!important;font-size:18px!important;line-height:28px!important;background:transparent!important;color:#747871!important;border:0}.home-guide-dismiss::after{border:0}
''')
rel='pages/user-guide/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
marker='      <view class="guide-steps">'
assert s.count(marker)==1
phones='''      <view wx:if="{{item.flow}}" class="guide-phones">
        <view class="guide-phone-step" wx:for="{{item.flow}}" wx:for-item="phone" wx:key="title">
          <view class="guide-phone-number">{{index+1}}</view>
          <view class="guide-phone">
            <view class="guide-phone-bar"><view></view><text>•••</text></view>
            <view class="guide-phone-screen-title">{{i18n.t(phone.title,uiLanguage)}}</view>
            <view wx:if="{{phone.screen==='search'}}" class="guide-phone-search"><text>⌕</text><text>{{i18n.t('搜索艺人或专辑',uiLanguage)}}</text></view>
            <view wx:if="{{phone.screen==='search'}}" class="guide-phone-results"><view class="guide-mini-cover"></view><view><view class="guide-mini-line"></view><view class="guide-mini-line short"></view><text>{{i18n.t('选择目标专辑',uiLanguage)}}</text></view></view>
            <view wx:if="{{phone.screen==='link'}}" class="guide-phone-link"><text>↗</text><text>{{i18n.t('粘贴演出链接',uiLanguage)}}</text><view class="guide-mini-line"></view><view class="guide-mini-line short"></view></view>
            <view wx:if="{{phone.screen==='edit'}}" class="guide-phone-fields"><view wx:for="{{phone.fields}}" wx:for-item="field" wx:key="*this"><text>{{i18n.t(field,uiLanguage)}}</text><view class="guide-mini-line"></view></view></view>
            <view wx:if="{{phone.screen==='saved'}}" class="guide-phone-saved"><view>✓</view><text>{{i18n.t('已保存',uiLanguage)}}</text><view class="guide-mini-line"></view><view class="guide-mini-line short"></view></view>
            <view wx:if="{{phone.screen==='card'||phone.screen==='poster'}}" class="guide-phone-art {{phone.screen==='poster'?'is-poster':''}}"><view class="guide-mini-cover"></view><view class="guide-mini-line"></view><view class="guide-mini-line short"></view><view wx:if="{{phone.screen==='poster'}}" class="guide-mini-code">✳</view></view>
            <view wx:if="{{phone.screen==='card'}}" class="guide-phone-actions"><text>{{i18n.t('查看详情',uiLanguage)}}</text><text>{{i18n.t('编辑唱片',uiLanguage)}}</text><text>{{i18n.t('删除唱片',uiLanguage)}}</text><text>{{i18n.t('分享唱片',uiLanguage)}}</text></view>
            <view wx:else class="guide-phone-button">{{i18n.t(phone.action,uiLanguage)}}</view>
          </view>
          <view class="guide-phone-caption">{{i18n.t(phone.caption,uiLanguage)}}</view>
          <text wx:if="{{index===0||index===2}}" class="guide-phone-next">→</text>
        </view>
      </view>
'''
s=s.replace(marker,phones+marker,1);write(rel,s)
rel='pages/user-guide/index.wxss';s=(DEST/rel).read_text(encoding='utf-8')
s=re.sub(r'\.guide-card:nth-child\([234]\) \.guide-index\{[^}]*\}','',s)
write(rel,s)
append(rel,'''
.guide-card-head{grid-template-columns:68rpx minmax(0,1fr);align-items:start}.guide-card-head .screen-kicker{display:none}
.guide-index{flex:none;flex-shrink:0;border-radius:50%;background:#d1ff66!important;color:#171a17!important;font-weight:700}
.guide-title{font-weight:650;overflow-wrap:anywhere}.guide-desc{font-weight:400;line-height:1.65}.guide-step{font-weight:400;line-height:1.75;overflow-wrap:anywhere}.guide-heading{min-width:0}
.guide-phones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32rpx 36rpx;margin:30rpx 0;padding:0 4rpx}
.guide-phone-step{position:relative;min-width:0;text-align:center}.guide-phone-number{width:38rpx;height:38rpx;margin:0 auto 12rpx;border-radius:50%;background:#d1ff66;color:#171a17;font-size:22rpx;line-height:38rpx;font-weight:650}
.guide-phone{position:relative;height:316rpx;max-width:230rpx;box-sizing:border-box;margin:auto;padding:12rpx 14rpx 42rpx;border:3rpx solid #2e342d;border-radius:26rpx;background:#fff;box-shadow:0 8rpx 16rpx #252b2510;text-align:left;overflow:hidden}
.guide-phone-bar{display:flex;align-items:center;justify-content:space-between;height:15rpx;margin-bottom:14rpx}.guide-phone-bar view{width:44rpx;height:7rpx;border-radius:9rpx;background:#2e342d}.guide-phone-bar text{font-size:15rpx;color:#70786c}
.guide-phone-screen-title{font-size:19rpx;font-weight:650;line-height:1.35;text-align:center;margin-bottom:16rpx;overflow-wrap:anywhere}
.guide-phone-search{display:flex;align-items:center;gap:6rpx;padding:9rpx 6rpx;border-radius:7rpx;background:#f0f3eb;font-size:13rpx;line-height:1.35;color:#66715c}.guide-phone-results{display:flex;gap:10rpx;margin-top:22rpx;align-items:center}.guide-phone-results>view:last-child{flex:1;min-width:0}.guide-phone-results text{display:block;font-size:13rpx;line-height:1.5;color:#66715c;margin-top:8rpx}
.guide-mini-cover{width:62rpx;height:62rpx;flex:none;background:linear-gradient(145deg,#c9dd9c 0%,#65855c 58%,#e6e9df 59%);border-radius:4rpx}.guide-mini-line{height:5rpx;margin:10rpx 0;background:#d8ded0;border-radius:3rpx;width:100%}.guide-mini-line.short{width:65%}
.guide-phone-fields>view{margin-bottom:15rpx}.guide-phone-fields text{font-size:15rpx;color:#687261;line-height:1.35}.guide-phone-fields .guide-mini-line{margin:8rpx 0 0}
.guide-phone-button{position:absolute;bottom:15rpx;left:14rpx;right:14rpx;min-height:29rpx;display:flex;align-items:center;justify-content:center;padding:3rpx 5rpx;background:#d1ff66;border-radius:9rpx;font-size:15rpx;line-height:1.2;color:#171a17;text-align:center;box-sizing:border-box}
.guide-phone-saved{text-align:center;margin-top:28rpx}.guide-phone-saved>view:first-child{width:62rpx;height:62rpx;margin:0 auto 12rpx;background:#d1ff66;border-radius:50%;font-size:42rpx;line-height:62rpx}.guide-phone-saved text{font-size:17rpx}.guide-phone-saved .guide-mini-line{margin:14rpx auto;width:70%}.guide-phone-saved .guide-mini-line.short{width:40%}
.guide-phone-art .guide-mini-cover{width:98rpx;height:98rpx;margin:0 auto 12rpx}.guide-phone-art .guide-mini-line{width:80%;margin:8rpx auto}.guide-phone-art .guide-mini-line.short{width:52%}.guide-phone-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6rpx;margin-top:12rpx}.guide-phone-actions text{padding:5rpx 2rpx;text-align:center;background:#f0f3eb;border-radius:6rpx;font-size:12rpx;line-height:1.3;overflow-wrap:anywhere}
.guide-phone-art.is-poster{background:#23291f;padding:10rpx 8rpx 0}.is-poster .guide-mini-cover{width:74rpx;height:74rpx}.is-poster .guide-mini-line{background:#70785e}.guide-mini-code{background:#c3ed60;text-align:center;font-size:30rpx;line-height:35rpx;color:#344623;margin-top:8rpx}.guide-phone-link{padding:16rpx 6rpx;background:#f0f3eb;border-radius:10rpx}.guide-phone-link>text{display:block;font-size:17rpx;line-height:1.6}.guide-phone-link>text:first-child{font-size:34rpx;color:#657a45}
.guide-phone-caption{font-size:21rpx;line-height:1.5;margin-top:12rpx;color:#4d5945;overflow-wrap:anywhere}.guide-phone-next{position:absolute;right:-28rpx;top:174rpx;color:#70894d;font-size:28rpx}
''')

# The approved date field supersedes the old year-only presentation assertion.
rel='tests/miniprogram-static.test.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace(r'/album\.year \|\| album\.releaseYear \|\| "未记录"/',r'/releaseDates\.value\(album\)/')
write(rel,s)

# Compact help: the illustrated flows replace the duplicate six-step introduction.
rel='pages/user-guide/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
s=re.sub(r'  <view wx:if="{{mode === \'onboarding\'}}" class="guide-flow-card">.*?\n  <view class="guide-list">','  <view class="guide-list">',s,count=1,flags=re.S)
s=s.replace('class="guide-desc"','wx:if="{{item.description}}" class="guide-desc"')
s=s.replace('你可以先按下面 6 步熟悉完整流程。点按钮后会直接打开刘德华的在线搜索结果。','跟着图示完成添加、编辑和分享。')
s=s.replace('唱片柜与演出集的添加、编辑、分享和统计，按实际操作一步步说明。','跟着图示完成添加、编辑和分享。')
s=s.replace('隐藏唱片库与批量收藏','输入口令，查看隐藏唱片库')
write(rel,s)
rel='pages/account/index.wxml';s=(DEST/rel).read_text(encoding='utf-8')
for old,new in [('tv-action.png','tv.svg'),('theme-palette.svg','language.svg'),('share-action.png','manual.svg')]:
    s=s.replace('/assets/icons/'+old,'/assets/ui/'+new)
write(rel,s)
append('pages/account/index.wxss',"\n.tool-symbol,.theme-tool-symbol{width:44rpx;height:44rpx;opacity:1;filter:none}.tool-icon{border-radius:50%;}\n")

# The manual now documents the same operations in eight compact sections.
rel='tests/miniprogram-static.test.js';s=(DEST/rel).read_text(encoding='utf-8')
s=s.replace('accountMarkup.includes("tv-action.png"), "account device row uses the downloaded TV icon"','accountMarkup.includes("/assets/ui/tv.svg"), "account device row uses the supplied TV icon"')
s=s.replace('accountMarkup.includes("theme-palette.svg"), "account theme settings row uses the provided palette icon"','accountMarkup.includes("/assets/ui/language.svg"), "account language row uses the supplied globe icon"')
s=s.replace('["小程序操作手册", "首次收藏流程", "查看唱片", "编辑收藏", "添加与编辑演出", "删除唱片", "统计与排行", "语言设置", "账号与同步", "导入导出", "更多收藏", "分享票根"]','["小程序操作手册", "浏览收藏", "添加唱片", "记录演出", "编辑与删除", "统计与清单", "语言设置", "账号与设置", "导入导出", "分享票根"]')
write(rel,s)
