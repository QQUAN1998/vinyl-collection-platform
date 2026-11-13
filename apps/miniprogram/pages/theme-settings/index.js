const uiLocale=require("../../ui/locale-runtime");
const locale = require('../../ui/locale-runtime');
const { themeOptions, buildThemeViewData } = require('../../services/theme-service');
const { createShareMessage, createShareTimeline } = require('../../services/share');

Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  data: { themeOptions: [], languages: locale.LANGUAGES },
  onShow() { this.loadSettings(); },
  loadSettings() {
    const app = getApp();
    const theme = app.getThemeViewData ? app.getThemeViewData() : buildThemeViewData();
    this.setData({ selectedMode: theme.mode, themeClass: theme.themeClass, themeStyle: theme.themeStyle,
      themeOptions, selectedLanguage: locale.current() });
    locale.title(wx, { title: '语言设置' });
  },
  selectTheme(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!themeOptions.some(item => item.mode === mode)) return;
    getApp().setTheme({ mode });
    locale.refresh();
    this.loadSettings();
  },
  selectLanguage(event) {
    const code = event.currentTarget.dataset.code;
    if (!locale.LANGUAGES.some(item => item.code === code)) return;
    try {
      locale.select(code);
      this.setData({ selectedLanguage: code });
    } catch (_) { locale.toast(wx, { title: '保存失败，请重试', icon: 'none' }); }
  },
  onShareAppMessage() { return createShareMessage(); },
  onShareTimeline() { return createShareTimeline(this.onShareAppMessage()); }
},"语言设置"));
