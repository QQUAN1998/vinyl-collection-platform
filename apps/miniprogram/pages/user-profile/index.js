const { createShareMessage, createShareTimeline } = require("../../services/share.js");
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
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
    this.loadProfile();
  },
  onShow() {
    const app = getApp();
    if (typeof app.applyThemeToPage === "function") {
      app.applyThemeToPage(this);
    }
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
  handleChooseAvatar(event) {
    const avatar = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : "";
    if (!avatar) return;
    this.setData({
      profileForm: {
        ...this.data.profileForm,
        avatar
      }
    });
  },
  saveProfileLegacy() {
    const app = getApp();
    const name = this.data.profileForm.name.trim() || "\u5531\u7247\u67dc\u7528\u6237";
    const nextProfile = {
      ...this.data.profileForm,
      name,
      bio: this.data.profileForm.bio.trim()
    };

    app.globalData.userProfile = nextProfile;
    app.globalData.userLabel = `${name} / ${app.globalData.collectionCostLabel || "\u00a50"}`;

    const finish = () => {
      wx.showToast({
        title: "已保存",
        icon: "success"
      });

      wx.navigateBack();
    };

    if (app.isCloudAccountReady && app.isCloudAccountReady() && app.syncWechatProfile) {
      app.syncWechatProfile({ nickName: name, avatarUrl: nextProfile.avatar })
        .then(finish);
      return;
    }

    finish();
  },
  saveProfile() {
    const app = getApp();
    const name = this.data.profileForm.name.trim() || "\u5531\u7247\u67dc\u7528\u6237";
    const nextProfile = {
      ...this.data.profileForm,
      name,
      bio: this.data.profileForm.bio.trim()
    };

    const applyLocalProfile = () => {
      app.globalData.userProfile = nextProfile;
      app.globalData.userLabel = `${name} / ${app.globalData.collectionCostLabel || "\u00a50"}`;
      if (typeof app.refreshUserLabel === "function") {
        app.refreshUserLabel();
      }
      if (typeof app.persistAuthState === "function") {
        app.persistAuthState();
      }
    };

    const finish = () => {
      applyLocalProfile();
      wx.showToast({
        title: "\u5df2\u4fdd\u5b58",
        icon: "success"
      });

      wx.navigateBack();
    };

    if (app.isCloudAccountReady && app.isCloudAccountReady() && app.syncWechatProfile) {
      wx.showLoading({ title: "\u4fdd\u5b58\u4e2d" });
      app.syncWechatProfile({ displayName: name, nickName: name, avatarUrl: nextProfile.avatar })
        .then((me) => {
          if (!me) {
            wx.showToast({
              title: "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5",
              icon: "none"
            });
            return;
          }
          finish();
        })
        .catch(() => {
          wx.showToast({
            title: "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5",
            icon: "none"
          });
        })
        .finally(() => {
          wx.hideLoading();
        });
      return;
    }

    finish();
  },
  cancelEdit() {
    wx.navigateBack();
  },
  onShareAppMessage() {
    return createShareMessage();
  },
  onShareTimeline() {
    return createShareTimeline(this.onShareAppMessage());
  }
});
