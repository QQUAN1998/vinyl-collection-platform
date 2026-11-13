const uiLocale=require("../../ui/locale-runtime");
const {openFromHome}=require('../../ui/home-navigation');
Component(uiLocale.component({properties:{kind:{type:String,value:'vinyl'},avatar:{type:String,value:''}},data:{owner:''},lifetimes:{attached(){this.sync();}},pageLifetimes:{show(){this.sync();}},methods:{sync(){const p=getApp().globalData.userProfile||{};this.setData({owner:p.name||'我',avatar:this.data.avatar||p.avatar||''});},profile(){openFromHome('/pages/account/index',wx);}}}));
