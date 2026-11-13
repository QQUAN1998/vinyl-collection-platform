const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('entrance is absent from every page and no animation component is shipped',()=>{
 const root='apps/miniprogram',app=JSON.parse(fs.readFileSync(root+'/app.json','utf8'));const pages=[...app.pages,...(app.subPackages||app.subpackages||[]).flatMap(p=>p.pages.map(x=>p.root+'/'+x))];
 for(const page of pages){assert.doesNotMatch(fs.readFileSync(root+'/'+page+'.wxml','utf8'),/<brand-entry/);assert.equal(JSON.parse(fs.readFileSync(root+'/'+page+'.json','utf8')).usingComponents?.['brand-entry'],undefined);}
 assert.equal(fs.existsSync(root+'/components/brand-entry/index.js'),false);assert.equal(fs.existsSync(root+'/assets/ui/brand/entry-logo.png'),false);
});
test('summary uses total quantities and retains distinct counts without mutating records',()=>{
 const {buildDeck}=require('../apps/miniprogram/ui/deck-model'),items=[{id:'a',title:'A'},{id:'b',title:'B'}],copies=[{albumId:'a',quantity:3},{albumId:'b',quantity:1}],before=JSON.stringify(copies);
 const v=buildDeck(items,copies,'vinyl','time',false,true);assert.equal(v.totalQuantity,4);assert.equal(v.uniqueCount,2);assert.equal(JSON.stringify(copies),before);
 const live=buildDeck(items,[],'live','time',false,true);assert.equal(live.totalQuantity,2);assert.equal(live.uniqueCount,2);
});
