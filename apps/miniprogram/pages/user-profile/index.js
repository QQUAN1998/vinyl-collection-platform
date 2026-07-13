const { createShareMessage } = require("../../services/share.js");
Page({
  data: {
    avatarInitial: "D",
    profileForm: {
      name: "David",
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
        name: profile.name || "David",
        avatar: profile.avatar || "",
        bio: profile.bio || ""
      },
      avatarInitial: (profile.name || "D").slice(0, 1).toUpperCase()
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
        ? (event.detail.value || "D").slice(0, 1).toUpperCase()
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
    const name = this.data.profileForm.name.trim() || "David";
    const nextProfile = {
      ...this.data.profileForm,
      name,
      bio: this.data.profileForm.bio.trim()
    };

    app.globalData.userProfile = nextProfile;
    app.globalData.userLabel = `${name} / ${app.globalData.collectionCostLabel || "¥184,000"}`;

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
