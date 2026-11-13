const uiImageActions=require('../../../../ui/image-actions');
const uiLocale=require("../../../../ui/locale-runtime");
const uiDetailMotion=require('../../../../ui/detail-motion');
const routes = require("../../services/routes");
const state = require("../../services/state");
const api = require("../../services/archive");
Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  ...uiDetailMotion,
  data: {
    uiDragY:0,uiDetailOpacity:1,uiClosing:false,
    record: null,
    shared: false,
    busy: false,
    panel: "",
    songsText: "",
    expensesText: "",
    companion: "",
    message: "",
  },
  onLoad(options) {
    this.id = options.id;
    this.setData({ shared: options.shared === "1" });
    this.refresh();
  },
  async onShow() {
    wx.setNavigationBarColor({ frontColor: "#000000", backgroundColor: "#fbfaf6" });
    if (!this.id) return;
    this.refresh();
    if (this.data.shared || this.data.busy || this.reloadTask) return;
    this.reloadTask = true;
    try {
      await api.load();
      this.refresh();
    } catch (e) {
      this.setData({ message: e.message || "刷新失败，请重试" });
    } finally {
      this.reloadTask = false;
    }
  },
  refresh() {
    const r = this.data.shared
      ? state.detail
      : state.records.find((r) => r.id === this.id);
    if (r) this.setData({ record: r, message: "" });
    else this.setData({ record: null, message: "收藏不存在" });
  },
  edit() {
    if (!this.data.shared)
      wx.navigateTo({ url: routes.edit + "?id=" + this.id });
  },
  async update(record) {
    if (this.data.shared || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const r = await api.save(record);
      this.setData({ record: r, message: "" });
    } catch (e) {
      this.setData({ message: e.message });
      if (e.code === "CONFLICT") {
        await api.load().catch(() => {});
        this.refresh();
      }
    } finally {
      this.setData({ busy: false });
    }
  },
  async upload(e) {
    if (this.data.shared || this.data.busy) return;
    const kind = e.currentTarget.dataset.kind,
      max = kind === "photos" ? 30 : 5,
      remaining = max - this.data.record[kind].length;
    if (!remaining)
      return uiLocale.toast(wx,{ title: "已达到图片数量上限", icon: "none" });
    this.setData({ busy: true });
    try {
      const refs = await api.choose(Math.min(9, remaining)),
        r = await api.save({
          ...this.data.record,
          [kind]: this.data.record[kind].concat(refs),
        });
      this.setData({ record: r });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  preview(e) {
    const kind = e.currentTarget.dataset.kind,
      index = Number(e.currentTarget.dataset.index);
    wx.previewImage({
      urls: this.data.record[kind],
      current: this.data.record[kind][index],
    });
  },
  previewPoster(){uiImageActions.openImage(this.data.record?.cover||this.data.record?.posterUrl);},
  async mediaMenu(e) {
    if (this.data.shared || this.data.busy) return;
    const kind = e.currentTarget.dataset.kind,
      index = Number(e.currentTarget.dataset.index),
      r = this.data.record;
    try {
      const actions =
          kind === "photos"
            ? ["设为封面", "移到最前", "删除图片"]
            : ["移到最前", "删除图片"],
        result = await wx.showActionSheet({ itemList: actions }),
        action = actions[result.tapIndex];
      const next = { ...r, [kind]: r[kind].slice() };
      if (action === "设为封面") next.cover = r[kind][index];
      if (action === "移到最前")
        next[kind].unshift(next[kind].splice(index, 1)[0]);
      if (action === "删除图片") {
        const confirmation = await uiLocale.modal(wx,{
          title: "删除图片？",
          content: "将从这场收藏中移除",
        });
        if (!confirmation.confirm) return;
        const removed = next[kind].splice(index, 1)[0];
        if (next.cover === removed) next.cover = "";
      }
      await this.update(next);
    } catch (e) {
      api.error(e);
    }
  },
  panel(e) {
    const r = this.data.record;
    this.setData({
      panel: e.currentTarget.dataset.panel,
      songsText: r.songs.join("\n"),
      expensesText: r.expenses
        .map((v) => v.type + "," + v.amount + "," + v.currency)
        .join("\n"),
      companion: r.companion,
    });
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  close() {
    this.setData({ panel: "" });
  },
  async savePanel() {
    const r = this.data.record,
      panel = this.data.panel;
    let next = { ...r };
    if (panel === "songs")
      next.songs = this.data.songsText
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    else {
      const lines = this.data.expensesText.trim();
      next.expenses = lines
        ? lines.split("\n").map((line) => {
            const [type, amount, currency] = line
              .split(/[,，]/)
              .map((v) => v.trim());
            return { type, amount, currency: (currency || "").toUpperCase() };
          })
        : [];
      next.companion = this.data.companion;
    }
    await this.update(next);
    if (!this.data.message) this.close();
  },
  copySource() {
    wx.setClipboardData({ data: this.data.record.source });
  },
  async remove() {
    if (this.data.shared || this.data.busy) return;
    const result = await uiLocale.modal(wx,{
      title: "删除收藏？",
      content: this.data.record.name,
    });
    if (!result.confirm) return;
    this.setData({ busy: true });
    try {
      await api.remove(this.id, this.data.record.version);
      wx.navigateBack({ delta: 1 });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
},"现场详情"));
