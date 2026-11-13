const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../apps/miniprogram');
const future={id:'qi-yu',name:'【广州】齐豫 风采依旧·在广州演唱会 FOREVER SPLENDOR LIVE CONCERT',artist:'齐豫',date:'2026-12-19',status:'想看',city:'广州市',venue:'广州亚运城综合体育馆',posterUrl:'https://example.com/qi-yu.jpg',source:'https://m.damai.cn/shows/item.html?itemId=1055050027856&from=appshare',expenses:[],photos:[],tickets:[],songs:[]};
function page(which='index'){
 const file=path.join(root,`packages/live-archive/pages/${which}/${which==='index'?'index':'edit'}.js`),state={records:[future],draft:null},calls=[],patches=[];
 const api={id:()=> 'request',call:async()=>({fields:{...future},platform:'大麦',sessions:[]}),error(){},save:async r=>(calls.push(r),{...r,id:r.id||'saved'}),load:async()=>state.records};
 let spec;const actual=createRequire(file),account={profile:()=>({loggedIn:true,name:'测试'}),enableShare(){}};
 const req=name=>name.endsWith('locale-runtime')?{page:s=>s,toast(){},title(){}}:name.endsWith('/services/state')?state:name.endsWith('/services/archive')?api:name.endsWith('/services/account')?account:actual(name);
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,require:req,wx:{navigateTo(){},navigateBack(){},redirectTo(){},showToast(){}},getApp:()=>({globalData:{}}),Date,Map,Set,Array,Object,Number,String,Promise,setTimeout,clearTimeout});
 const self={data:JSON.parse(JSON.stringify(spec.data)),setData(p,cb){patches.push(p);Object.assign(this.data,p);cb?.();}};
 for(const [key,value]of Object.entries(spec))if(typeof value==='function')self[key]=value.bind(self);
 return {self,state,api,calls,patches};
}
function deck(kind='live'){
 const file=path.join(root,'components/collection-deck/index.js'),actual=createRequire(file);let spec;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:s=>spec=s,require:n=>n.endsWith('locale-runtime')?{component:s=>s}:actual(n),wx:{getWindowInfo:()=>({windowWidth:390})},Date,Map,Set,Array,Object,Number,String,Math,Promise,setTimeout,clearTimeout});
 const patches=[],self={data:JSON.parse(JSON.stringify(spec.data)),setData(p,cb){patches.push(p);Object.assign(this.data,p);cb?.();},triggerEvent(){}};
 for(const [k,v]of Object.entries(spec.properties))self.data[k]=v.value;
 Object.assign(self.data,{kind,items:[{...future},{...future,id:'past',date:'2024-05-25',status:'已看过'}]});
 for(const [k,v]of Object.entries(spec.methods))self[k]=v.bind(self);
 return {self,patches,spec};
}
test('future Damai links, artist search and session selection all default to attended',async()=>{
 const {self,state}=page();self.data.source=future.source;await self.importLink();assert.equal(state.draft.status,'已看过');
 self.data.selectedArtist={id:'artist'};await self.selectEvent({currentTarget:{dataset:{id:'show'}}});assert.equal(state.draft.status,'已看过');
 self.data.importDraft={...future};self.data.sessions=[{date:future.date}];self.session({detail:{value:0}});assert.equal(state.draft.status,'已看过');
});
test('legacy hidden records return to homepage and statistics without changing originals',()=>{
 const {self}=page();const input=[{...future},{...future,id:'paid',status:'已购票'}];const before=JSON.stringify(input);self.update(input);
 assert.equal(self.data.records.length,2);assert.equal(self.data.uiStatsRecords.length,2);assert.equal(self.data.stats.shows,2);assert.equal(JSON.stringify(input),before);
});
test('statistics adapter accepts all stored collections as attended',()=>{
 const stats=require(path.join(root,'ui/stats-model'));const out=stats.liveRecords([future,{...future,id:'paid',status:'已购票'}]);assert.equal(out.length,2);
});
test('editing and saving legacy records fixes their status as attended',async()=>{
 const {self,calls}=page('edit');self.onLoad({id:future.id});assert.equal(self.data.draft.status,'已看过');
 self.data.draft.status='想看';await self.save();assert.equal(calls[0].status,'已看过');
});
test('live carousel allows a momentum scroll to cross multiple posters',()=>{
 const {self}=deck();self.data.items=Array.from({length:8},(_,i)=>({...future,id:'live-'+i,date:'2026-12-'+String(i+10)}));self.rebuild();
 self.scroll({detail:{scrollLeft:(self.data.prefix+4)*self.data.pitch}});self.touching=false;self.settle();assert.equal(self.data.active,4);clearTimeout(self.snapTimer);
 const markup=fs.readFileSync(path.join(root,'components/collection-deck/index.wxml'),'utf8');assert.doesNotMatch(markup,/<swiper\b/);assert.match(markup,/bindtouchstart="touchStart"/);
});
test('failed poster cannot rewind or rebuild the carousel',()=>{
 const {self,patches}=deck();self.rebuild();self.activate(1);const active=self.data.active;patches.length=0;
 self.imageError({currentTarget:{dataset:{src:future.posterUrl}}});assert.equal(self.data.active,active);assert.equal(patches.some(p=>Object.hasOwn(p,'scrollLeft')),false);assert.equal(self.data.slides.every(row=>row.cover!==future.posterUrl),true);assert.equal(self.data.items[0].posterUrl,future.posterUrl);
});
test('unchanged gallery data does not reset position',()=>{
 const {self,patches}=deck('vinyl');self.rebuild();patches.length=0;self.rebuild();assert.equal(patches.length,0);
});
test('removed status choices and dark display branches are absent from active pages',()=>{
 for(const rel of ['packages/live-archive/pages/edit/edit.wxml','packages/live-archive/pages/detail/detail.wxml','packages/live-archive/pages/index/index.wxml']){
  const src=fs.readFileSync(path.join(root,rel),'utf8');assert.doesNotMatch(src,/draft\.status|record\.status|statuses|statusIndex|theme-dark/);
 }
 const js=fs.readFileSync(path.join(root,'packages/live-archive/pages/index/index.js'),'utf8');assert.doesNotMatch(js,/想看|已购票/);
});

test('sharing the live home includes legacy collections instead of a status-limited token',async()=>{
 const {self,api}=page();let args;api.call=async(...value)=>(args=value,{token:'all-records'});await self.prepareShare();assert.equal(args[0],'share');assert.equal(args[1]?.scope,'all');assert.equal(self.data.shareReady,true);
});
