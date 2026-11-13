const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../apps/miniprogram/ui/stats-snapshot');
const records=Array.from({length:388},(_,i)=>({id:'disc-'+i,title:'收藏唱片 '+i,artist:'Artist '+i,date:'2026-11-12',cover:'https://example.test/covers/'+i+'.jpg',quantity:2,medium:'黑胶',genre:'流行',tracks:12,expenses:[{currency:'CNY',minor:12345}]}));
const data={v:1,kind:'vinyl',owner:'DAVID LAU',year:'2026',timelineYear:'2025',rankMetric:'amount',currency:'CNY',records};

test('hundreds of records share through a bounded reference rather than carrying the collection in the URL',()=>{
 for(const kind of ['vinyl','live'])for(const scope of ['stats','timeline']){
  const source=kind==='vinyl'?{ownerId:'owner A'}:{token:'a'.repeat(48)};
  const message=S.message({...data,kind,scope,source});
  assert.ok(Buffer.byteLength(message.path)<=1024);
  assert.match(message.path,/uiRef=/);
  const ref=S.decode(message.path.split('uiRef=')[1]);
  assert.deepEqual(ref.source,source);assert.equal(ref.records.length,0);
  assert.equal(ref.year,'2026');assert.equal(ref.timelineYear,'2025');
  assert.equal(ref.scope,scope);assert.equal(ref.rankMetric,'amount');
 }
});

test('large local-only collections cannot silently produce an unsendable card',()=>{
 assert.throws(()=>S.message(data),/登录|同步/);
 const small=S.message({...data,records:[]});assert.ok(small.path.length<=1024);
 assert.equal(S.decode(small.path.split('uiSnapshot=')[1]).owner,'DAVID LAU');
});

test('shared reference loads all records and never touches the recipient account',async()=>{
 assert.equal(typeof S.readReference,'function');
 const raw=S.message({...data,source:{ownerId:'original-owner'}}).path.split('uiRef=')[1];
 const result=await S.readReference(raw,{vinyl:async owner=>{
  assert.equal(owner,'original-owner');return {manualAlbums:records.map(r=>({...r,coverUrl:r.cover,style:r.genre,tracks:Array(12).fill({title:'曲目'})})),collectionItems:records.map(r=>({albumId:r.id,quantity:r.quantity,collectionDate:r.date,price:123.45,mediumKey:'vinyl'}))};
 }});
 assert.equal(result.records.length,388);assert.equal(result.records[0].quantity,2);
 assert.equal(result.records[0].title,records[0].title);
 assert.equal(result.source.ownerId,'original-owner');
 assert.ok(S.message(result).path.length<=1024);
 await assert.rejects(S.readReference(raw,{vinyl:async()=>null}),/分享/);
 await assert.rejects(S.readReference(S.encode({...data,records:[]}),{}),/分享/);
});

test('live short shares retain the public token and normalize all shared records',async()=>{
 const token='b'.repeat(48),raw=S.message({...data,kind:'live',scope:'timeline',source:{token}}).path.split('uiRef=')[1];
 const result=await S.readReference(raw,{live:async value=>{assert.equal(value,token);return {records:records.map(r=>({...r,name:r.title,notes:'private',ticketPhoto:'private'}))};}});
 assert.equal(result.records.length,388);assert.equal(result.scope,'timeline');
 assert.equal(result.records[0].title,records[0].title);assert.equal(result.records[0].notes,undefined);
 assert.equal(result.records[0].ticketPhoto,undefined);
});

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
function pageWithReader(reader){
 const file=path.resolve('apps/miniprogram/pages/stats/index.js'),base=createRequire(file);let spec;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,getApp:()=>({globalData:{}}),wx:{},require:r=>r==='../../ui/stats-snapshot'?{...S,readReference:reader}:r==='../../ui/locale-runtime'?{page:s=>s}:base(r),Date,Map,Set,Promise,setTimeout,clearTimeout});
 return {...spec,data:{...spec.data},setData(p){Object.assign(this.data,p);}};
}
test('cold shared entry fails closed, retries and preserves the original source on forwarding',async()=>{
 const snap=S.clean({...data,source:{ownerId:'original-owner'}});let tries=0;
 const p=pageWithReader(async()=>{if(++tries===1)throw Error('offline');return snap;});
 p.options={uiRef:'test'};p.loadStats=()=>assert.fail('must never read receiver collection');
 await p.onLoad(p.options);p.onShow();assert.equal(p.uiReadOnly,true);assert.equal(p.data.uiRecords.length,0);assert.ok(p.data.uiShareError);
 await p.uiRetryShare();assert.equal(p.data.uiShareError,'');assert.equal(p.data.uiRecords.length,388);assert.equal(p.data.uiShareLoading,false);
 const forwarded=p.onShareAppMessage();assert.ok(forwarded.path.length<=1024);
 assert.equal(S.decode(forwarded.path.split('uiRef=')[1]).source.ownerId,'original-owner');
});
test('late shared fetch cannot set state after the receiving page is unloaded',async()=>{
 let finish;const p=pageWithReader(()=>new Promise(r=>finish=r));
 const pending=p.onLoad({uiRef:'test'});p.onUnload();finish(S.clean({...data,source:{ownerId:'original-owner'}}));await pending;
 assert.equal(p.data.uiRecords.length,0);
});
test('the embedded home statistics pane uses the same short share source as the receiving page',()=>{
 const src=fs.readFileSync('apps/miniprogram/pages/stats/pane.js','utf8'),markup=fs.readFileSync('apps/miniprogram/pages/stats/pane.wxml','utf8');
 assert.match(src,/uiShareSource:app.isCloudAccountReady/);assert.match(markup,/share-source="\{\{uiShareSource\}\}"/);
 assert.doesNotMatch(markup,/<page-meta/);
});
test('live refresh clears stale share messages and only reuses a token owned by the current account',()=>{
 const file=path.resolve('apps/miniprogram/packages/live-archive/pages/index/index.js'),base=createRequire(file),state={ownerKey:'new-owner'};let spec;
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,getApp:()=>({globalData:{}}),wx:{},require:r=>r==='../../services/state'?state:r==='../../services/account'?{profile:()=>({loggedIn:true})}:r==='../../../../ui/locale-runtime'?{page:s=>s}:base(r),Date,Map,Set,Promise,setTimeout,clearTimeout});
 const p={...spec,data:{...spec.data,records:[]},setData(patch){Object.assign(this.data,patch);}};
 p.allShareOwner='old-owner';p.allShareToken='a'.repeat(48);p.uiStatsShare={path:'stale'};p.calc();
 assert.equal(p.uiStatsShare,null);assert.equal(p.data.uiStatsShareSource,null);
 p.allShareOwner='new-owner';p.calc();assert.equal(p.data.uiStatsShareSource.token,'a'.repeat(48));
 p.token='b'.repeat(48);p.calc();assert.equal(p.data.uiStatsShareSource.token,p.token);
});
