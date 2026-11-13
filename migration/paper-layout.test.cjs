const test=require('node:test'),assert=require('node:assert/strict'),P=require('../apps/miniprogram/ui/ticket-poster');
const ctx={font:'',measureText(s){const size=Number(this.font.match(/([\d.]+)px/)?.[1]||12);return {width:Array.from(s).reduce((n,c)=>n+(/[^\x00-\xff]/.test(c)?size:size*.55),0)};}};
test('mixed titles keep English words whole and split only overlong tokens',()=>{
 const lines=P.wrap(ctx,'中文标题 Long Album Name',90,12,true);assert.ok(lines.includes('Long Album')||lines.some(s=>s.includes('Long')));assert.ok(!lines.some(s=>/Lon$|^g /.test(s)));
 const word='SUPERCALIFRAGILISTICEXPIALIDOCIOUS',wrapped=P.wrap(ctx,word,60,12,true);assert.equal(wrapped.join(''),word);assert.ok(wrapped.every(s=>ctx.measureText(s).width<=60));
});

test('sequence sits between the artist and uncropped artwork in both ticket kinds',()=>{
 for(const kind of ['vinyl','live'])for(const sequence of [1,12345,'']){
  const l=P.layout(ctx,{kind,title:'很长的收藏名称'.repeat(8),artist:'音乐人'.repeat(10),sequence,fields:[]},{width:kind==='live'?1020:1000,height:kind==='live'?1360:1000});
  assert.ok(l.sequenceTop>=l.artistTop+l.artists.length*17);assert.ok(l.artTop>=l.sequenceTop+(sequence?40:0));assert.ok(l.fieldsTop>l.artTop+l.artH);
 }
});
test('long owner has bounded lines and ellipsis while artwork and venue reserve their own space',()=>{
 const ticket={kind:'live',title:'很长的演出名称'.repeat(10),artist:'艺人',owner:'DAVID LAU 的音乐收藏室'.repeat(8),sequence:12345,fields:[['日期','2026-11-02'],['城市','广州'],['场馆','广东省奥林匹克体育中心体育场'.repeat(4)]]},before=JSON.stringify(ticket);
 const l=P.layout(ctx,ticket,{width:1020,height:1360});assert.equal(l.artW/l.artH,3/4);assert.equal(l.owners.length,2);assert.ok(l.owners[1].endsWith('…'));ctx.font='bold 15px sans-serif';assert.ok(l.owners.every(s=>ctx.measureText(s).width<=176));assert.ok(l.rows[1].full);assert.ok(l.rows[1].fields[0].lines.length>1);assert.ok(l.fieldsTop>l.artTop+l.artH);assert.equal(JSON.stringify(ticket),before);
});
