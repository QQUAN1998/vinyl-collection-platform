const DEFAULT_MEDIUM_KEY = "vinyl";

const MEDIA_FORMATS = [
  { key: "vinyl", label: "黑胶", color: "#b96d5b" },
  { key: "cd", label: "CD", color: "#e6cc88" },
  { key: "vcd", label: "VCD", color: "#8dbdae" },
  { key: "dvd", label: "DVD", color: "#c28b5e" },
  { key: "blu-ray", label: "蓝光", color: "#a9c8d6" },
  { key: "cassette", label: "磁带", color: "#1f2020" },
  { key: "usb", label: "USB", color: "#8a8178" },
  { key: "digital", label: "数字专辑", color: "#e4e4e4" },
  { key: "ld", label: "LD", color: "#546ac8" },
  { key: "vhs", label: "VHS", color: "#60656c" },
  { key: "md", label: "MD", color: "#e97d5d" },
];

function normalizeMediumKey(value) {
  const key = String(value || "").trim();
  return MEDIA_FORMATS.some((item) => item.key === key) ? key : DEFAULT_MEDIUM_KEY;
}

function getMediaFormat(value) {
  const key = normalizeMediumKey(value);
  return MEDIA_FORMATS.find((item) => item.key === key) || MEDIA_FORMATS[0];
}

module.exports = {
  DEFAULT_MEDIUM_KEY,
  MEDIA_FORMATS,
  getMediaFormat,
  normalizeMediumKey,
};
