const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const M=require('../apps/miniprogram/ui/stats-model'),S=require('../apps/miniprogram/ui/stats-snapshot');
const records=Array.from({length:8},(_,i)=>({id:String(i),date:'2026-01-'+String(i+1).padStart(2,'0'),title:'唱片'+i,artist:'艺人',quantity:i===0?3:1,medium:'黑胶',expenses:[{currency:'CNY',minor:100}],city:'上海',venue:'场馆'}));
function board(kind='vinyl',extra={}){
 const file=path.resolve('apps/miniprogram/components/stats-board/index.js');let spec;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Component:s=>spec=s,require:createRequire(file),wx:{showToast(){}},Date,Map,Set,Array,Number,String,Object,Math,Promise,setTimeout,clearTimeout});
 const data={...spec.data,records,kind,owner:'测试',...extra},events=[],self={data,events,setData:p=>Object.assign(data,p),triggerEvent:(name,detail)=>events.push({name,detail})};
 for(const [name,fn] of Object.entries(spec.methods))self[name]=fn.bind(self);self.rebuild();return self;
}
test('month taps directly open descending timelines with lifetime sequence and retain all empty months',()=>{
 for(const kind of ['vinyl','live']){
  const c=board(kind),before=JSON.stringify(records);c.monthTap({currentTarget:{dataset:{index:0}}});
  assert.equal(c.data.panel,'detail');assert.equal(c.data.detailRecords[0].id,'7');assert.equal(c.data.detailRecords[0].sequence,8);
  assert.equal(c.data.detailRecords.at(-1).id,'0');assert.equal(c.data.detailRecords.at(-1).sequence,1);
  c.monthTap({currentTarget:{dataset:{index:11}}});assert.equal(c.data.months.length,12);assert.equal(c.data.panel,'detail');assert.equal(c.data.detailEmpty,true);assert.equal(c.data.detailRecords.length,0);
  c.openTimeline();assert.equal(c.data.panel,'timeline');assert.equal(c.data.detailEmpty,false);assert.equal(c.data.detailRecords.length,8);
  assert.equal(JSON.stringify(records),before);
 }
});
test('timeline shares preserve filters, open a complete isolated timeline and do not leak into ordinary statistics sharing',()=>{
 for(const kind of ['vinyl','live']){
  const c=board(kind);c.openTimelineShare();assert.equal(c.data.panel,'timelineShare');
  const message=c.events.findLast(e=>e.name==='snapshot').detail.message,snap=S.decode(message.path.split('uiSnapshot=')[1]);
  assert.equal(snap.scope,'timeline');assert.match(message.title,/时间线/);assert.deepEqual(snap.layout.filter(r=>r.visible).map(r=>r.id),['timeline']);
  const reader=board(kind,{records:snap.records,readOnly:true,snapshotOptions:snap});assert.equal(reader.data.viewScope,'timeline');assert.equal(reader.data.timelinePreview.length,8);
  reader.selectRecord({currentTarget:{dataset:{id:'7'}}});assert.equal(reader.events.length,0);
  c.openShare();const ordinary=S.decode(c.events.findLast(e=>e.name==='snapshot').detail.message.path.split('uiSnapshot=')[1]);assert.equal(ordinary.scope,'stats');assert.ok(ordinary.layout.filter(r=>r.visible).length>1);
 }
});
test('monthly details retain global lifetime ordinal when the selected year differs from timeline filter',()=>{
 const older={...records[0],id:'older',date:'2025-01-01'},c=board('vinyl',{records:[older,...records],year:'2026',timelineYear:'2025'});
 c.monthTap({currentTarget:{dataset:{index:0}}});assert.equal(c.data.detailRecords.length,8);assert.equal(c.data.detailRecords[0].sequence,9);assert.equal(c.data.timeline.length,1);
});
test('monochrome ring colors preserve counts and percentages',()=>{
 const v=M.view(records,'vinyl');assert.equal(v.units,10);assert.equal(v.formats[0].percent,100);
 for(const color of M.PALETTE)assert.match(color,/^#([0-9a-f]{2})\1\1$/i);
});

test('live city ring shares the accent palette, counts events and filters without mutating records',()=>{
 const source=[{...records[0],quantity:1,city:'广州'},{...records[1],city:'广州',quantity:1},{...records[2],city:'上海',quantity:1},{...records[3],city:'北京',date:'2025-01-01',quantity:1}],before=JSON.stringify(source);
 const c=board('live',{records:source,year:'2026'});
 assert.equal(c.data.distributionTotal,3);
 assert.deepEqual(c.data.distribution.map(r=>[r.name,r.count,r.color]),[['广州',2,'#242424'],['上海',1,'#d1ff66']]);
 assert.deepEqual(c.data.distribution.map(r=>r.percent),[67,33]);
 c.cityDetail({currentTarget:{dataset:{name:'广州'}}});assert.equal(c.data.detailRecords.length,2);
 const empty=board('live',{records:source,year:'2024'});assert.equal(empty.data.distributionTotal,0);assert.deepEqual(empty.data.distribution,[]);
 assert.equal(JSON.stringify(source),before);
});

test('genre ring weights owned quantities, keeps uncategorized records, and follows year filtering',()=>{
 const source=[
  {...records[0],id:'rock',genre:'摇滚',quantity:3},
  {...records[1],id:'pop',genre:'流行',quantity:1},
  {...records[2],id:'unknown',genre:'',quantity:1},
  {...records[3],id:'older',genre:'爵士',quantity:2,date:'2025-01-01'}
 ],before=JSON.stringify(source),v=M.view(source,'vinyl',{year:'2026'});
 assert.equal(v.genreTotal,5);assert.equal(v.genreTotal,v.units);
 assert.deepEqual(v.genres.map(r=>[r.name,r.count,r.percent]).sort(),[['摇滚',3,60],['流行',1,20],['未分类',1,20]].sort());
 const arcs=require('../apps/miniprogram/ui/chart-geometry').arcs(v.genres);
 assert.ok(Math.abs(arcs.at(-1).end-arcs[0].start-2*Math.PI)<1e-10);
 assert.deepEqual(M.ACCENT_PALETTE,['#242424','#d1ff66']);
 assert.deepEqual(v.genres.map(r=>r.color),['#242424','#d1ff66','#242424']);
 for(const row of v.genres)assert.equal(row.accent,row.color==='#d1ff66');
 assert.equal(M.view(source,'vinyl').genreTotal,7);
 const empty=M.view(source,'vinyl',{year:'2024'});assert.equal(empty.genreTotal,0);assert.deepEqual(empty.genres,[]);
 const c=board('vinyl',{records:source,year:'2026'});c.genreDetail({currentTarget:{dataset:{name:'摇滚'}}});
 assert.equal(c.data.detailRecords.length,1);assert.equal(c.data.detailRecords[0].id,'rock');
 assert.equal(JSON.stringify(source),before);
});

test('genre ring preserves the standard palette even with legacy dark input',()=>{const {chart}=require('./ring-fixture.cjs');for(const [theme,expected]of [['theme-standard',['#242424','#d1ff66']],['theme-dark',['#242424','#d1ff66']]]){const c=chart(M.ACCENT_PALETTE.map(color=>({count:1,color})),theme);assert.deepEqual(Array.from(c.data.segments,s=>s.color),expected);}});
