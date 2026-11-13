const {openFromHome}=require('../../ui/home-navigation');
Component({properties:{kind:{type:String,value:'vinyl'},active:{type:String,value:'home'}},methods:{
 open(event){const action=event.currentTarget.dataset.action;if(action===this.data.active)return;
 const stack=typeof getCurrentPages==='function'?getCurrentPages():[],page=stack[stack.length-1];
 if(this.data.kind==='live'&&page?.route==='packages/live-archive/pages/index/index'&&typeof page.uiPrimary==='function'){page.uiPrimary(action);return;}
 const pages={home:'/pages/cabinet/index',stats:'/pages/stats/index',add:'/pages/add/index'};if(!pages[action])return;
 openFromHome(this.data.kind==='live'?'/packages/live-archive/pages/index/index?tab='+action:pages[action],wx);}
}});
