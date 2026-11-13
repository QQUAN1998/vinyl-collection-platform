const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
function page(rel,app={},wx={},overrides={}){const file=path.resolve('apps/miniprogram',rel),base=createRequire(file);let spec;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:x=>spec=x,getApp:()=>app,wx,require:x=>Object.hasOwn(overrides,x)?overrides[x]:base(x),Date,Set,Map,Promise,setTimeout,clearTimeout});const self={...spec,data:{...spec.data},setData(p,cb){Object.assign(this.data,p);if(cb)cb();}};return self;}
test('vinyl statistics full collection share overrides snapshot and retains encoded owner',()=>{const app={globalData:{userId:'owner A',userProfile:{name:'A'}},isCloudAccountReady:()=>true},p=page('pages/stats/index.js',app);p.uiStatsShare={path:'/snapshot'};assert.equal(p.onShareAppMessage({target:{dataset:{scope:'all'}}}).path,'/pages/all-collection/index?ownerId=owner%20A');assert.equal(p.onShareAppMessage().path,'/snapshot');});
test('read-only snapshots cannot share the viewing account collection',async()=>{const app={globalData:{userId:'viewer'},isCloudAccountReady:()=>true},p=page('pages/stats/index.js',app);p.data.uiReadOnly=true;p.uiStatsShare={path:'/original-snapshot'};await p.uiCollectionShare({detail:{passive:false}});assert.equal(p.data.uiCollectionShareReady,false);assert.equal(p.onShareAppMessage({target:{dataset:{scope:'all'}}}).path,'/original-snapshot');});
test('opening vinyl share menu checks readiness without prompting login',async()=>{let loginCalls=0;const app={globalData:{userId:''},isCloudAccountReady:()=>false,requireWechatAccount:async()=>{loginCalls++;return null;}},p=page('pages/stats/index.js',app);await p.uiCollectionShare({detail:{passive:true}});assert.equal(loginCalls,0);assert.equal(p.data.uiCollectionShareReady,false);});
test('live statistics full collection share overrides snapshot without leaking another account token',()=>{const state={ownerKey:'me',shareToken:'seen'},account={message:token=>({token})},p=page('packages/live-archive/pages/index/index.js',{}, {},{'../../services/state':state,'../../services/account':account});p.data.tab='stats';p.uiStatsShare={path:'/snapshot'};p.allShareOwner='me';p.allShareToken='all';assert.equal(p.onShareAppMessage({target:{dataset:{scope:'all'}}}).token,'all');assert.equal(p.onShareAppMessage().path,'/snapshot');state.ownerKey='other';assert.equal(p.onShareAppMessage({target:{dataset:{scope:'all'}}}).token,'');});

test('vinyl full collection share keeps the owner and never serializes search results',()=>{
  const app={globalData:{userId:'owner-A'}},p=page('pages/all-collection/index.js',app);p.data.userName='A';p.data.query='Jazz';p.data.visibleAlbums=[{id:'one'}];p.data.collectedAlbums=Array.from({length:388},(_,i)=>({id:i}));
  assert.equal(p.onShareAppMessage().path,'/pages/all-collection/index?ownerId=owner-A');
  p.data.ownerId='owner-B';assert.equal(p.onShareAppMessage().path,'/pages/all-collection/index?ownerId=owner-B');assert.equal(app.globalData.userId,'owner-A');
});

test('unavailable shared collections never fall back to the viewer private records',async()=>{
  const app={globalData:{userId:'viewer'},loadSharedCloudCollection:async()=>null},p=page('pages/all-collection/index.js',app);p.data.canManageCollection=false;let rendered;
  p.renderCollection=(albums,items)=>rendered={albums,items};p.loadLocalCollection=()=>assert.fail('must not load viewer data');p.loadSharedCloudCollection('owner');await new Promise(setImmediate);
  assert.equal(rendered.albums.length,0);assert.equal(rendered.items.length,0);assert.equal(p.data.uiSharedError,true);
});

test('shared album navigation retains the collection owner',()=>{
  let url;const p=page('pages/all-collection/index.js',{}, {navigateTo:x=>url=x.url});p.data.albumCard={id:'album-A'};p.data.ownerId='owner-B';p.openCardDetail();assert.equal(url,'/pages/album-detail/index?albumId=album-A&ownerId=owner-B');
});

test('shared album details use remote metadata and block all collection mutations',()=>{
  const app={globalData:{manualAlbums:[{id:'a',title:'Private'}],collectionItems:[{albumId:'a',quantity:99}]}},p=page('pages/album-detail/index.js',app,{navigateTo:()=>assert.fail('shared edit cannot navigate')});
  p.data.uiSharedOwnerId='owner';p.uiSharedPayload={manualAlbums:[{id:'a',title:'Shared',artist:'A',coverUrl:'https://example.test/a.jpg',tracks:[]}],collectionItems:[{albumId:'a',quantity:2}]};p.syncPreviewPlayerState=()=>{};
  p.loadAlbumDetail('a');assert.equal(p.data.album.title,'Shared');assert.equal(p.data.album.cover,'https://example.test/a.jpg');assert.equal(p.data.collectionItem.quantity,2);p.openEdit();p.addToCollection();assert.equal(app.globalData.collectionItems[0].quantity,99);
});

test('live home and full collection include all legacy statuses',()=>{
  const p=page('packages/live-archive/pages/index/index.js');p.data.records=['已看过','想看','已购票'].map((status,i)=>({id:String(i),name:status,artist:'A',city:'上海',venue:'V',date:'2026-11-01',status}));p.data.tab='collection';p.filter();assert.equal(p.data.filtered.length,3);p.data.tab='home';p.filter();assert.equal(p.data.filtered.length,3);
});

test('live collection shares the full-scope token for both button and native menu',()=>{
  const state={ownerKey:'me',shareToken:'seen'},account={message:token=>({token})};const p=page('packages/live-archive/pages/index/index.js',{}, {},{'../../services/state':state,'../../services/account':account});
  p.data.tab='collection';p.allShareOwner='me';p.allShareToken='all';assert.equal(p.onShareAppMessage().token,'all');assert.equal(p.onShareAppMessage({target:{dataset:{scope:'all'}}}).token,'all');state.ownerKey='other';assert.equal(p.onShareAppMessage().token,'');
});

test('view all live collections opens the catalogue and resets prior search filters',()=>{
  const state={records:[]},p=page('packages/live-archive/pages/index/index.js',{}, {pageScrollTo(){}},{'../../services/state':state});p.update=()=>{};p.data.query='old';p.allCollection();assert.equal(p.data.tab,'collection');assert.equal(p.data.query,'');assert.equal(Object.hasOwn(p.data,'status'),false);
});
