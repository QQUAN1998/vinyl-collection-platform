const { createShareMessage } = require("../../services/share.js");
Page({
  data: {
    avatarInitial: "\u5531",
    profileForm: {
      name: "\u5531\u7247\u67dc\u7528\u6237",
      avatar: "",
      bio: ""
    }
  },
  onLoad() {
    this.loadProfile();
  },
  loadProfile() {
    const app = getApp();
    const profile = app.globalData.userProfile || this.data.profileForm;

    this.setData({
      profileForm: {
        name: profile.name || "\u5531\u7247\u67dc\u7528\u6237",
        avatar: profile.avatar || "",
        bio: profile.bio || ""
      },
      avatarInitial: (profile.name || "\u5531").slice(0, 1).toUpperCase()
    });
  },
  handleFieldChange(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({
      profileForm: {
        ...this.data.profileForm,
        [key]: event.detail.value
      },
      avatarInitial: key === "name"
        ? (event.detail.value || "\u5531").slice(0, 1).toUpperCase()
        : this.data.avatarInitial
    });
  },
  chooseAvatar() {
    const applyAvatar = (avatar) => {
      if (!avatar) return;
      this.setData({
        profileForm: {
          ...this.data.profileForm,
          avatar
        }
      });
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (result) => {
          applyAvatar(result.tempFiles && result.tempFiles[0] && result.tempFiles[0].tempFilePath);
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      success: (result) => {
        applyAvatar(result.tempFilePaths && result.tempFilePaths[0]);
      }
    });
  },
  saveProfile() {
    const app = getApp();
    const name = this.data.profileForm.name.trim() || "\u5531\u7247\u67dc\u7528\u6237";
    const nextProfile = {
      ...this.data.profileForm,
      name,
      bio: this.data.profileForm.bio.trim()
    };

    app.globalData.userProfile = nextProfile;
    app.globalData.userLabel = `${name} / ${app.globalData.collectionCostLabel || "\u00a50"}`;

    wx.showToast({
      title: "已保存",
      icon: "success"
    });

    wx.navigateBack();
  },
  cancelEdit() {
    wx.navigateBack();
  },
  onShareAppMessage() {
    return createShareMessage();
  }
});
