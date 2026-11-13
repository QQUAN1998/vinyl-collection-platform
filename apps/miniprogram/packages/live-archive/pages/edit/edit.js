const uiImageActions=require('../../../../ui/image-actions');
const uiLocale=require("../../../../ui/locale-runtime");
const routes = require("../../services/routes");
const state = require("../../services/state");
const api = require("../../services/archive");
const { TYPES, CURRENCIES, validDate } = require("../../shared/domain");
Page(uiLocale.page({uiImageActions(){const d=this.data;uiImageActions.openImage(d.draft?.cover||d.draft?.posterUrl);},

  data: {
    draft: {}, types: TYPES, busy: false, message: "",
    currencies: CURRENCIES,
    pricePresets: ["自定义", "免费", "180", "280", "380", "480", "580", "680", "880", "1280"],
    ticketPrices: [],
    dateValue: "",
    typeIndex: 0,
  },
  onLoad(options) {
    const record = options.id
      ? state.records.find((r) => r.id === options.id)
      : state.draft;
    this.editing = !!options.id;
    const { _importSource, ...fields } = record || {};
    this.importSource = this.editing ? "" : _importSource;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const types = fields.type === "戏剧 / 音乐剧" ? [...TYPES, fields.type] : TYPES;
    this.requestId = api.id();
    this.setData({
      types,
      typeIndex: Math.max(0, types.indexOf(fields.type || "演唱会")),
      dateValue: fields.date && validDate(fields.date)
        ? (fields.date + "-01-01").slice(0, 10) : today,
      ticketPrices: record?.expenses?.some(e => e.type === "票价")
        ? record.expenses.filter(e => e.type === "票价").map(e => ({ currency: e.currency, currencyIndex: CURRENCIES.indexOf(e.currency), amount: String(e.amount) }))
        : [{ currency: "CNY", currencyIndex: CURRENCIES.indexOf("CNY"), amount: "" }],
      draft: {
        name: "",
        artist: "",
        date: "",
        city: "",
        venue: "",
        type: "演唱会",
        cover: "",
        posterUrl: "",
        photos: [],
        tickets: [],
        songs: [],
        expenses: [],
        companion: "",
        source: "",
        ...fields,
        status: "已看过",
      },
    });
    if (options.id) uiLocale.title(wx,{ title: "编辑现场" });
  },
  uiCancel(){if(!this.data.busy)wx.navigateBack();},
  input(e) {
    this.setData({ ["draft." + e.currentTarget.dataset.key]: e.detail.value });
  },
  picker(e) {
    const index = Number(e.detail.value);
    if (this.data.busy || e.currentTarget.dataset.key !== "type" || !this.data.types[index]) return;
    this.setData({"draft.type":this.data.types[index], typeIndex:index});
  },
  dateChange(e) {
    const date = e.detail.value;
    if (this.data.busy || typeof date !== "string" || date.length !== 10 || !validDate(date)) return;
    this.setData({ "draft.date": date, dateValue: date, message: "" });
  },
  clearDate() {
    if (!this.data.busy) this.setData({ "draft.date": "" });
  },
  setPrice(index, patch) {
    if (this.data.busy || !Number.isInteger(index) || !this.data.ticketPrices[index]) return;
    this.setData({ ticketPrices: this.data.ticketPrices.map((row, i) => i === index ? { ...row, ...patch } : row), message: "" });
  },
  priceInput(e) {
    this.setPrice(Number(e.currentTarget.dataset.index), { amount: e.detail.value });
  },
  priceCurrency(e) {
    const currency = CURRENCIES[Number(e.detail.value)];
    if (currency) this.setPrice(Number(e.currentTarget.dataset.index), { currency, currencyIndex: CURRENCIES.indexOf(currency) });
  },
  pricePreset(e) {
    const value = this.data.pricePresets[Number(e.detail.value)];
    if (value && value !== "自定义") this.setPrice(Number(e.currentTarget.dataset.index), { amount: value === "免费" ? "0" : value });
  },
  addPrice() {
    if (this.data.busy) return;
    const otherCount = this.data.draft.expenses.filter(e => e.type !== "票价").length;
    if (otherCount + this.data.ticketPrices.length >= 100) {
      this.setData({ message: "费用最多 100 条" });
      return;
    }
    this.setData({ ticketPrices: [...this.data.ticketPrices, { currency: "CNY", currencyIndex: CURRENCIES.indexOf("CNY"), amount: "" }] });
  },
  removePrice(e) {
    if (this.data.busy) return;
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.ticketPrices[index]) return;
    const rows = this.data.ticketPrices.filter((_, i) => i !== index);
    this.setData({ ticketPrices: rows.length ? rows : [{ currency: "CNY", currencyIndex: CURRENCIES.indexOf("CNY"), amount: "" }] });
  },
  async cover() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const photos = await api.choose();
      this.setData({ "draft.cover": photos[0] });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  clearCover() {
    this.setData({ "draft.cover": "" });
  },
  async save() {
    if (this.data.busy) return;
    this.setData({ busy: true, message: "" });
    try {
      const expenses = this.data.draft.expenses.filter(e => e.type !== "票价").concat(
        this.data.ticketPrices.filter(row => String(row.amount).trim() !== "")
          .map(row => ({ type: "票价", currency: row.currency, amount: row.amount })),
      );
      const r = await api.save({ ...this.data.draft, status:"已看过", expenses }, this.requestId);
      if (this.importSource) state.completedImportSource = this.importSource;
      state.draft = null;
      state.detail = r;
      if (this.editing) wx.navigateBack({ delta: 1 });
      else wx.redirectTo({ url: routes.detail + "?id=" + r.id });
    } catch (e) {
      this.setData({ message: e.message });
      if (e.code === "CONFLICT") await api.load().catch(() => {});
    } finally {
      this.setData({ busy: false });
    }
  },
},"添加现场"));
