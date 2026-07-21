const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  ONBOARDING_EXAMPLE_QUERY,
  ONBOARDING_STEPS
} = require("../../services/onboarding-service.js");

Page({
  data: {
    mode: "guide",
    exampleQuery: ONBOARDING_EXAMPLE_QUERY,
    onboardingSteps: ONBOARDING_STEPS,
    guideSections: [
      {
        index: "01",
        title: "首次收藏流程",
        badge: "START",
        description: "以刘德华为例，从搜索到添加收藏走完整一次。",
        steps: ["在添加页搜索“刘德华”，进入全部在线结果。", "选择想加入的专辑，点下一步确认收藏信息。", "填写介质、数量、品相和价格后保存到自己的账号。"]
      },
      {
        index: "02",
        title: "今日推荐",
        badge: "DAILY",
        description: "首页会根据你收藏过的艺人每天推荐一张网易云可用专辑。",
        steps: ["没有正在试听时，照片墙下方会显示“今日推荐”。", "点 `GO!` 会进入专辑详情页，可查看曲目和试听。", "只看推荐不会加入收藏，只有在详情页主动加入才会保存。"]
      },
      {
        index: "03",
        title: "试听播放",
        badge: "PLAY",
        description: "详情页可试听曲目，首页会保留当前正在试听的卡片。",
        steps: ["进入专辑详情页，在曲目右侧点播放按钮试听。", "返回首页后，今日推荐位置会切换为“正在试听”。", "可在首页暂停或继续播放，也可点卡片回到对应详情页。"]
      },
      {
        index: "04",
        title: "查看唱片",
        badge: "DETAIL",
        description: "唱片卡片和详情页都可以查看收藏与专辑资料。",
        steps: ["首页点击封面打开唱片卡片。", "卡片里可快速看曲目、稀有度、收藏日期和介质。", "点击“详情”可看发行年份、地区、风格和完整曲目。"]
      },
      {
        index: "05",
        title: "编辑收藏",
        badge: "EDIT",
        description: "每张已收藏唱片都可以继续补充私人收藏信息。",
        steps: ["从首页打开唱片卡片，点击“编辑”。", "可修改收藏日期、购买来源、介质、价格、数量、品相和备注。", "保存后会同步到自己的账号收藏。"]
      },
      {
        index: "06",
        title: "照片墙",
        badge: "WALL",
        description: "照片墙只展示你已经收藏过的唱片。",
        steps: ["打开已收藏唱片卡片，点击“上墙”。", "照片墙满 9 张后，需要先把其他唱片下墙。", "下墙不会删除收藏，只是不再显示在照片墙。"]
      },
      {
        index: "07",
        title: "删除唱片",
        badge: "DELETE",
        description: "删除就是取消这张专辑在你账号里的收藏。",
        steps: ["打开唱片卡片，点左上角删除图标。", "确认后会从全部唱片、照片墙和统计里移除。", "编辑收藏页底部也有删除按钮，适合整理时使用。"]
      },
      {
        index: "08",
        title: "统计与排行",
        badge: "STATS",
        description: "统计页会按你的真实收藏数量和金额汇总。",
        steps: ["可查看唱片、艺人、曲目和投入总额。", "金额按单价 × 数量统计，排行里的总金额也使用同一口径。", "月份分布、收藏排行和介质占比都可用来回看收藏结构。"]
      },
      {
        index: "09",
        title: "主题设置",
        badge: "THEME",
        description: "我的页面可以进入主题设置，切换小程序整体底色。",
        steps: ["支持标准模式、白色模式、暗夜模式和自定义底色。", "顶部导航栏、页面背景、底部导航会跟随主题同步。", "暗夜模式下卡片和文字会使用适合深色背景的配色。"]
      },
      {
        index: "10",
        title: "账号与同步",
        badge: "ACCOUNT",
        description: "登录后收藏会按微信账号独立保存。",
        steps: ["首次使用添加、编辑或删除时会调起微信授权登录。", "我的页面可同步微信头像昵称。", "登录后重新打开小程序，会先恢复本地缓存再后台刷新云端收藏。"]
      },
      {
        index: "11",
        title: "导入导出",
        badge: "TOOLS",
        description: "我的页面提供收藏批量处理工具。",
        steps: ["导入收藏可从表格或文本批量加入。", "导出收藏会生成 Markdown 文件，适合分享给微信好友。", "全部唱片页支持搜索、筛选和批量删除自己的收藏。"]
      },
      {
        index: "12",
        title: "更多收藏",
        badge: "MORE",
        description: "手册底部“更多”可进入隐藏唱片库。",
        steps: ["输入密码 `0816` 后可查看隐藏唱片库。", "可选择部分唱片收藏，也可以一键收藏全部。", "隐藏库的价格统计同样按单价 × 数量计算。"]
      },
      {
        index: "13",
        title: "微信分享",
        badge: "SHARE",
        description: "使用微信右上角官方分享按钮即可分享小程序链接。",
        steps: ["全部唱片页可分享纯展示收藏清单。", "专辑详情页可分享单张唱片。", "统计页保留数据浏览。"]
      }
    ]
  },
  onLoad(options = {}) {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.setData({
      mode: options.mode === "onboarding" ? "onboarding" : "guide",
      exampleQuery: decodeURIComponent(options.query || ONBOARDING_EXAMPLE_QUERY)
    });
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  startExampleSearch() {
    wx.navigateTo({
      url: `/pages/search-results/index?query=${encodeURIComponent(this.data.exampleQuery)}`
    });
  },
  openAddPage() {
    wx.navigateTo({ url: "/pages/add/index" });
  },
  openEasterLibrary() {
    wx.navigateTo({ url: "/pages/easter-library/index" });
  },
  onShareAppMessage() {
    return createShareMessage({
      title: "唱片柜小程序操作手册",
      path: "/pages/user-guide/index"
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
