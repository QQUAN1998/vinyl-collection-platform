// Only the cover starts this gesture. Other detail controls keep native scrolling.
const detailMotion = {
  uiCoverStart(event) {
    this.uiTouch = event.touches?.[0];
    this.uiCanDismiss = (this.uiPageTop || 0) < 4;
  },
  uiCoverMove(event) {
    const point = event.touches?.[0], start = this.uiTouch;
    if (!point || !start || !this.uiCanDismiss) return;
    const y = point.clientY - start.clientY, x = point.clientX - start.clientX;
    if (y <= 0 || Math.abs(x) > y) return;
    const drag = Math.min(240,y*.75);
    this.setData({uiDragY:drag,uiDetailOpacity:Math.max(.15,1-drag/280)});
  },
  uiCoverCancel() { this.uiTouch=null;this.setData({uiDragY:0,uiDetailOpacity:1}); },
  uiCoverEnd() {
    this.uiTouch = null;
    if ((this.data.uiDragY || 0) > 90 && (this.uiInSheet || getCurrentPages().length > 1)) {
      this.setData({uiClosing:true,uiDragY:250,uiDetailOpacity:0});
      setTimeout(()=>{if(this.uiInSheet)this.uiSheetClose();else wx.navigateBack({fail:()=>this.setData({uiClosing:false,uiDragY:0,uiDetailOpacity:1})});},180);
    } else this.setData({uiDragY:0,uiDetailOpacity:1});
  },
  onPageScroll(event) { this.uiPageTop = event.scrollTop; }
};
module.exports = detailMotion;
