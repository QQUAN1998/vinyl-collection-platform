const { albums } = require("../../data/seed.js");
const {
  getDefaultSelectedAlbumIds,
  parseBatchInput,
  matchAlbumCandidates
} = require("../../services/import-service.js");
const { createShareMessage, createShareTimeline } = require("../../services/share.js");

const sampleBatchText = "伍佰 & China Blue - 浪人情歌\n伍佰 & China Blue - 白鸽\n伍佰 & China Blue - 双面人";

Page({
  data: {
    batchText: sampleBatchText,
    duplicateLines: [],
    errorMessage: ""
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
  },
  handleBatchText(event) {
    const batchText = event.detail.value;
    this.setData({
      batchText,
      errorMessage: ""
    });
  },
  goResults() {
    try {
      const app = getApp();
      const collectionItems = app.globalData.collectionItems || [];
      const parsed = parseBatchInput(this.data.batchText);
      const matches = matchAlbumCandidates(parsed.entries, albums, collectionItems);

      app.globalData.importDraft = {
        source: "batch",
        batchText: this.data.batchText,
        parsed,
        matches,
        selectedAlbumIds: getDefaultSelectedAlbumIds(matches),
        candidates: matches.flatMap((match) => match.candidates)
      };

      this.setData({
        duplicateLines: parsed.duplicates,
        errorMessage: ""
      });

      wx.navigateTo({
        url: "/pages/search-results/index"
      });
    } catch (error) {
      this.setData({
        errorMessage: error.message
      });
    }
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
