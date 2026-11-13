const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const M=require('../apps/miniprogram/ui/gallery-motion'),N=require('../apps/miniprogram/ui/space-navigation'),S=require('../apps/miniprogram/ui/stats-model');
test('momentum may cross many equal-width records and snapping always centers the nearest record',()=>{
  for(const width of [320,375,390,430]){const g=M.geometry(width);assert.equal(g.card+2*g.inset,width);assert.equal(M.position(g.pitch*7.7,g.pitch,388),8);assert.equal(M.position(-50,g.pitch,388),0);assert.equal(M.position(999999,g.pitch,388),387);const f=M.frame(g.pitch*8,g.pitch,388);assert.match(f.styles[8],/rotateY\(0.00deg\) rotateZ\(0.00deg\)/);assert.equal(f.active,8);assert.ok(Object.keys(f.styles).length<=7);}
});
test('space switches reuse existing homes and avoid a reset of the account or record services',()=>{
  const calls=[],api={navigateBack:x=>{calls.push(['back',x.delta]);x.complete();},navigateTo:x=>{calls.push(['open',x.url]);x.complete();},redirectTo:x=>{calls.push(['replace',x.url]);x.complete();},showToast(){}};
  N.switchSpace('live',api,[{route:'pages/cabinet/index'}]);N.switchSpace('vinyl',api,[{route:'pages/cabinet/index'},{route:'packages/live-archive/pages/index/index'}]);N.switchSpace('x',api,[]);
  assert.deepEqual(calls,[['open','/packages/live-archive/pages/index/index'],['back',1]]);
  const a={globalData:{userId:'a'}},b={globalData:{userId:'b'}};N.mark('live',a,100000);assert.equal(N.recent('live',a,110000),true);assert.equal(N.recent('live',b,110000),false);assert.equal(N.recent('live',a,131000),false);assert.equal(N.recent('vinyl',a,110000),false);
});
test('single taps open immediately, rapid repeated taps are deduplicated, and dragging cancels taps',()=>{
 const file=path.resolve('apps/miniprogram/components/collection-deck/index.js');let spec,now=10000,timers=[],events=[],storage;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:v=>spec=v,require:createRequire(file),wx:{setStorageSync:(k,v)=>storage=v},Date:{now:()=>now},Math,Map,Set,Number,String,Array,Object,Promise,setTimeout:(fn,ms)=>{const t={fn,at:now+ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.dead=true;}});
 const data={...spec.data,kind:'vinyl',items:[{id:'a'},{id:'b'}]},self={data,setData:p=>Object.assign(data,p),triggerEvent:(name,detail)=>events.push(detail)};for(const [k,v]of Object.entries(spec.methods))self[k]=v.bind(self);
 const tap={currentTarget:{dataset:{id:'a'}},touches:[{clientX:100,clientY:100}]};self.touchStart(tap);self.select(tap);now+=120;self.touchStart(tap);self.select(tap);now+=400;for(const t of timers)if(!t.dead&&t.at<=now){t.dead=true;t.fn();}assert.equal(data.discMode,undefined);assert.equal(storage,undefined);assert.equal(events.length,1);assert.equal(data.items.length,2);
 self.touchStart(tap);self.touchMove({touches:[{clientX:140,clientY:100}]});self.select(tap);assert.equal(events.length,1);
 self.touchStart(tap);self.select(tap);now+=400;for(const t of timers)if(!t.dead&&t.at<=now){t.dead=true;t.fn();}assert.equal(events.length,2);assert.equal(events[1].id,'a');
});
test('genre ranks use existing album styles and keep multi-word styles intact',()=>{
  const albums=[{id:'a',title:'a',style:'电影/游戏原声'},{id:'b',title:'b',style:'Jazz'}],items=[{albumId:'a',quantity:2,collectionDate:'2026-01-01'},{albumId:'b',quantity:1,collectionDate:'2026-01-02'}];
  const v=S.view(S.vinylRecords(albums,items),'vinyl',{year:'2026'});assert.equal(v.genres[0].name,'电影/游戏原声');assert.equal(v.genres[0].count,2);assert.equal(v.months[0].count,3);
  const snap=require('../apps/miniprogram/ui/stats-snapshot');assert.equal(snap.decode(snap.encode({v:1,kind:'vinyl',records:S.vinylRecords(albums,items)})).records[0].genre,'电影/游戏原声');
});
test('manual add entry accepts manual while arbitrary values cannot navigate',()=>{
  const file=path.resolve('apps/miniprogram/packages/live-archive/pages/index/index.js');let spec;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:v=>spec=v,require:createRequire(file),wx:{},Date});
  assert.equal(spec.data.addEntry,'link');
  const data={busy:false,addEntry:'link'},self={data,setData:p=>Object.assign(data,p)};spec.entry.call(self,{currentTarget:{dataset:{value:'manual'}}});assert.equal(data.addEntry,'manual');spec.entry.call(self,{currentTarget:{dataset:{value:'unknown'}}});assert.equal(data.addEntry,'manual');
  spec.entry.call(self,{currentTarget:{dataset:{value:'search'}}});assert.equal(data.addEntry,'search');
  spec.entry.call(self,{currentTarget:{dataset:{value:'link'}}});assert.equal(data.addEntry,'link');
});
test('timeline preview stops at five, while complete popup preserves all records and dates',()=>{
  const file=path.resolve('apps/miniprogram/components/stats-board/index.js');let spec;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:v=>spec=v,require:createRequire(file),wx:{},Date,Set,Map});
  const data={...spec.data,kind:'vinyl',records:Array.from({length:12},(_,i)=>({id:String(i),artist:'A',title:String(i),date:'2026-01-01',quantity:1,tracks:0,expenses:[]})),layout:[]},self={data,setData:p=>Object.assign(data,p)};for(const [k,v]of Object.entries(spec.methods))self[k]=v.bind(self);self.rebuild();assert.equal(data.timelinePreview.length,5);self.openTimeline();assert.equal(data.detailRecords.length,12);assert.equal(data.panel,'timeline');
});
test('cover dismissal ignores horizontal drags and cancels cleanly without navigation',()=>{
  const d=require('../apps/miniprogram/ui/detail-motion'),data={},p={data,setData:x=>Object.assign(data,x)};d.uiCoverStart.call(p,{touches:[{clientX:50,clientY:50}]});d.uiCoverMove.call(p,{touches:[{clientX:150,clientY:60}]});assert.equal(data.uiDragY,undefined);d.uiCoverMove.call(p,{touches:[{clientX:55,clientY:150}]});assert.equal(data.uiDragY,75);d.uiCoverCancel.call(p);assert.equal(data.uiDragY,0);assert.equal(data.uiDetailOpacity,1);
});

test('a short drag back to the same item still changes the native scroll command',()=>{
  const file=path.resolve('apps/miniprogram/components/collection-deck/index.js');let spec;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:v=>spec=v,require:createRequire(file),wx:{},Date,Math,Map,Set,Number,String,Array,Object,Promise,setTimeout,clearTimeout});
  const writes=[],data={...spec.data,cards:[{id:'a'}],scrollLeft:0},self={data,lastLeft:68,setData(p,done){writes.push({...p});Object.assign(data,p);if(done)done();}};
  self.renderWindow=spec.methods.renderWindow.bind(self);self.command=spec.methods.command.bind(self);spec.methods.jump.call(self,0,true);assert.equal(writes[0].scrollLeft,68);assert.equal(writes[1].scrollLeft,0);assert.equal(writes[1].animated,true);
});

test('a newly created live record with no date renders an empty date field safely',()=>{
  const file=path.resolve('apps/miniprogram/components/date-field/index.js');let spec;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:v=>spec=v,require:createRequire(file),Date,Array,String});
  const data={},self={setData:p=>Object.assign(data,p)};
  spec.observers.value.call(self,null);assert.equal(data.displayDate,'');
  spec.observers.value.call(self,'2026-11-01');assert.equal(data.displayDate,'2026/11/01');
});
