const uiLocale=require("../../ui/locale-runtime");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");
const {
  ONBOARDING_EXAMPLE_QUERY,
  ONBOARDING_STEPS
} = require("../../services/onboarding-service.js");

Page(uiLocale.page({uiPageBack(){wx.navigateBack({fail:()=>wx.reLaunch({url:"/pages/cabinet/index"})});},
  data: {
    mode: "guide",
    exampleQuery: ONBOARDING_EXAMPLE_QUERY,
    onboardingSteps: ONBOARDING_STEPS,
    guideSections: [
    {
        "index": "01",
        "title": "浏览收藏",
        "badge": "",
        "description": "",
        "steps": [
            "底部切换唱片柜或演出集，左右滑动浏览。",
            "点封面查看卡片；点头像进入“我的”。"
        ],
        "ja": {
            "title": "所蔵を見る",
            "description": "",
            "steps": [
                "下部でレコード・公演を切り替え、左右にスワイプ。",
                "表紙でカード、アイコンでマイページを開きます。"
            ]
        }
    },
    {
        "index": "02",
        "title": "添加唱片",
        "badge": "",
        "description": "",
        "steps": [
            "点“添加”→搜索艺人或专辑→确认收藏信息→保存。",
            "批量输入：每行“艺人 — 专辑”；找不到可手动新建。"
        ],
        "flow": [
            {
                "screen": "search",
                "title": "搜索唱片",
                "caption": "输入艺人或专辑名",
                "action": "搜索"
            },
            {
                "screen": "edit",
                "title": "确认收藏信息",
                "caption": "填写自己的收藏资料",
                "action": "保存收藏",
                "fields": [
                    "收藏形式",
                    "数量",
                    "收藏日期"
                ]
            },
            {
                "screen": "saved",
                "title": "保存完成",
                "caption": "返回首页浏览收藏",
                "action": "返回首页"
            },
            {
                "screen": "card",
                "title": "查看唱片",
                "caption": "点击封面管理收藏",
                "action": "查看详情"
            }
        ],
        "ja": {
            "title": "レコードを追加",
            "description": "",
            "steps": [
                "追加 → アーティスト・作品を検索 → 所蔵情報を確認 → 保存。",
                "一括入力は一行ずつ「アーティスト — 作品名」。見つからなければ手動作成。"
            ]
        }
    },
    {
        "index": "03",
        "title": "记录演出",
        "badge": "",
        "description": "",
        "steps": [
            "切换“演出集”→添加→粘贴链接或手动新建。",
            "核对观看日期、城市、场馆和票价→保存，默认已看过。"
        ],
        "flow": [
            {
                "screen": "link",
                "title": "添加演出",
                "caption": "粘贴链接或手动新建",
                "action": "识别演出"
            },
            {
                "screen": "edit",
                "title": "确认演出信息",
                "caption": "核对观看日期和场馆",
                "action": "保存演出",
                "fields": [
                    "观看日期",
                    "城市",
                    "演出场馆"
                ]
            },
            {
                "screen": "saved",
                "title": "保存完成",
                "caption": "添加后默认已看过",
                "action": "返回首页"
            },
            {
                "screen": "poster",
                "title": "演出集",
                "caption": "滑动海报回看现场",
                "action": "查看详情"
            }
        ],
        "ja": {
            "title": "公演を記録",
            "description": "",
            "steps": [
                "公演 → 追加 → リンクを貼り付け、または手動作成。",
                "鑑賞日・都市・会場・料金を確認 → 保存。鑑賞済みとして記録。"
            ]
        }
    },
    {
        "index": "04",
        "title": "编辑与删除",
        "badge": "",
        "description": "",
        "steps": [
            "点封面→“编辑唱片”或“编辑演出”→修改→保存。",
            "发行日期填年月日；删除时核对名称后确认。"
        ],
        "ja": {
            "title": "編集・削除",
            "description": "",
            "steps": [
                "表紙 → 編集 → 内容を修正 → 保存。",
                "発売日は年月日で入力。削除前に対象名を確認。"
            ]
        }
    },
    {
        "index": "05",
        "title": "分享票根",
        "badge": "",
        "description": "",
        "steps": [
            "点卡片“分享唱片”或“分享演出”→预览→保存海报。",
            "首次保存允许相册权限；失败可点“重新生成”。"
        ],
        "flow": [
            {
                "screen": "card",
                "title": "收藏卡片",
                "caption": "打开已收藏的记录",
                "action": "分享唱片"
            },
            {
                "screen": "poster",
                "title": "生成票根",
                "caption": "等待图片生成",
                "action": "正在生成"
            },
            {
                "screen": "poster",
                "title": "预览海报",
                "caption": "核对图片与收藏信息",
                "action": "保存海报"
            },
            {
                "screen": "saved",
                "title": "保存完成",
                "caption": "在相册查看和分享",
                "action": "完成"
            }
        ],
        "ja": {
            "title": "チケットを共有",
            "description": "",
            "steps": [
                "カードの共有 → プレビュー → 画像保存。",
                "初回は写真へのアクセスを許可。失敗時は再作成。"
            ]
        }
    },
    {
        "index": "06",
        "title": "统计与清单",
        "badge": "",
        "description": "",
        "steps": [
            "点“统计”看时间线、排行或城市；“调整模块”更改顺序。",
            "唱片花费＝单价 × 数量；全部收藏可搜索、筛选和微信分享。"
        ],
        "ja": {
            "title": "統計・一覧",
            "description": "",
            "steps": [
                "統計で履歴・順位・都市を確認。表示設定で並べ替え。",
                "レコード支出＝単価 × 枚数。所蔵一覧で検索・絞り込み・WeChat共有。"
            ]
        }
    },
    {
        "index": "07",
        "title": "导入导出",
        "badge": "",
        "description": "",
        "steps": [
            "“我的”→导入收藏→选择表格或文本→检查结果→确认。",
            "“导出收藏”生成 Markdown 备份，可保存或发送。"
        ],
        "ja": {
            "title": "読み込み・書き出し",
            "description": "",
            "steps": [
                "マイページ → 読み込み → 表・テキストを選択 → 結果を確認。",
                "書き出しでMarkdownのバックアップを保存・送信。"
            ]
        }
    },
    {
        "index": "08",
        "title": "账号与设置",
        "badge": "",
        "description": "",
        "steps": [
            "首次添加按提示微信登录；在“我的”修改头像和昵称。",
            "语言设置可选简体、繁體、English、日本語；电视扫码绑定同步。"
        ],
        "ja": {
            "title": "アカウント・設定",
            "description": "",
            "steps": [
                "初回追加時にWeChatでログイン。マイページでアイコン・名前を編集。",
                "言語設定で简体・繁體・English・日本語を選択。スキャンでテレビと連携。"
            ]
        }
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
      title: "大收藏家 - 唱片演出记录 · 操作手册",
      path: "/pages/user-guide/index"
    });
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
}));
