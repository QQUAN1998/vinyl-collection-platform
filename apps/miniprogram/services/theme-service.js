const THEME_STORAGE_KEY = "vinylThemeSetting";

const DEFAULT_MODE = "standard";
const STANDARD_BACKGROUND = "#f5f6f2";

const lightBaseVars = {
  "--color-ink": "#171a17",
  "--color-muted": "#747871",
  "--color-faint": "#9a9b94",
  "--color-line": "#dde0d8",
  "--color-soft": "#edf0e8",
  "--color-action": "#171a17",
  "--color-select": "#171a17",
  "--color-sync": "#171a17",
  "--color-warning": "#9a7520",
  "--color-mustard": "#d1ff66",
  "--color-clay": "#171a17",
  "--color-sky": "#e7ece3",
  "--palette-green-soft": "#d1ff66",
  "--palette-yellow-soft": "#edf0e8",
  "--palette-red-soft": "#e7ece3",
  "--theme-nav-surface": "rgba(255, 255, 255, 0.98)",
  "--theme-nav-border": "rgba(216, 213, 204, 0.9)",
  "--theme-nav-muted": "#898b84",
  "--theme-nav-hover": "rgba(255, 255, 255, 0.72)",
  "--theme-panel-tint": "rgba(101, 118, 77, 0.07)",
  "--theme-panel-border": "rgba(101, 118, 77, 0.1)",
  "--theme-card-surface": "rgba(255, 255, 255, 0.88)",
  "--theme-input-surface": "#ffffff",
  "--theme-primary-button-bg": "#171a17",
  "--theme-primary-button-text": "#ffffff",
  "--theme-profile-card-bg": "#171a17",
  "--theme-profile-card-text": "#ffffff",
  "--theme-profile-card-muted": "#e5ece5",
  "--theme-profile-card-faint": "#d7dee6",
  "--theme-icon-filter": "none",
};


const themeOptions = [
  { mode: "standard", label: "普通模式", description: "柔和底色与青柠点缀", swatch: STANDARD_BACKGROUND }
];
const customSwatches = [];

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
  return STANDARD_BACKGROUND;
}

function normalizeThemeSetting(value = {}) {
  const source = typeof value === "string" ? { mode: value } : (value || {});
  const mode = ["standard"].includes(source.mode)
    ? source.mode
    : DEFAULT_MODE;
  const customColor = getDefaultColor(mode);

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

  const background = getDefaultColor(normalized.mode);
  const baseVars = lightBaseVars;

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
