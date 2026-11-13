const uiImageActions=require('../../../../ui/image-actions');
const uiTicketData=require('../../../../ui/ticket-data');
const uiLocale=require("../../../../ui/locale-runtime");
const uiCache=require('../../../../ui/live-view-cache');
const uiSpace=require('../../../../ui/space-navigation');
const uiStats=require("../../../../ui/stats-model");
const account = require("../../services/account");
const routes = require("../../services/routes");
const state = require("../../services/state");
const api = require("../../services/archive");
const { statistics } = require("../../shared/domain");
Page(uiLocale.page({uiImageActions(){const d=this.data;uiImageActions.openImage(d.uiPreviewRecord?.cover||d.uiPreviewRecord?.posterUrl);},

  uiShowDetail(options){this.setData({uiDetailOptions:options,uiDetailOpen:true});},
  uiDismissDetail(){this.setData({uiDetailOpen:false});},
  uiDetailLeft(){this.setData({uiDetailOpen:false,uiDetailOptions:null});this.filter();this.calc();},

  data: {uiHomeMounted:false,uiDetailOpen:false,uiDetailOptions:null,
    uiStatsShareSource:null,uiStatsRecords:[],uiShareToken:"",
    tab: "home",
    tabs: [
      { id: "home", label: "首页", icon: "▦" },
      { id: "add", label: "添加", icon: "＋" },
      { id: "stats", label: "统计", icon: "▤" },
      { id: "mine", label: "我的", icon: "○" },
    ],
    records: [],
    filtered: [],
    count: 0,
    query: "",
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
    timeline: [],
    stats: {
      shows: 0,
      artists: 0,
      cities: 0,
      venues: 0,
      artistRank: [],
      cityRank: [],
    },
    source: "",
    addEntry: "link",
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
    const tab=this.token?"collection":(["collection","stats","add"].includes(options.tab)?options.tab:"home");
    this.setData({tab});
    this.setData({ shared: !!this.token, account: account.profile() });
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    if (this.token) account.enableShare();
    if(!this.token&&account.profile().loggedIn){const owner=getApp().globalData.userId;const cached=uiCache.read(wx,owner);if(cached&&!state.records.length){state.records=cached;this.update(cached);}}
    this.refresh();
  },
  uiPrimary(tab){if(!['home','add','stats'].includes(tab))return;this.setData({tab,...(tab==='home'?{uiHomeMounted:true}:{})});this.filter();if(tab==='stats')this.calc();if(tab==='add')this.prepareAllShare();wx.pageScrollTo({scrollTop:0,duration:0});},
  openAccount() { account.open(); },
  onShow() {
    if(this.data.tab==='home'&&!this.data.uiHomeMounted)this.setData({uiHomeMounted:true});
    this.setData({ account: account.profile() });
    wx.setNavigationBarColor({ frontColor: "#000000", backgroundColor: "#f5f6f2" });
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
    await this.refresh(true);
    wx.stopPullDownRefresh();
  },
  refresh(force=false) {
    const app=getApp();
    if(force!==true&&!this.token&&account.profile().loggedIn&&state.ownerKey&&uiSpace.recent("live",app)){this.update(state.records);this.setData({account:account.profile(),busy:false});if(this.data.tab==="collection")this.prepareAllShare();return Promise.resolve();}
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
        if(!this.token)uiSpace.mark("live",app);
        this.setData({ account: account.profile() });
        if(!this.token){uiCache.save(wx,app.globalData.userId,rows);if(!this.data.shareReady)this.prepareShare().catch(()=>{});}
        if(!this.token&&["add","collection"].includes(this.data.tab))this.prepareAllShare().catch(()=>{});
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
    records = (records || []).filter(Boolean).map(record => record.status === "已看过" ? record : {...record, status:"已看过"});
    const signature=JSON.stringify(records);
    if(signature===this.uiRecordsSignature)return;
    this.uiRecordsSignature=signature;
    const years = [
      ...new Set(records.map((r) => String(r.date||'').slice(0, 4)).filter(Boolean)),
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
  uiSelect(e) { this.open({currentTarget:{dataset:{id:e.detail.id}}}); },
  uiCollectionShare(e){if(this.data.shared)return;if(!account.profile().loggedIn){if(!e.detail.passive)account.open();return;}return this.prepareAllShare();},
  uiShare(e) { this.uiStatsShare=e.detail.message; },
  calc() {
    this.uiStatsShare=null;
    const year = this.data.year === "全部年份" ? "" : this.data.year;
    this.setData({
      uiStatsShareSource:this.token?{token:this.token}:account.profile().loggedIn&&state.ownerKey&&this.allShareOwner===state.ownerKey&&this.allShareToken?{token:this.allShareToken}:null,uiStatsRecords: uiStats.liveRecords(this.data.records),
      stats: statistics(this.data.records, year),
      timeline: this.data.records.filter(r => !year || r.date.startsWith(year)).slice().sort((a,b) => b.date.localeCompare(a.date)),
    });
  },
  tab(e) {
    const tab = e.currentTarget.dataset.id;
    if(tab==="home"&&this.options?.tab){wx.navigateBack();return;}
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
  uiTicketShare(){if(this.data.shared)return;const ticket=uiTicketData.live(this.data.uiPreviewRecord,this.data.records,this.data.account?.name,this.data.account?.avatar);if(ticket)this.setData({uiTicket:ticket});},
  uiTicketClose(){this.setData({uiTicket:null});},
  noop(){},
  openDeck(e) { this.uiPreview(e); },
  uiPreview(e){const id=e.detail.id;const source=this.data.records;const ids=e.detail.ids||this.data.uiPreviewIds;const byId=new Map(source.map(r=>[r.id,r]));const records=ids?ids.map(id=>byId.get(id)).filter(Boolean):source;this.setData({uiPreviewIds:records.map(r=>r.id)});const index=records.findIndex(r=>r.id===id);if(index<0)return;this.setData({uiPreviewRecord:records[index],uiPreviewIndex:index,uiPreviewPrice:uiStats.costs([ {expenses:records[index].expenses||[]} ]).map(r=>r.symbol+r.exact).join(' · ')});},
  uiPreviewClose(){this.setData({uiPreviewRecord:null});},
  uiPreviewMove(e){const byId=new Map(this.data.records.map(r=>[r.id,r]));const rows=(this.data.uiPreviewIds||[]).map(id=>byId.get(id)).filter(Boolean),n=rows.length;if(!n)return;const i=(this.data.uiPreviewIndex+Number(e.currentTarget.dataset.step)+n)%n;this.uiPreview({detail:{id:rows[i].id}});},
  uiPreviewDetail(){const id=this.data.uiPreviewRecord.id;this.uiPreviewClose();this.open({currentTarget:{dataset:{id}}});},
  uiPreviewEdit(){const id=this.data.uiPreviewRecord.id;this.uiPreviewClose();wx.navigateTo({url:routes.edit+'?id='+encodeURIComponent(id)});},
  async uiPreviewDelete(){const record=this.data.uiPreviewRecord;if(this.data.shared||this.data.busy||!record)return;const result=await uiLocale.modal(wx,{title:'删除收藏？',content:record.name});if(!result.confirm)return;this.setData({busy:true});try{await api.remove(record.id,record.version);this.uiPreviewClose();this.update(state.records);uiCache.save(wx,getApp().globalData.userId,state.records);}catch(e){api.error(e);}finally{this.setData({busy:false});}},

  open(e) {
    const record = this.data.records.find(
      (r) => r.id === e.currentTarget.dataset.id,
    );
    state.detail = record;
    if(record)this.uiShowDetail({id:record.id,shared:this.token?'1':'0'});
  },
  manual() {
    state.draft = {
      source: this.data.addEntry === "link" ? this.data.source : "",
      _importSource: this.data.addEntry === "link" ? this.data.source : "",
      tickets: [],
      status: "已看过",
    };
    wx.navigateTo({ url: routes.edit });
  },
  entry(e) {
    if (this.data.busy) return;
    if (!["search", "link", "manual"].includes(e.currentTarget.dataset.value)) return;
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
        status: "已看过",
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
        status: "已看过",
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
          uiLocale.toast(wx,{
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
      status: "已看过",
      city: s.city || this.data.importDraft.city,
      venue: s.venue || this.data.importDraft.venue,
      sourceId: this.data.importDraft.sourceId || s.id || "",
    };
    this.setData({ sessions: [] });
    wx.navigateTo({ url: routes.edit });
  },
  allCollection() {
    this.setData({ tab: "collection", query: "", filterCity: "全部城市", filterType: "全部类型", filterYear: "全部年份" });
    this.update(state.records);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  async prepareAllShare() {
    if (!account.profile().loggedIn) return;
    const owner = state.ownerKey;
    if (this.token || !owner || this.data.preparingAllShare) return;
    if (this.allShareOwner === owner && this.allShareToken){this.setData({uiStatsShareSource:{token:this.allShareToken}});return;}
    this.allShareToken = "";
    this.uiStatsShare=null;
    this.setData({ allShareReady: false, preparingAllShare: true,uiStatsShareSource:null });
    try {
      const { token } = await api.call("share", { scope: "all" });
      if (state.ownerKey !== owner) return;
      this.allShareToken = token;
      this.allShareOwner = owner;
      this.setData({ allShareReady: true,uiStatsShareSource:{token} });
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
      const { token } = await api.call("share", { scope: "all" });
      state.shareToken = token;
      this.setData({ shareReady: true, uiShareToken:token });
      account.enableShare();
    } catch (e) {
      this.setData({ shareReady: false });
      api.error(e);
    } finally {
      this.preparingShare = false;
    }
  },
  onShareAppMessage(event) {
    if(this.data.uiDetailOpen){const detail=this.selectComponent("#uiDetail");if(detail?.onShareAppMessage)return detail.onShareAppMessage();}
    if(event?.target?.dataset?.scope==='all'&&!this.token)return account.message(this.allShareOwner===state.ownerKey?this.allShareToken:'',false);
    if(this.data.tab==="stats"&&this.uiStatsShare)return this.uiStatsShare;
    const token = this.token || ((this.data.tab==="collection"||event?.target?.dataset?.scope === "all")
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
        uiLocale.loading(wx,{ title: "备份第 " + part + " 包" });
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
          await uiLocale.modal(wx,{
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
      return uiLocale.toast(wx,{ title: "这一年还没有现场", icon: "none" });
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
  exitShare() {
    wx.reLaunch({ url: routes.home });
  },
},"演出集"));
