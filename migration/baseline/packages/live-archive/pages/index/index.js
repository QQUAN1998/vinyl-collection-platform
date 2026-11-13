const account = require("../../services/account");
const routes = require("../../services/routes");
const state = require("../../services/state");
const api = require("../../services/archive");
const { statistics } = require("../../shared/domain");
const artistExpenses = require("../../shared/artist-expenses");
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
Page({
  data: {
    tab: "home",
    tabs: [
      { id: "home", label: "首页", icon: "▦" },
      { id: "add", label: "添加", icon: "＋" },
      { id: "stats", label: "统计", icon: "▤" },
      { id: "mine", label: "我的", icon: "○" },
    ],
    records: [],
    filtered: [],
    recent: [],
    count: 0,
    query: "",
    status: "全部",
    statuses: ["全部", "已看过", "已购票", "想看"],
    view: "grid",
    sort: "日期倒序",
    filterCity: "全部城市",
    filterType: "全部类型",
    filterYear: "全部年份",
    yearOptions: [],
    archiveYears: 0,
    cities: [],
    types: [],
    sorts: ["日期倒序", "日期正序", "添加顺序", "名称"],
    years: [],
    year: "全部年份",
    months: [],
    timeline: [],
    artistCards: [],
    artistRankMode: "count",
    artistExpenseCurrency: "CNY",
    artistExpenseCurrencies: [],
    artistExpenseCards: [],
    rankedArtists: [],
    cityCards: [],
    expensePercent: 0,
    stats: {
      shows: 0,
      artists: 0,
      cities: 0,
      venues: 0,
      artistRank: [],
      cityRank: [],
    },
    expenses: [],
    source: "",
    addEntry: "search",
    artistQuery: "",
    artists: [],
    artistEvents: [],
    selectedArtist: null,
    searched: false,
    busy: false,
    message: "",
    shared: false,
    account: {},
    shareReady: false,
    allShareReady: false,
    preparingAllShare: false,
  },
  onLoad(options) {
    this.token = options.share || "";
    this.setData({ shared: !!this.token, account: account.profile() });
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    if (this.token) account.enableShare();
    this.refresh();
  },
  openAccount() { account.open(); },
  onShow() {
    this.setData({ account: account.profile() });
    wx.setNavigationBarColor({ frontColor: "#000000", backgroundColor: "#fbfaf6" });
    if (!this.token) {
      const app = state;
      if (app.completedImportSource) {
        if (app.completedImportSource === this.data.source)
          this.setData({ source: "", sessions: [], importDraft: null });
        app.completedImportSource = "";
      }
      const { records, ownerKey } = state;
      this.update(records);
      if (ownerKey || records.length) this.setData({ message: "" });
      if (!this.data.busy) this.refresh();
    } else if (this.loaded && !this.data.busy) {
      this.refresh();
    }
  },
  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },
  refresh() {
    if (!this.token && !account.profile().loggedIn) {
      this.update([]);
      this.loaded = false;
      this.setData({ account: account.profile(), busy: false, message: "", shareReady: false, allShareReady: false });
      return Promise.resolve();
    }
    if (this.refreshTask) return this.refreshTask;
    this.setData({ busy: true, message: "" });
    this.refreshTask = (async () => {
      try {
        const rows = this.token
          ? (await api.call("readShare", { token: this.token })).records
          : await api.load();
        this.setData({ shared: !!this.token });
        this.update(rows);
        this.loaded = true;
        this.setData({ account: account.profile() });
        if (!this.token && !this.data.shareReady) await this.prepareShare();
        if (!this.token && this.data.tab === "add") await this.prepareAllShare();
      } catch (e) {
        this.setData({ message: e.message || "加载失败" });
      } finally {
        this.setData({ busy: false });
        this.refreshTask = null;
      }
    })();
    return this.refreshTask;
  },
  update(records) {
    const years = [
      ...new Set(records.map((r) => r.date.slice(0, 4)).filter(Boolean)),
    ]
      .sort()
      .reverse();
    const archiveYears = years.length;
    const yearOptions = ["全部年份", ...years];
    if (!years.includes(this.data.year)) years.unshift(this.data.year);
    this.setData({
      records,
      archiveYears,
      yearOptions,
      count: records.length,
      recent: records
        .filter((r) => r.status === "已看过")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
      cities: [
        "全部城市",
        ...new Set(records.map((r) => r.city).filter(Boolean)),
      ],
      types: [
        "全部类型",
        ...new Set(records.map((r) => r.type).filter(Boolean)),
      ],
      years: ["全部年份", ...years.filter((year) => year !== "全部年份")],
    });
    this.filter();
    this.calc();
  },
  filter() {
    const d = this.data;
    let rows = d.records.filter(
      (r) =>
        (d.status === "全部" || r.status === d.status) &&
        (d.filterCity === "全部城市" || r.city === d.filterCity) &&
        (d.filterType === "全部类型" || r.type === d.filterType) &&
        (d.filterYear === "全部年份" || r.date.startsWith(d.filterYear)) &&
        [r.name, r.artist, r.city, r.venue]
          .join(" ")
          .toLowerCase()
          .includes(d.query.toLowerCase()),
    );
    rows.sort((a, b) =>
      d.sort === "日期正序"
        ? a.date.localeCompare(b.date)
        : d.sort === "名称"
          ? a.name.localeCompare(b.name)
          : d.sort === "添加顺序"
            ? (b.created || "").localeCompare(a.created || "")
            : b.date.localeCompare(a.date),
    );
    this.setData({ filtered: rows });
  },
  calc() {
    const year = this.data.year === "全部年份" ? "" : this.data.year,
      stats = statistics(this.data.records, year),
      expenses = Object.entries(stats.expenses).map(([currency, minor]) => ({
        currency,
        amount: (minor / (["JPY", "KRW"].includes(currency) ? 1 : 100)).toFixed(
          ["JPY", "KRW"].includes(currency) ? 0 : 2,
        ),
      }));
    const timeline = this.data.records
      .filter(
        (r) => r.status === "已看过" && (!year || r.date.startsWith(year)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    this.artistExpenseRanks = artistExpenses(this.data.records, year);
    const currencies = Object.keys(this.artistExpenseRanks).sort((a, b) =>
      a === "CNY" ? -1 : b === "CNY" ? 1 : a.localeCompare(b));
    const currency = currencies.includes(this.data.artistExpenseCurrency)
      ? this.data.artistExpenseCurrency : currencies[0] || "CNY";
    this.setData({
      artistExpenseCurrencies: currencies,
      artistExpenseCurrency: currency,
      stats,
      expenses,
      timeline,
      artistCards: stats.artistRank.map((item, index) => ({
        ...item,
        rank: index + 1,
        initial: Array.from(item.name)[0] || "音",
      })),
      cityCards: stats.cityRank.map((item) => {
        const venues = [...new Set(timeline
          .filter((record) => record.city === item.name)
          .map((record) => record.venue).filter(Boolean))];
        return { ...item, venueCount: venues.length, venueNames: venues.join("\n") };
      }),
      expensePercent: stats.shows
        ? Math.round(stats.expenseCoverage / stats.shows * 100) : 0,
      venueList: [...new Set(timeline.map((r) => r.venue).filter(Boolean))],
      months: stats.months.map((count, i) => ({
        month: i + 1, count,
        tone: !count ? "empty" : count === Math.max(...stats.months) ? "high" : "low",
      })),
    });
    this.updateArtistRanking();
  },
  updateArtistRanking() {
    if (this.data.shared && this.data.artistRankMode !== "count")
      this.setData({ artistRankMode: "count" });
    const currency = this.data.artistExpenseCurrency;
    const digits = ["JPY", "KRW"].includes(currency) ? 0 : 2;
    const cards = (this.artistExpenseRanks?.[currency] || []).map((item, index) => ({
      ...item, rank: index + 1, initial: Array.from(item.name)[0] || "音",
      amount: (item.minor / 10 ** digits).toFixed(digits),
    }));
    this.setData({
      artistExpenseCards: cards,
      rankedArtists: this.data.artistRankMode === "expense" ? cards : this.data.artistCards,
    });
  },
  artistRanking(e) {
    const { mode, currency } = e.currentTarget.dataset;
    if (mode && ["count", "expense"].includes(mode) && !(this.data.shared && mode === "expense"))
      this.setData({ artistRankMode: mode });
    if (currency && this.data.artistExpenseCurrencies.includes(currency))
      this.setData({ artistExpenseCurrency: currency });
    this.updateArtistRanking();
  },
  artistCurrency(e) {
    const currency = this.data.artistExpenseCurrencies[Number(e.detail.value)];
    if (currency) this.artistRanking({ currentTarget: { dataset: { currency } } });
  },
  tab(e) {
    const tab = e.currentTarget.dataset.id;
    this.setData({ tab });
    if (tab === "add" && !this.data.shared) {
      this.update(state.records);
      this.prepareAllShare();
    }
    if (["home", "stats", "mine"].includes(tab) && !this.data.shared) {
      this.update(state.records);
      if (!this.data.busy) this.refresh();
    }
  },
  search(e) {
    this.setData({ query: e.detail.value });
    this.filter();
  },
  status(e) {
    this.setData({ status: e.currentTarget.dataset.value });
    this.filter();
  },
  view() {
    this.setData({ view: this.data.view === "grid" ? "list" : "grid" });
  },
  picker(e) {
    const key = e.currentTarget.dataset.key,
      values = this.data[e.currentTarget.dataset.options];
    this.setData({ [key]: values[Number(e.detail.value)] });
    this.filter();
  },
  year(e) {
    this.setData({ year: this.data.years[e.detail.value] });
    this.calc();
  },
  source(e) {
    this.setData({ source: e.detail.value });
  },
  open(e) {
    const record = this.data.records.find(
      (r) => r.id === e.currentTarget.dataset.id,
    );
    state.detail = record;
    wx.navigateTo({
      url:
        routes.detail + "?id=" +
        record.id +
        (this.token ? "&shared=1" : ""),
    });
  },
  manual() {
    state.draft = {
      source: this.data.addEntry === "link" ? this.data.source : "",
      _importSource: this.data.addEntry === "link" ? this.data.source : "",
      tickets: [],
    };
    wx.navigateTo({ url: routes.edit });
  },
  entry(e) {
    if (this.data.busy) return;
    if (!["search", "link"].includes(e.currentTarget.dataset.value)) return;
    this.setData({
      addEntry: e.currentTarget.dataset.value,
      message: "",
      sessions: [],
    });
  },
  artistQuery(e) {
    this.setData({
      artistQuery: e.detail.value,
      artists: [],
      artistEvents: [],
      selectedArtist: null,
      searched: false,
    });
  },
  async searchArtists() {
    if (this.data.busy) return;
    this.setData({
      busy: true,
      message: "",
      artists: [],
      artistEvents: [],
      selectedArtist: null,
      searched: false,
    });
    try {
      const result = await api.call("searchArtists", {
        query: this.data.artistQuery,
      });
      this.setData({ artists: result.artists, searched: true });
    } catch (e) {
      this.setData({ message: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async selectArtist(e) {
    if (this.data.busy) return;
    const artist = this.data.artists.find(
      (a) => a.id === e.currentTarget.dataset.id,
    );
    if (!artist) return;
    this.setData({
      busy: true,
      message: "",
      selectedArtist: artist,
      artistEvents: [],
    });
    try {
      const result = await api.call("artistEvents", { artistId: artist.id });
      this.setData({ artistEvents: result.events });
      if (!result.events.length)
        this.setData({ message: "暂无可导入场次，可手动添加" });
    } catch (e) {
      this.setData({ message: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async selectEvent(e) {
    if (this.data.busy || !this.data.selectedArtist) return;
    this.setData({ busy: true, message: "" });
    try {
      const result = await api.call("showstartImport", {
        artistId: this.data.selectedArtist.id,
        eventId: e.currentTarget.dataset.id,
      });
      const fields = result.fields || {};
      if (!fields.name)
        throw new Error(result.message || "详情暂不可用，请手动添加");
      state.draft = {
        ...fields,
        status: fields.date && fields.date < today() ? "已看过" : "想看",
      };
      wx.navigateTo({ url: routes.edit });
    } catch (e) {
      this.setData({ message: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async importLink() {
    if (this.data.busy) return;
    this.setData({ busy: true, message: "" });
    try {
      const result = await api.call("import", { source: this.data.source });
      const draft = {
        ...result.fields,
        _importSource: this.data.source,
        source: result.fields?.source || result.url || this.data.source,
        sourcePlatform: result.platform || "",
        status:
          result.fields?.date && result.fields.date >= today()
            ? "想看"
            : "已看过",
      };
      const sessions = result.sessions || [];
      if (sessions.length) {
        this.setData({
          sessions,
          importDraft: draft,
          message: "选择场次后继续",
        });
      } else {
        state.draft = draft;
        wx.navigateTo({ url: routes.edit });
        if (!draft.name)
          wx.showToast({
            title:
              result.reason === "PLATFORM_VERIFICATION"
                ? `${result.platform}需要访问验证，请手填`
                : "未获取详情，请手填",
            icon: "none",
          });
      }
    } catch (e) {
      this.setData({ message: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  session(e) {
    const s = this.data.sessions[Number(e.detail.value)];
    state.draft = {
      ...this.data.importDraft,
      date: s.date,
      status: s.date >= today() ? "想看" : "已看过",
      city: s.city || this.data.importDraft.city,
      venue: s.venue || this.data.importDraft.venue,
      sourceId: this.data.importDraft.sourceId || s.id || "",
    };
    this.setData({ sessions: [] });
    wx.navigateTo({ url: routes.edit });
  },
  allCollection() {
    this.setData({ tab: "home", query: "", status: "全部", filterCity: "全部城市", filterType: "全部类型", filterYear: "全部年份" });
    this.update(state.records);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  async prepareAllShare() {
    if (!account.profile().loggedIn) return;
    const owner = state.ownerKey;
    if (this.token || !owner || this.data.preparingAllShare) return;
    if (this.allShareOwner === owner && this.allShareToken) return;
    this.allShareToken = "";
    this.setData({ allShareReady: false, preparingAllShare: true });
    try {
      const { token } = await api.call("share", { scope: "all" });
      if (state.ownerKey !== owner) return;
      this.allShareToken = token;
      this.allShareOwner = owner;
      this.setData({ allShareReady: true });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ preparingAllShare: false });
    }
  },
  async prepareShare() {
    if (this.preparingShare || this.token) return;
    this.preparingShare = true;
    try {
      const { token } = await api.call("share");
      state.shareToken = token;
      this.setData({ shareReady: true });
      account.enableShare();
    } catch (e) {
      this.setData({ shareReady: false });
      api.error(e);
    } finally {
      this.preparingShare = false;
    }
  },
  onShareAppMessage(event) {
    const token = this.token || (event?.target?.dataset?.scope === "all"
      ? (this.allShareOwner === state.ownerKey ? this.allShareToken : "")
      : state.shareToken);
    return account.message(token, !!this.token);
  },
  onShareTimeline() { return account.timeline(this.onShareAppMessage()); },
  async exportData() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    let cursor = 0,
      snapshot,
      part = 1;
    try {
      do {
        wx.showLoading({ title: "备份第 " + part + " 包" });
        const result = await api.call("export", { cursor, snapshot });
        snapshot = result.snapshot;
        const file = await new Promise((resolve, reject) => {
          wx.downloadFile({ url: result.url, success: resolve, fail: reject });
        });
        if (file.statusCode !== 200) throw new Error("备份下载失败");
        wx.hideLoading();
        if (wx.shareFileMessage)
          await wx.shareFileMessage({
            filePath: file.tempFilePath,
            fileName: "演出集备份-" + part + ".zip",
          });
        else {
          await wx.setClipboardData({ data: result.url });
          await wx.showModal({
            title: "备份第 " + part + " 包",
            content: "下载链接已复制，请保存本包后继续",
            showCancel: false,
          });
        }
        cursor = result.nextCursor;
        part++;
      } while (cursor !== null);
    } catch (e) {
      api.error(e);
    } finally {
      wx.hideLoading();
      this.setData({ busy: false });
    }
  },
  async annual() {
    if (this.data.busy) return;
    if (!this.data.timeline.length)
      return wx.showToast({ title: "这一年还没有现场", icon: "none" });
    if (this.data.year === "全部年份") {
      this.setData({ year: this.data.timeline[0].date.slice(0, 4) });
      this.calc();
    }
    this.setData({ busy: true });
    try {
      const result = await new Promise((resolve) =>
        this.createSelectorQuery()
          .select("#annualCanvas")
          .fields({ node: true, size: true })
          .exec(resolve),
      );
      const canvas = result[0].node,
        urls = [],
        pages = Math.ceil(this.data.timeline.length / 12);
      for (let page = 0; page < pages; page++) {
        const ctx = canvas.getContext("2d"),
          rows = this.data.timeline.slice(page * 12, (page + 1) * 12),
          height = 720 + rows.length * 64;
        canvas.width = 900;
        canvas.height = height;
        ctx.fillStyle = "#f7f5f0";
        ctx.fillRect(0, 0, 900, height);
        ctx.fillStyle = "#697553";
        ctx.font = "24px sans-serif";
        ctx.fillText("LIVE ARCHIVE", 60, 80);
        ctx.fillStyle = "#242720";
        ctx.font = "64px sans-serif";
        ctx.fillText(this.data.year + " 现场回顾", 60, 182);
        ctx.font = "36px sans-serif";
        ctx.fillText(
          this.data.stats.shows +
            " 场现场 · " +
            this.data.stats.artists +
            " 位艺人",
          60,
          280,
        );
        ctx.fillText(
          this.data.stats.cities +
            " 座城市 · " +
            this.data.stats.venues +
            " 个场馆",
          60,
          344,
        );
        ctx.font = "28px sans-serif";
        rows.forEach((r, i) =>
          ctx.fillText(r.date + "  " + r.name.slice(0, 22), 60, 470 + i * 64),
        );
        ctx.fillStyle = "#7a7d71";
        ctx.font = "23px sans-serif";
        ctx.fillText(
          "我的演出集 / " + (page + 1) + " · " + pages,
          60,
          height - 75,
        );
        const output = await wx.canvasToTempFilePath({
          canvas,
          fileType: "png",
        });
        urls.push(output.tempFilePath);
      }
      await wx.previewImage({ urls });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  rank(e) {
    const key = e.currentTarget.dataset.kind,
      value = e.currentTarget.dataset.value;
    this.setData({
      tab: "home",
      status: "已看过",
      filterYear: this.data.year,
      query: key === "artist" ? value : "",
      filterCity: key === "city" ? value : "全部城市",
      filterType: "全部类型",
    });
    this.filter();
  },
  exitShare() {
    wx.reLaunch({ url: routes.home });
  },
});
