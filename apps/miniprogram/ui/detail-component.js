const uiLocale=require("./locale-runtime");
// Reuse the original detail controller inside a full-height native bottom sheet.
// Record loading, editing, playback and cloud writes remain in that controller.
module.exports=function(spec){
 const methods=Object.fromEntries(Object.entries(spec).filter(([,v])=>typeof v==='function'));
 Component(uiLocale.component({properties:{options:{type:Object,value:{}}},data:spec.data,methods:{...methods,
  uiSheetClose(){this.triggerEvent('close');},uiSheetScroll(e){this.uiPageTop=e.detail.scrollTop;}
 },lifetimes:{attached(){this.uiInSheet=true;this.options=this.data.options;spec.onLoad?.call(this,this.options);spec.onShow?.call(this);},detached(){spec.onUnload?.call(this);}},pageLifetimes:{show(){spec.onShow?.call(this);},hide(){spec.onHide?.call(this);}}}));
};
