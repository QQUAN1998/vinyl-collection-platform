const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../apps/miniprogram');
test('portrait live geometry exposes adjacent posters on narrow and wide phones',()=>{
 const m=require(path.join(root,'ui/gallery-motion'));
 for(const width of [320,375,390,430]){const g=m.geometry(width,'live');const visible=width-(g.inset+g.pitch);assert.ok(visible>=35,`${width}: ${visible}`);assert.equal(g.inset,(width-g.card)/2);}
});
test('first-use tutorial remains visible until opened or dismissed, and storage failure is safe',()=>{
 const hint=require(path.join(root,'ui/guide-hint'));const values={};const api={getStorageSync:k=>values[k],setStorageSync:(k,v)=>values[k]=v};
 assert.equal(hint.visible(api),true);assert.equal(hint.visible(api),true);hint.complete(api);assert.equal(hint.visible(api),false);
 assert.equal(hint.visible({getStorageSync(){throw Error('storage')}}),true);assert.doesNotThrow(()=>hint.complete({setStorageSync(){throw Error('storage')}}));
});
