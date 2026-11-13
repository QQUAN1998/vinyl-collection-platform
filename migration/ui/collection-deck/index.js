const { buildDeck } = require('../../ui/deck-model');
const { openFromHome } = require('../../ui/home-navigation');
const motion = require('../../ui/gallery-motion');
const guideHint = require('../../ui/guide-hint');
function loop(cards) {
  if(!cards.length)return {slides:[],prefix:0};
  const prefix=Math.min(3,cards.length),n=cards.length;
  return {prefix,slides:Array.from({length:n+prefix*2},(_,i)=>({...cards[(i-prefix+n)%n],realIndex:(i-prefix+n)%n,slideKey:i}))};
}
Component({
  properties:{visible:{type:Boolean,value:true},loading:{type:Boolean,value:false},items:{type:Array,value:[]},collections:{type:Array,value:[]},kind:{type:String,value:'vinyl'},count:{type:Number,value:0},owner:{type:String,value:''},avatar:{type:String,value:''},readOnly:{type:Boolean,value:false},showAmount:{type:Boolean,value:true}},
  data:{guideHintVisible:false,cards:[],slides:[],visibleSlides:[],windowBefore:0,windowAfter:0,prefix:0,physical:0,ticks:[],position:'00',active:0,metric:'time',ascending:false,amountLabel:'',current:null,cardSize:265,pitch:287,inset:62,scrollLeft:0,slideStyles:{},rulerOffset:0,openingId:''},
  observers:{visible:function(v){if(v&&this.data.cards.length)this.jump(this.data.active,false);},'items, collections, kind, showAmount':function(){this.rebuild();}},
  lifetimes:{attached(){this.measure();this.refreshGuideHint();},detached(){this.disposed=true;clearTimeout(this.snapTimer);}},
  pageLifetimes:{show(){this.refreshGuideHint();}},
  methods:{
    refreshGuideHint(){this.setData({guideHintVisible:guideHint.visible(wx)});},
    openGuide(){wx.navigateTo({url:'/pages/user-guide/index?mode=onboarding',success:()=>{guideHint.complete(wx);this.refreshGuideHint();}});},
    dismissGuide(){guideHint.complete(wx);this.refreshGuideHint();},
    measure(){const info=wx.getWindowInfo?wx.getWindowInfo():{windowWidth:375},geometry=motion.geometry(info.windowWidth,this.data.kind);this.setData({...geometry,cardSize:geometry.card});this.jump(this.data.active,false);},
    rebuild(){
      const view=buildDeck(this.data.items,this.data.collections,this.data.kind,this.data.metric,this.data.ascending,this.data.showAmount);
      const signature=JSON.stringify({kind:this.data.kind,view});
      if(signature===this.deckSignature)return;
      this.deckSignature=signature;
      view.cards=view.cards.map(row=>this.failedImages?.has(row.cover)?{...row,cover:''}:row);
      const retained=view.cards.findIndex(row=>row.id===this.data.current?.id),active=retained>=0?retained:Math.min(this.data.active,Math.max(0,view.cards.length-1));
      this.setData({...view,...loop(view.cards)});
      this.activate(active);
      this.measure();
    },
    activate(index){const n=this.data.cards.length,active=n?((Number(index)%n)+n)%n:0,current=this.data.cards[active]||null,tickCount=n?31:0;if(active===this.data.active&&current===this.data.current&&this.data.ticks.length===tickCount)return;const update={active,current,position:n?String(active+1).padStart(2,'0'):'00'};if(this.data.ticks.length!==tickCount)update.ticks=Array.from({length:tickCount},(_,i)=>({selected:i===15}));this.setData(update);},
    renderWindow(physical){if(this.windowSlides===this.data.slides&&this.windowPhysical===physical&&this.windowPitch===this.data.pitch)return {};this.windowSlides=this.data.slides;this.windowPhysical=physical;this.windowPitch=this.data.pitch;return motion.window(this.data.slides,physical,this.data.pitch);},
    command(physical,animated){const left=physical*this.data.pitch,previous=this.lastLeft;this.lastLeft=left;const frame=motion.frame(left,this.data.pitch,this.data.slides.length),update={physical,animated,scrollLeft:left,slideStyles:frame.styles,rulerOffset:frame.rulerOffset,...this.renderWindow(physical)};if(animated&&this.data.scrollLeft===left&&Math.abs((previous||0)-left)>.8)this.setData({animated:false,scrollLeft:previous},()=>this.setData(update));else this.setData(update);},
    jump(index,animated=true){this.command(index+this.data.prefix,animated);},
    scroll(e){const left=Math.max(0,e.detail.scrollLeft||0);this.lastLeft=left;this.moved=true;clearTimeout(this.snapTimer);const now=Date.now();if(now-(this.lastFrame||0)>32){this.lastFrame=now;const frame=motion.frame(left,this.data.pitch,this.data.slides.length);this.setData({physical:frame.active,slideStyles:frame.styles,rulerOffset:frame.rulerOffset,...this.renderWindow(frame.active)});this.activate(frame.active-this.data.prefix);}this.snapTimer=setTimeout(()=>{if(!this.touching)this.settle();},200);},
    settle(){clearTimeout(this.snapTimer);if(this.touching||this.disposed)return;const n=this.data.cards.length;if(!n)return;const physical=motion.position(this.lastLeft||0,this.data.pitch,this.data.slides.length),active=((physical-this.data.prefix)%n+n)%n;this.activate(active);const offset=Math.abs((this.lastLeft||0)-physical*this.data.pitch);if(offset>.8){this.command(physical,true);this.snapTimer=setTimeout(()=>this.settle(),260);return;}if(physical<this.data.prefix||physical>=this.data.prefix+n)this.jump(active,false);else this.setData({physical,slideStyles:motion.frame(physical*this.data.pitch,this.data.pitch,this.data.slides.length).styles,...this.renderWindow(physical)});},
    touchStart(e){this.touching=true;this.moved=false;this.startTouch=e.touches?.[0];clearTimeout(this.snapTimer);},
    touchMove(e){const p=e.touches?.[0];if(p&&this.startTouch&&Math.hypot(p.clientX-this.startTouch.clientX,p.clientY-this.startTouch.clientY)>7){this.moved=true;}},
    touchEnd(){this.touching=false;clearTimeout(this.snapTimer);this.snapTimer=setTimeout(()=>this.settle(),220);},
    profile(){openFromHome('/pages/account/index',wx);},
    move(e){if(this.data.cards.length){this.activate(this.data.active+Number(e.currentTarget.dataset.step));this.jump(this.data.active);}},
    sort(e){const metric=e.currentTarget.dataset.metric;this.setData({metric,ascending:metric===this.data.metric?!this.data.ascending:false,active:0});this.rebuild();},
    select(e){if(this.moved||this.disposed)return;const id=e.currentTarget.dataset.id,item=this.data.items.find(row=>row.id===id);if(!item)return;const now=Date.now();if(this.lastSelection?.id===id&&now-this.lastSelection.at<350)return;this.lastSelection={id,at:now};this.triggerEvent('select',{id,album:item});},
    empty(){this.triggerEvent('empty');},
    imageError(e){
      const src=e.currentTarget.dataset.src;if(!src||this.failedImages?.has(src))return;
      if(!this.failedImages)this.failedImages=new Set();this.failedImages.add(src);
      const fallback=row=>row.cover===src?{...row,cover:''}:row;
      const update={cards:this.data.cards.map(fallback),current:this.data.current?fallback(this.data.current):null};
      update.slides=this.data.slides.map(fallback);update.visibleSlides=this.data.visibleSlides.map(fallback);this.windowSlides=null;
      this.setData(update);
    }
  }
});
