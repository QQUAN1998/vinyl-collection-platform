const G = require('../../ui/chart-geometry');
Component({
  properties:{visible:{type:Boolean,value:true},rows:{type:Array,value:[]},mode:{type:String,value:'ring'},total:{type:Number,value:0},label:{type:String,value:'收藏'}},
  data:{segments:[],trackColor:'#eeeeee'},
  observers:{'rows,uiThemeClass,visible':function(){this.queue();}},
  lifetimes:{ready(){this.queue();},detached(){this.disposed=true;}},
  pageLifetimes:{show(){this.queue();}},
  methods:{
    queue(){this.draw();},
    draw(){
      if(this.disposed||!this.data.visible)return;
      const segments=[];
      // Clipped semicircles use ordinary view layers, with no native canvas export.
      G.arcs(this.data.rows||[]).forEach(row=>{
        const source=row.color||'#242424';
        const color=source;
        let start=(row.start+Math.PI/2)*180/Math.PI,remaining=(row.end-row.start)*180/Math.PI;
        while(remaining>1e-7){const sweep=Math.min(180,remaining);segments.push({id:segments.length,start,sweep,color});start+=sweep;remaining-=sweep;}
      });
      this.setData({segments,trackColor:'#eeeeee'});
    }
  }
});
