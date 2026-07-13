const { createShareMessage } = require("../../services/share.js");

Page({
  data: {
    guideSections: [
      {
        index: "01",
        title: "首页",
        badge: "CABINET",
        description: "查看我的唱片柜、照片墙和全部资料库唱片。",
        steps: ["点击照片墙唱片可弹出卡片。", "卡片左上角星星可收藏或取消收藏。", "卡片内可查看详情、编辑收藏、上墙或下墙。"]
      },
      {
        index: "02",
        title: "添加唱片",
        badge: "ADD",
        description: "从资料库搜索、批量输入或手动新建唱片。",
        steps: ["搜索框支持唱片、艺人、风格和年份。", "批量输入适合一次录入多张唱片。", "全部唱片卡片可打开可分享的收藏清单。"]
      },
      {
        index: "03",
        title: "收藏统计",
        badge: "DATA",
        description: "查看收藏分布、排行、形式占比和分享海报。",
        steps: ["点击月份可查看当月收藏了哪些唱片。", "收藏排行可按数量或总金额查看。", "标题旁分享图标可生成并保存统计海报。"]
      },
      {
        index: "04",
        title: "我的设置",
        badge: "SETTINGS",
        description: "管理微信昵称、电视绑定、导入导出和平台服务。",
        steps: ["点击资料卡可同步微信昵称和头像。", "手动同步会把当前唱片柜同步到已绑定电视。", "导入导出入口用于后续批量整理资料。"]
      },
      {
        index: "05",
        title: "微信分享",
        badge: "SHARE",
        description: "使用微信右上角官方分享按钮即可分享小程序链接。",
        steps: ["全部唱片页可分享纯展示收藏清单。", "专辑详情页可分享单张唱片。", "统计页可保存海报，也可调用微信图片分享。"]
      }
    ]
  },
  onShareAppMessage() {
    return createShareMessage({
      title: "唱片柜小程序操作手册",
      path: "/pages/user-guide/index"
    });
  }
});
