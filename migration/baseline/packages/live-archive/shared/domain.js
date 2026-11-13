"use strict";
const STATUS = ["已看过", "已购票", "想看"];
const TYPES = [
  "演唱会",
  "Livehouse",
  "音乐节",
  "音乐会",
  "戏剧",
  "音乐剧",
  "舞蹈",
  "展览",
  "其他",
];
const CURRENCIES = ["CNY", "HKD", "USD", "EUR", "GBP", "JPY", "TWD", "KRW"];
class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
function ensure(ok, message, code = "VALIDATION") {
  if (!ok) throw new AppError(code, message);
}
function text(value, max, label) {
  ensure(value == null || typeof value === "string", `${label}必须为文本`);
  const s = (value || "").trim();
  ensure(s.length <= max, `${label}过长`);
  return s;
}
function validDate(value) {
  if (!/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 2100) return false;
  if (value.length >= 7 && (!m || m > 12)) return false;
  if (
    value.length === 10 &&
    (!d || new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d)
  )
    return false;
  return true;
}
function list(value, max, label) {
  ensure(value == null || Array.isArray(value), `${label}格式错误`);
  const a = value || [];
  ensure(a.length <= max, `${label}最多 ${max} 项`);
  return a;
}
function media(value) {
  const s = text(value, 2048, "媒体");
  ensure(
    !s ||
      /^\/media\/[a-f0-9-]+$/.test(s) ||
      /^cloud:\/\/[a-zA-Z0-9._/-]+$/.test(s),
    "媒体地址不合法",
  );
  return s;
}
function posterUrl(value) {
  const s = text(value, 2048, "海报");
  if (!s) return "";
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new AppError("VALIDATION", "海报网址不合法");
  }
  ensure(
    u.protocol === "https:" && !u.username && !u.password,
    "海报必须为 HTTPS 地址",
  );
  return u.href;
}
function expense(value) {
  ensure(value && typeof value === "object", "费用格式错误");
  ensure(["票价", "交通", "住宿", "其他"].includes(value.type), "费用类别错误");
  const currency = text(value.currency, 3, "币种").toUpperCase();
  ensure(CURRENCIES.includes(currency), "币种不支持");
  const digits = ["JPY", "KRW"].includes(currency) ? 0 : 2;
  ensure(
    typeof value.amount === "number" ||
      (typeof value.amount === "string" && value.amount.trim() !== ""),
    "费用金额错误",
  );
  const amount = Number(value.amount);
  ensure(
    Number.isFinite(amount) && amount >= 0 && amount <= 10000000,
    "费用金额错误",
  );
  const units = Math.round(amount * 10 ** digits);
  ensure(
    Math.abs(units / 10 ** digits - amount) < 1e-8,
    `费用最多 ${digits} 位小数`,
  );
  return {
    type: value.type,
    amount: units / 10 ** digits,
    minor: units,
    currency,
  };
}
function normalizeRecord(value) {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "收藏格式错误",
  );
  const name = text(value.name, 200, "名称");
  ensure(name, "请填写演出名称");
  const status = value.status || "已看过";
  ensure(STATUS.includes(status), "状态错误");
  const date = text(value.date, 10, "日期");
  ensure(
    (date && validDate(date)) || (!date && status !== "已看过"),
    "请填写有效观看日期",
  );
  const type = value.type || "其他";
  // Historical combined categories remain editable without guessing their type.
  ensure(TYPES.includes(type) || type === "戏剧 / 音乐剧", "类型错误");
  const artist = text(value.artist, 500, "艺人")
    .split("/")
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" / ");
  const r = {
    name,
    artist,
    date,
    datePrecision: date
      ? { 4: "year", 7: "month", 10: "day" }[date.length]
      : "unknown",
    status,
    type,
    city: text(value.city, 80, "城市"),
    venue: text(value.venue, 160, "场馆"),
    companion: text(value.companion, 300, "同行人"),
    source: text(value.source, 2048, "来源"),
    posterUrl: posterUrl(value.posterUrl),
    cover: media(value.cover),
    photos: list(value.photos, 30, "照片").map(media),
    tickets: list(value.tickets, 5, "票根").map(media),
    songs: list(value.songs, 200, "曲目")
      .map((s) => text(s, 200, "曲目"))
      .filter(Boolean),
    expenses: list(value.expenses, 100, "费用").map(expense),
    theme: Number.isInteger(value.theme)
      ? Math.max(0, Math.min(5, value.theme))
      : 0,
    english: "LIVE\nARCHIVE",
    sourcePlatform: text(value.sourcePlatform, 30, "平台"),
    sourceId: text(value.sourceId, 100, "来源ID"),
  };
  return r;
}
function publicRecord(r) {
  return {
    id: r.id,
    name: r.name,
    artist: r.artist,
    date: r.date,
    datePrecision: r.datePrecision,
    status: r.status,
    type: r.type,
    city: r.city,
    venue: r.venue,
    posterUrl: r.posterUrl || "",
    theme: r.theme || 0,
    english: "LIVE\nARCHIVE",
  };
}
function statistics(records, year) {
  const rows = records.filter(
    (r) => r.status === "已看过" && (!year || r.date.startsWith(String(year))),
  );
  const artists = new Set(
    rows.flatMap((r) => r.artist.split(" / ").filter(Boolean)),
  );
  const cities = new Set(rows.map((r) => r.city).filter(Boolean)),
    venues = new Set(rows.map((r) => r.venue).filter(Boolean));
  const months = Array(12).fill(0),
    expenses = {};
  let unknownMonth = 0;
  for (const r of rows) {
    if (r.date.length >= 7) months[Number(r.date.slice(5, 7)) - 1]++;
    else unknownMonth++;
    for (const e of r.expenses || [])
      expenses[e.currency] = (expenses[e.currency] || 0) + e.minor;
  }
  return {
    shows: rows.length,
    artists: artists.size,
    cities: cities.size,
    venues: venues.size,
    months,
    unknownMonth,
    expenses,
    expenseCoverage: rows.filter((r) => r.expenses?.length).length,
    types: countBy(rows, (r) => r.type),
    artistRank: countBy(
      rows.flatMap((r) => r.artist.split(" / ").filter(Boolean)),
      (r) => r,
    ),
    cityRank: countBy(
      rows.filter((r) => r.city),
      (r) => r.city,
    ),
  };
}
function countBy(rows, key) {
  const map = Object.create(null);
  for (const r of rows) {
    const k = key(r);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
module.exports = {
  AppError,
  ensure,
  STATUS,
  TYPES,
  CURRENCIES,
  validDate,
  normalizeRecord,
  publicRecord,
  statistics,
  media,
};
