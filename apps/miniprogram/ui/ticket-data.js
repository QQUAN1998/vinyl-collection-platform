// Only the fields the owner chose to share; no notes, account IDs or cloud writes.
const {buildDeck,expenses}=require('./deck-model');
function ordinal(id,items,collections,kind){
 return buildDeck(items,collections,kind,'date',true,false).cards.find(r=>r.id===id)?.sequence||'';
}
function vinyl(card,items,collections,owner,avatar=''){
 if(!card?.isCollected)return null;
 const album=(items||[]).find(item=>item.id===card.id)||card;
 const releaseDate=require('./release-date').value(album);
 return {kind:'vinyl',owner:owner||'音乐收藏者',avatar:typeof avatar==='string'?avatar:'',sequence:ordinal(card.id,items,collections,'vinyl'),cover:card.cover||'',title:card.title||'未命名唱片',artist:card.artist||'',fields:[
  ['曲风 / 语言',card.style||card.region||'未填写'],['收藏形式',card.mediumLabel||'未填写'],
  ['收藏价格',card.priceLabel||'未填写'],['收藏时间',(card.collectionDateLabel||'未填写').replace(/^收藏于\s*/, '')],
  ['品相 / 数量',card.conditionLabel||'未填写'],['发行日期',releaseDate?String(releaseDate):'未填写']
 ]};
}
function live(record,items,owner,avatar=''){
 if(!record)return null;
 const price=expenses(record.expenses,true).map(r=>(r.currency==='CNY'?'¥':r.currency+' ')+r.value.toLocaleString('zh-CN',{maximumFractionDigits:2})).join(' · ');
 return {kind:'live',owner:owner||'音乐收藏者',avatar:typeof avatar==='string'?avatar:'',sequence:ordinal(record.id,items,[],'live'),cover:record.cover||record.posterUrl||'',title:record.name||record.title||'未命名现场',artist:record.artist||'',fields:[
  ['观看日期',record.date||'未填写'],['城市',record.city||'未填写'],
  ['演出类型',record.type||'未填写'],['票价',price||'未填写'],
  ['演出场馆',record.venue||'未填写']
 ]};
}
module.exports={vinyl,live};
