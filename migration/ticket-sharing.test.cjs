const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const D=require('../apps/miniprogram/ui/ticket-data');
test('ticket sequence follows the full chronological collection and never fabricates undated numbers',()=>{
 const items=[{id:'new'},{id:'old'},{id:'missing'}],collections=[{albumId:'new',collectionDate:'2026-11-02',quantity:4},{albumId:'old',collectionDate:'2026-01-01'},{albumId:'missing',collectionDate:'2026'}];
 const card={isCollected:true,id:'new',title:'初',artist:'郑秀文',cover:'/cover',style:'粤语',mediumLabel:'黑胶',priceLabel:'¥413',collectionDateLabel:'收藏于 2026-11',conditionLabel:'NM / 4 张',notes:'private'};
 const data=D.vinyl(card,items,collections,'川');assert.equal(data.sequence,2);assert.equal(data.fields[4][1],'NM / 4 张');assert.equal(data.notes,undefined);assert.equal(D.vinyl({...card,isCollected:false},items,collections,'川'),null);assert.equal(D.vinyl({...card,id:'missing'},items,collections,'川').sequence,'');
 const records=[{id:'later',date:'2026-12-02'},{id:'earlier',date:'2026-01-01'}];const live=D.live({...records[0],name:'演唱会',expenses:[{type:'票价',currency:'CNY',minor:18000},{type:'交通',currency:'CNY',minor:3000},{type:'票价',currency:'JPY',minor:2500}]},records,'川');assert.equal(live.sequence,2);assert.equal(live.fields[3][1],'¥180 · JPY 2,500');
});
test('both owner previews expose ticket share while shared live data cannot open the composer',()=>{
 for(const rel of ['pages/cabinet/index','packages/live-archive/pages/index/index']){
  const file=path.resolve('apps/miniprogram',rel+'.js');let spec;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:s=>spec=s,require:createRequire(file),wx:{},Date});const self={data:{shared:rel.startsWith('packages/'),uiPreviewRecord:{id:'a'},uiSeenRecords:[]},setData(v){Object.assign(this.data,v);}};
  if(self.data.shared){spec.uiTicketShare.call(self);assert.equal(self.data.uiTicket,undefined);}
  const markup=fs.readFileSync(path.resolve('apps/miniprogram',rel+'.wxml'),'utf8');assert.match(markup,/bindtap="uiTicketShare"/);assert.match(markup,/ticket-share wx:if="\{\{uiTicket\}\}"/);
 }
});
test('failed artwork and code loads do not produce an incomplete poster',async()=>{
 const {render}=require('../apps/miniprogram/ui/ticket-poster');const original=global.wx;global.wx={getImageInfo:async()=>{throw Error('offline');}};
 const component={createSelectorQuery:()=>({select(){return this},fields(){return this},exec(fn){fn([{node:{}}]);}})};
 try{await assert.rejects(render(component,{cover:'/cover'}),/小程序码加载失败|封面加载失败/);}finally{global.wx=original;}
});
test('a metadata failure still decodes WebP artwork accepted by Canvas',async()=>{
 const {load}=require('../apps/miniprogram/ui/ticket-poster'),original=global.wx,attempts=[];
 global.wx={getImageInfo:({fail})=>{queueMicrotask(()=>fail({errMsg:'getImageInfo:fail file not found'}));}};
 const canvas={createImage(){return {set src(value){attempts.push(value);queueMicrotask(()=>this.onload());}};}};
 try{assert.ok(await load(canvas,'/assets/covers/album.webp'));assert.deepEqual(attempts,['/assets/covers/album.webp']);}finally{global.wx=original;}
});
test('callback-only metadata preserves package root and retries the original source after decode failure',async()=>{
 const {load}=require('../apps/miniprogram/ui/ticket-poster'),original=global.wx,attempts=[];
 global.wx={getImageInfo:({success})=>{queueMicrotask(()=>success({path:'stale.jpg'}));}};
 const canvas={createImage(){return {set src(value){attempts.push(value);queueMicrotask(()=>value==='/stale.jpg'?this.onerror():this.onload());}};}};
 try{assert.ok(await load(canvas,'/assets/cover.jpg'));assert.deepEqual(attempts,['/stale.jpg','/assets/cover.jpg']);}finally{global.wx=original;}
});
test('unavailable artwork is rejected after both metadata and decoding fail',async()=>{
 const {load}=require('../apps/miniprogram/ui/ticket-poster'),original=global.wx;
 global.wx={getImageInfo:({fail})=>queueMicrotask(()=>fail({errMsg:'unavailable'}))};
 const canvas={createImage(){return {set src(value){queueMicrotask(()=>this.onerror());}};}};
 try{await assert.rejects(load(canvas,'/missing.webp'),/图片加载失败/);}finally{global.wx=original;}
});
