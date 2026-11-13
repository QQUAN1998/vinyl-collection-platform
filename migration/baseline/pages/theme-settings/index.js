const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  buildThemeViewData,
  customSwatches,
  normalizeHexColor,
  themeOptions
} = require("../../services/theme-service.js");

function buildThemeOptions(currentMode) {
  return themeOptions.map((item) => ({
    ...item,
    active: item.mode === currentMode
  }));
}

function buildPreviewStyle(themeViewData) {
  return `background: ${themeViewData.backgroundColor}; color: ${themeViewData.navigationBarFrontColor}`;
}

function buildThemeStateData(themeViewData) {
  return {
    selectedMode: themeViewData.mode,
    customColor: themeViewData.customColor,
    customColorInput: themeViewData.customColor,
    themeLabel: themeViewData.label,
    backgroundColor: themeViewData.backgroundColor,
    themeOptions: buildThemeOptions(themeViewData.mode),
    previewStyle: buildPreviewStyle(themeViewData)
  };
}

Page({
  data: {
    themeClass: "",
    themeStyle: "",
    selectedMode: "standard",
    customColor: "#ddeedd",
    customColorInput: "#ddeedd",
    themeLabel: "标准模式",
    backgroundColor: "#fbfaf6",
    themeOptions: buildThemeOptions("standard"),
    customSwatches,
    previewStyle: buildPreviewStyle(buildThemeViewData("standard"))
  },
  onLoad() {
    this.loadTheme();
  },
  onShow() {
    this.loadTheme();
  },
  loadTheme() {
    const app = getApp();
    const viewData = typeof app.getThemeViewData === "function"
      ? app.getThemeViewData()
      : buildThemeViewData("standard");
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }

    this.setData(buildThemeStateData(viewData));
  },
  selectTheme(event) {
    const mode = event.currentTarget.dataset.mode || "standard";
    const app = getApp();
    const setting = mode === "custom"
      ? { mode, customColor: this.data.customColorInput || this.data.customColor }
      : { mode };
    const viewData = typeof app.setTheme === "function"
      ? app.setTheme(setting)
      : buildThemeViewData(setting);

    this.setData(buildThemeStateData(viewData));
  },
  handleCustomColorInput(event) {
    this.setData({
      customColorInput: event.detail.value
    });
  },
  selectCustomSwatch(event) {
    const color = event.currentTarget.dataset.color || this.data.customColor;
    this.applyCustomColor(color);
  },
  saveCustomColor() {
    this.applyCustomColor(this.data.customColorInput);
  },
  applyCustomColor(value) {
    const customColor = normalizeHexColor(value, this.data.customColor || "#ddeedd");
    const app = getApp();
    const viewData = typeof app.setTheme === "function"
      ? app.setTheme({ mode: "custom", customColor })
      : buildThemeViewData({ mode: "custom", customColor });

    this.setData(buildThemeStateData(viewData));

    wx.showToast({
      title: "已应用主题",
      icon: "success"
    });
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
