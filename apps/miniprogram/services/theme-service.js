const THEME_STORAGE_KEY = "vinylThemeSetting";

const DEFAULT_MODE = "standard";
const STANDARD_BACKGROUND = "#fbfaf6";
const WHITE_BACKGROUND = "#ffffff";
const DARK_BACKGROUND = "#101113";

const lightBaseVars = {
  "--color-ink": "#1a1a1a",
  "--color-muted": "#686a63",
  "--color-faint": "#9a9b94",
  "--color-line": "#d8d5cc",
  "--color-soft": "#efede6",
  "--color-action": "#65764d",
  "--color-select": "#65764d",
  "--color-sync": "#65764d",
  "--color-warning": "#9a7520",
  "--color-mustard": "#e7d37c",
  "--color-clay": "#b96d5b",
  "--color-sky": "#c9dcdd",
  "--palette-green-soft": "#dfe8d3",
  "--palette-yellow-soft": "#f1e8c3",
  "--palette-red-soft": "#ead0ca",
  "--theme-nav-surface": "rgba(239, 237, 230, 0.96)",
  "--theme-nav-border": "rgba(216, 213, 204, 0.9)",
  "--theme-nav-muted": "#898b84",
  "--theme-nav-hover": "rgba(255, 255, 255, 0.72)",
  "--theme-panel-tint": "rgba(101, 118, 77, 0.07)",
  "--theme-panel-border": "rgba(101, 118, 77, 0.1)",
  "--theme-card-surface": "rgba(255, 255, 255, 0.88)",
  "--theme-input-surface": "#ffffff",
  "--theme-primary-button-bg": "#1a1a1a",
  "--theme-primary-button-text": "#ffffff",
  "--theme-profile-card-bg": "#1a1a1a",
  "--theme-profile-card-text": "#ffffff",
  "--theme-profile-card-muted": "#e5ece5",
  "--theme-profile-card-faint": "#d7dee6",
  "--theme-icon-filter": "none",
};

const darkVars = {
  "--color-ink": "#f7f3ea",
  "--color-muted": "#b4b0a7",
  "--color-faint": "#7f8279",
  "--color-line": "rgba(247, 243, 234, 0.18)",
  "--color-soft": "#1d2020",
  "--color-paper": DARK_BACKGROUND,
  "--color-screen": DARK_BACKGROUND,
  "--color-action": "#b9c89b",
  "--color-select": "#b9c89b",
  "--color-sync": "#b9c89b",
  "--color-warning": "#e7d37c",
  "--color-mustard": "#e7d37c",
  "--color-clay": "#d8937f",
  "--color-sky": "#23373a",
  "--palette-red": "#cf705e",
  "--palette-black": "#171a1a",
  "--palette-green-soft": "rgba(185, 200, 155, 0.18)",
  "--palette-yellow-soft": "rgba(231, 211, 124, 0.18)",
  "--palette-red-soft": "rgba(216, 147, 127, 0.2)",
  "--theme-nav-surface": "rgba(29, 32, 32, 0.96)",
  "--theme-nav-border": "rgba(247, 243, 234, 0.18)",
  "--theme-nav-muted": "#9c9a92",
  "--theme-nav-hover": "rgba(247, 243, 234, 0.08)",
  "--theme-panel-tint": "rgba(185, 200, 155, 0.1)",
  "--theme-panel-border": "rgba(185, 200, 155, 0.16)",
  "--theme-card-surface": "#171a1a",
  "--theme-input-surface": "#171a1a",
  "--theme-primary-button-bg": "#b9c89b",
  "--theme-primary-button-text": "#101113",
  "--theme-profile-card-bg": "#171a1a",
  "--theme-profile-card-text": "#f7f3ea",
  "--theme-profile-card-muted": "#d4d0c7",
  "--theme-profile-card-faint": "#b4b0a7",
  "--theme-icon-filter": "invert(1) brightness(1.7)",
};

const themeOptions = [
  {
    mode: "standard",
    label: "标准模式",
    description: "现在的暖白唱片柜底色",
    swatch: STANDARD_BACKGROUND,
  },
  {
    mode: "white",
    label: "白色模式",
    description: "更干净的纯白底色",
    swatch: WHITE_BACKGROUND,
  },
  {
    mode: "dark",
    label: "暗夜模式",
    description: "低亮度深色界面",
    swatch: DARK_BACKGROUND,
  },
  {
    mode: "custom",
    label: "自定义底色",
    description: "输入或选择一个你喜欢的背景色",
    swatch: "#ddeedd",
  },
];

const customSwatches = [
  "#fbfaf6",
  "#ffffff",
  "#ddeedd",
  "#e8f1f4",
  "#f2e7df",
  "#efe7f3",
  "#101113",
  "#1f2622",
];

function getWxApi(wxApi) {
  if (wxApi) return wxApi;
  if (typeof wx === "undefined") return null;
  return wx;
}

function normalizeHexColor(value, fallback = STANDARD_BACKGROUND) {
  const text = String(value || "").trim();
  const shortMatch = text.match(/^#?([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    return `#${shortMatch[1].split("").map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }

  const fullMatch = text.match(/^#?([0-9a-fA-F]{6})$/);
  if (fullMatch) {
    return `#${fullMatch[1]}`.toLowerCase();
  }

  return fallback;
}

function getDefaultColor(mode) {
  if (mode === "white") return WHITE_BACKGROUND;
  if (mode === "dark") return DARK_BACKGROUND;
  return STANDARD_BACKGROUND;
}

function normalizeThemeSetting(value = {}) {
  const source = typeof value === "string" ? { mode: value } : (value || {});
  const mode = ["standard", "white", "dark", "custom"].includes(source.mode)
    ? source.mode
    : DEFAULT_MODE;
  const customColor = mode === "custom"
    ? normalizeHexColor(source.customColor, STANDARD_BACKGROUND)
    : getDefaultColor(mode);

  return {
    mode,
    customColor,
  };
}

function hexToRgb(hexColor) {
  const color = normalizeHexColor(hexColor);
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
}

function channelToLinear(value) {
  const normalized = value / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function getLuminance(hexColor) {
  const rgb = hexToRgb(hexColor);
  return (0.2126 * channelToLinear(rgb.r))
    + (0.7152 * channelToLinear(rgb.g))
    + (0.0722 * channelToLinear(rgb.b));
}

function isDarkColor(hexColor) {
  return getLuminance(hexColor) < 0.32;
}

function buildCssVars(setting) {
  const normalized = normalizeThemeSetting(setting);
  if (normalized.mode === "dark") {
    return { ...darkVars };
  }

  const background = normalized.mode === "white"
    ? WHITE_BACKGROUND
    : normalized.mode === "custom"
      ? normalized.customColor
      : STANDARD_BACKGROUND;
  const customDark = normalized.mode === "custom" && isDarkColor(background);
  const baseVars = customDark ? darkVars : lightBaseVars;

  return {
    ...baseVars,
    "--color-paper": background,
    "--color-screen": background,
  };
}

function cssVarsToStyle(vars) {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function buildThemeViewData(setting) {
  const normalized = normalizeThemeSetting(setting);
  const vars = buildCssVars(normalized);
  const backgroundColor = vars["--color-paper"];
  const frontColor = isDarkColor(backgroundColor) ? "#ffffff" : "#000000";
  const option = themeOptions.find((item) => item.mode === normalized.mode) || themeOptions[0];

  return {
    ...normalized,
    label: option.label,
    themeClass: `theme-${normalized.mode}`,
    themeStyle: cssVarsToStyle(vars),
    navigationBarBackgroundColor: backgroundColor,
    navigationBarFrontColor: frontColor,
    backgroundColor,
  };
}

function readStoredThemeSetting(wxApi) {
  const api = getWxApi(wxApi);
  if (!api || typeof api.getStorageSync !== "function") {
    return normalizeThemeSetting();
  }

  return normalizeThemeSetting(api.getStorageSync(THEME_STORAGE_KEY));
}

function writeStoredThemeSetting(setting, wxApi) {
  const normalized = normalizeThemeSetting(setting);
  const api = getWxApi(wxApi);
  if (api && typeof api.setStorageSync === "function") {
    api.setStorageSync(THEME_STORAGE_KEY, normalized);
  }
  return normalized;
}

function applyThemeChrome(themeViewData, wxApi) {
  const api = getWxApi(wxApi);
  if (!api) {
    return;
  }

  const viewData = buildThemeViewData(themeViewData);
  if (typeof api.setNavigationBarColor === "function") {
    api.setNavigationBarColor({
      frontColor: viewData.navigationBarFrontColor,
      backgroundColor: viewData.navigationBarBackgroundColor,
    });
  }
  if (typeof api.setBackgroundColor === "function") {
    api.setBackgroundColor({
      backgroundColor: viewData.backgroundColor,
      backgroundColorTop: viewData.backgroundColor,
      backgroundColorBottom: viewData.backgroundColor,
    });
  }
}

module.exports = {
  THEME_STORAGE_KEY,
  customSwatches,
  themeOptions,
  applyThemeChrome,
  buildThemeViewData,
  normalizeHexColor,
  normalizeThemeSetting,
  readStoredThemeSetting,
  writeStoredThemeSetting,
};
