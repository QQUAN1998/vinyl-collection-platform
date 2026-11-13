const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {render}=require('../apps/miniprogram/ui/stats-poster'),M=require('../apps/miniprogram/ui/stats-model');
function fixture(kind){
 const draws=[],ctx=new Proxy({drawImage:(...args)=>draws.push(args),measureText:()=>({width:0})},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={getContext:()=>ctx,createImage:()=>({set src(value){this.path=value;this.onload();}})};
 const data={...M.view([],kind,{year:'全部年份'}),kind,owner:'测试',layout:M.normalizeLayout(kind)};
 return {draws,component:{data,createSelectorQuery:()=>({select(){return this},fields(){return this},exec(fn){fn([{node:canvas}]);}})}};
}
test('native canvas receives an absolute path when getImageInfo strips the package root',async()=>{
 const previous=global.wx;
 global.wx={getImageInfo:async()=>({path:'assets/ui/miniprogram-code.jpg'}),canvasToTempFilePath:async()=>({tempFilePath:'poster.png'})};
 try{for(const kind of ['vinyl','live']){const f=fixture(kind);f.component.createSelectorQuery=()=>({select(){return this},fields(){return this},exec(fn){fn([{node:{getContext:()=>new Proxy({measureText:()=>({width:0})},{get:(o,k)=>o[k]||(()=>{})}),createImage:()=>({set src(value){if(value.startsWith('/'))this.onload();else this.onerror(Error('relative package path'));}})}}]);}});assert.deepEqual(await render(f.component,[]),['poster.png']);}}finally{global.wx=previous;}
});
test('both poster spaces embed the supplied complete code without a crop',async()=>{
 const previous=global.wx;
 global.wx={getImageInfo:async({src})=>({path:src}),canvasToTempFilePath:async()=>({tempFilePath:'poster.png'})};
 try{for(const kind of ['vinyl','live']){const f=fixture(kind);assert.deepEqual(await render(f.component,[]),['poster.png']);const code=f.draws.filter(args=>args[0].path==='/assets/ui/miniprogram-code.jpg');assert.equal(code.length,1);assert.ok(f.draws.some(args=>args[0].path==='/assets/ui/brand/default-avatar.jpg'));const [x,y,w,h]=code[0].slice(1);assert.equal(w,h);assert.ok(w>=60);assert.ok(x>=20&&x+w<=370&&y>=20);}}
 finally{global.wx=previous;}
 assert.deepEqual(fs.readFileSync('apps/miniprogram/assets/ui/miniprogram-code.jpg'),fs.readFileSync('migration/ui/miniprogram-code-device.jpg'));
});
test('a missing mini-program code stops export instead of creating a misleading poster',async()=>{
 const previous=global.wx;let exports=0;
 global.wx={getImageInfo:async()=>{throw Error('missing');},canvasToTempFilePath:async()=>{exports++;}};
 try{const f=fixture('vinyl');f.component.createSelectorQuery=()=>({select(){return this},fields(){return this},exec(fn){fn([{node:{createImage:()=>({set src(value){this.onerror();}})}}]);}});await assert.rejects(render(f.component,[]),/小程序码加载失败/);assert.equal(exports,0);}
 finally{global.wx=previous;}
});
test('both poster spaces load the real avatar without allowing its failure to block export',async()=>{
 const previous=global.wx,avatar='https://example.test/avatar.jpg',loaded=[];
 global.wx={getImageInfo:async({src})=>{loaded.push(src);return {path:src};},canvasToTempFilePath:async()=>({tempFilePath:'poster.png'})};
 try{for(const kind of ['vinyl','live']){const f=fixture(kind);f.component.data.avatar=avatar;await render(f.component,[]);assert.ok(f.draws.some(args=>args[0].path===avatar));}
 global.wx.getImageInfo=async({src})=>{if(src===avatar)throw Error('expired avatar');return {path:src};};const f=fixture('vinyl');f.component.data.avatar=avatar;assert.deepEqual(await render(f.component,[]),['poster.png']);}finally{global.wx=previous;}
});
