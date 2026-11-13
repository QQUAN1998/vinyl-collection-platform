const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tickets=require('../apps/miniprogram/ui/ticket-poster'),stats=require('../apps/miniprogram/ui/stats-poster'),M=require('../apps/miniprogram/ui/stats-model');
test('both ticket and statistics posters export when the device only decodes JPEG and PNG',async()=>{
 const previous=global.wx,draws=[];let exports=0;
 const gradient=()=>({addColorStop(){}}),ctx=new Proxy({drawImage:(...a)=>draws.push(a),measureText:()=>({width:0}),createLinearGradient:gradient,createRadialGradient:gradient},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={getContext:()=>ctx,requestAnimationFrame:fn=>queueMicrotask(fn),createImage:()=>({width:258,height:258,set src(src){
  this.path=src;const bytes=fs.readFileSync(path.join('apps/miniprogram',src));
  // Read actual packaged bytes: renaming a WebP file cannot pass this fixture.
  const supported=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  queueMicrotask(()=>supported?this.onload():this.onerror(Error('unsupported image codec')));
 }})};
 global.wx={getImageInfo:async({src})=>({path:src}),canvasToTempFilePath:async()=>{exports++;return{tempFilePath:'poster.png'};}};
 try{
  for(const kind of ['vinyl','live']){
   const component={data:{...M.view([],kind,{year:'全部年份'}),kind,owner:'测试',layout:M.normalizeLayout(kind)},setData(p,done){Object.assign(this.data,p);done?.();},createSelectorQuery:()=>({select(){return this},fields(){return this},exec(fn){fn([{node:canvas}]);}})};
   assert.equal(await tickets.render(component,{kind,owner:'测试',cover:'/assets/ui/brand/default-avatar.jpg',title:'收藏',artist:'',fields:[],sequence:1}),'poster.png');
   assert.deepEqual(await stats.render(component,[]),['poster.png']);
  }
  assert.equal(exports,4);assert.equal(draws.filter(a=>a[0].path===tickets.CODE).length,4);
 }finally{global.wx=previous;}
});
