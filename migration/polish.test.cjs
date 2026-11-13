const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../apps/miniprogram/ui/chart-geometry'),C=require('../apps/miniprogram/ui/live-view-cache'),M=require('../apps/miniprogram/ui/stats-model');
test('monthly chart preserves all exact points and its curve stays within the plot',()=>{for(const values of [Array(12).fill(0),[0,500,1,0,2,10,0,8,9,3,0,100]]){const points=G.points(values,300,160);assert.equal(points.length,12);assert.deepEqual(points.map(r=>r.value),values);assert.ok(points.every(p=>p.x>=12&&p.x<=288&&p.y>=12&&p.y<=148));const commands=[],ctx={moveTo:(...a)=>commands.push(a),bezierCurveTo:(...a)=>commands.push(a)};G.line(ctx,points);assert.equal(commands.length,12);assert.ok(commands.every(row=>row.every(Number.isFinite)));}});
test('ring distribution adds to a full circle with no phantom slice for empty values',()=>{const rows=G.arcs([{count:2},{count:3},{count:0}]);assert.ok(Math.abs(rows[2].end-rows[0].start-Math.PI*2)<1e-9);assert.equal(rows[2].end,rows[2].start);assert.deepEqual(G.arcs([]),[]);});
test('cached live views never cross account identity or TTL and tolerate storage failure',()=>{let value;const wx={getStorageSync:()=>value,setStorageSync:(_,v)=>value=v};const records=[{id:'private'}];C.save(wx,'owner-a',records,100);assert.deepEqual(C.read(wx,'owner-a',101),records);assert.equal(C.read(wx,'owner-b',101),null);assert.equal(C.read(wx,'',101),null);assert.equal(C.read(wx,'owner-a',100+86400000),null);assert.equal(C.read(wx,'owner-a',99),null);assert.doesNotThrow(()=>C.save({setStorageSync(){throw Error('full');}},'owner-a',records));});
test('money labels distinguish dollars and yen and keep exact minor-unit arithmetic',()=>{const costs=M.costs([{expenses:[{currency:'JPY',minor:123},{currency:'USD',minor:123},{currency:'CNY',minor:101}]}]);assert.deepEqual(costs.map(r=>[r.currency,r.symbol,r.exact]),[['CNY','￥','1.01'],['JPY','JP¥','123'],['USD','$','1.23']]);assert.equal(M.symbol('HKD'),'HK$');assert.equal(M.symbol('TWD'),'NT$');});

test('translated confirmation preserves native promise results for cancel and confirm',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),path=require('node:path');
  const file=path.resolve('apps/miniprogram/ui/locale-runtime.js'),context={module:{exports:{}},require:createRequire(file),wx:{getStorageSync:()=>''},getApp:()=>({globalData:{}})};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
  for(const confirm of [false,true]){
    const result=await context.module.exports.modal({showModal:async opts=>({confirm,cancel:!confirm,title:opts.title})},{title:'删除收藏？'});
    assert.equal(result.confirm,confirm);assert.equal(result.cancel,!confirm);
  }
});
test('inactive or covered charts skip native canvas queries',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),path=require('node:path');
  const file=path.resolve('migration/ui/data-chart/index.js');let spec;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:createRequire(file),Component:s=>spec=s});
  let queries=0;const instance={data:{visible:false},createSelectorQuery(){queries++;throw Error('hidden chart queried');}};
  spec.methods.draw.call(instance);instance.data.visible=true;instance.disposed=true;spec.methods.draw.call(instance);assert.equal(queries,0);
});

test('calendar retains twelve months, selects empty months, and opens an empty detail safely',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),path=require('node:path');
  const file=path.resolve('apps/miniprogram/components/stats-board/index.js');let spec;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:createRequire(file),Component:s=>spec=s,wx:{}});
  const data={...spec.data,kind:'vinyl',year:'2026',records:[{id:'a',title:'A',artist:'Artist',date:'2026-01-01',quantity:1,tracks:0,expenses:[]}],layout:[]};
  const self={data,setData:p=>Object.assign(data,p)};for(const [k,v] of Object.entries(spec.methods))self[k]=v.bind(self);
  self.rebuild();assert.equal(data.months.length,12);assert.equal(data.months[11].month,12);
  self.monthTap({currentTarget:{dataset:{index:11}}});assert.equal(data.selectedMonth,11);assert.equal(data.selectedMonthCount,0);
  self.selectedMonthDetail();assert.equal(data.panel,'detail');assert.equal(data.detailRecords.length,0);
  for(const index of [-1,12,'invalid'])self.monthTap({currentTarget:{dataset:{index}}});assert.equal(data.selectedMonth,11);
});

test('destroyed rings cannot update view state',()=>{const {chart}=require('./ring-fixture.cjs');const c=chart([{count:1}]);let writes=0;c.setData=()=>writes++;c.disposed=true;c.draw();c.queue();assert.equal(writes,0);});
