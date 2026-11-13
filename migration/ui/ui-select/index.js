Component({
  options:{multipleSlots:true},
  properties:{range:{type:Array,value:[]},rangeKey:{type:String,value:''},value:{type:null,value:0},disabled:{type:Boolean,value:false},label:{type:String,value:'选择'}},
  data:{opened:false,rows:[],menuStyle:''},
  methods:{
    open(){if(this.data.disabled)return;this.createSelectorQuery().select('.select-anchor').boundingClientRect(rect=>{if(!rect)return;const win=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();const width=Math.max(112,Math.min(rect.width,win.windowWidth-32));const height=Math.min(260,this.data.range.length*44+12);const top=rect.bottom+6+height>win.windowHeight-16?Math.max(16,rect.top-height-6):rect.bottom+6;this.setData({opened:true,rows:this.data.range.map((r,i)=>({index:i,label:this.data.rangeKey?r[this.data.rangeKey]:String(r),selected:i===Number(this.data.value)})),menuStyle:'left:'+Math.min(win.windowWidth-width-16,Math.max(16,rect.left))+'px;top:'+top+'px;width:'+width+'px;height:'+height+'px'});}).exec();},
    choose(e){this.setData({opened:false});this.triggerEvent('change',{value:Number(e.currentTarget.dataset.index)});},
    close(){this.setData({opened:false});},noop(){}
  }
});
