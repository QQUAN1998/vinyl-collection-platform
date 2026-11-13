const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const C=require('../apps/miniprogram/ui/share-covers');
test('every share destination has intentional artwork while links, tokens and titles stay intact',()=>{
 const samples=[
  ['vinyl-cabinet','川的全部唱片收藏','/pages/all-collection/index?ownerId=private-owner'],
  ['live-cabinet','川的演出集','/packages/live-archive/pages/index/index?share=opaque-token'],
  ['vinyl-stats','川的唱片统计 · 全部年份','/pages/stats/index?uiSnapshot=opaque'],
  ['live-stats','川的演出统计 · 2026','/pages/stats/index?uiSnapshot=opaque'],
  ['vinyl-timeline','川的唱片时间线 · 全部年份','/pages/stats/index?uiSnapshot=opaque'],
  ['live-timeline','川的演出时间线 · 2026','/pages/stats/index?uiSnapshot=opaque'],
  ['vinyl-album','川收藏的迁徙录','/pages/album-detail/index?albumId=a'],
  ['live-performance','某场演出','/packages/live-archive/pages/detail/detail?id=a'],
  ['tv','唱片柜电视版安装指引','/pages/tv-download/index'],
  ['guide','唱片柜操作手册','/pages/user-guide/index']
 ];
 const hashes=new Set();
 for(const [key,title,link] of samples){const message={title,path:link,custom:'keep',imageUrl:'https://example.org/old-cover.jpg'},out=C.apply(message);assert.equal(out.title,title);assert.equal(out.path,link);assert.equal(out.custom,'keep');assert.equal(message.imageUrl,'https://example.org/old-cover.jpg');assert.equal(out.imageUrl,'/assets/ui/share-cards/'+key+'.png');const png=fs.readFileSync(path.join(__dirname,'../apps/miniprogram',out.imageUrl));assert.equal(png.readUInt32BE(16),600);assert.equal(png.readUInt32BE(20),480);hashes.add(require('node:crypto').createHash('sha256').update(png).digest('hex'));}
 assert.equal(hashes.size,10);
});
test('page friend and timeline hooks use covers even while the share panel is open',async()=>{
 const file=path.resolve('apps/miniprogram/ui/locale-runtime.js'),ctx={module:{exports:{}},require:createRequire(file),wx:{getStorageSync:()=>''}};vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
 const spec=ctx.module.exports.page({data:{panel:'share'},onShareAppMessage(event){assert.equal(event.target.dataset.scope,'all');return {title:'川的演出集',path:'/packages/live-archive/pages/index/index?share=token'};},onShareTimeline(){return {title:'演出时间线',query:'uiSnapshot=opaque'};}});
 const out=spec.onShareAppMessage.call({data:spec.data},{target:{dataset:{scope:'all'}}});assert.match(out.imageUrl,/live-cabinet.png$/);assert.equal(out.path.split('?')[1],'share=token');assert.match(spec.onShareTimeline.call({data:{}}).imageUrl,/live-timeline.png$/);
 const plain=ctx.module.exports.page({data:{}});assert.equal(plain.onShareAppMessage,undefined);
 const child=C.apply({title:'唱片统计',path:'/pages/stats/index'});assert.equal(C.apply(child,{data:{uiKind:'live'}}).imageUrl,child.imageUrl);
 const deferred=C.apply({title:'演出统计',path:'/pages/stats/index',promise:Promise.resolve({title:'演出统计',path:'/pages/stats/index?x=1'})});assert.match((await deferred.promise).imageUrl,/live-stats.png$/);assert.equal((await deferred.promise).path,'/pages/stats/index?x=1');
});
