// Portable read-only statistical snapshot. Never serializes tickets, photos, notes or credentials.
const pako = require('./vendor/pako');
const M = require('./stats-model');
const ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encode64(bytes){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);out+=ABC[n>>>18]+ABC[(n>>>12)&63]+(i+1<bytes.length?ABC[(n>>>6)&63]:'')+(i+2<bytes.length?ABC[n&63]:'');}return out;}
function decode64(text){if(!/^[A-Za-z0-9_-]+$/.test(text)||text.length>200000)throw Error('统计快照格式无效');const out=[];let bits=0,value=0;for(const c of text){value=(value<<6)|ABC.indexOf(c);bits+=6;if(bits>=8){bits-=8;out.push((value>>>bits)&255);}}return new Uint8Array(out);}
function clean(data){if(!data||data.v!==1||!['vinyl','live'].includes(data.kind)||!Array.isArray(data.records)||data.records.length>2000)throw Error('统计快照格式无效');const text=(v,n=200)=>String(v||'').slice(0,n),date=v=>/^\d{4}(-\d{2})?(-\d{2})?$/.test(v)?v:'',year=v=>/^(全部年份|\d{4})$/.test(v)?v:'全部年份';return {v:1,kind:data.kind,owner:text(data.owner,64),...(data.source?{source:sourceOf(data)}:{}),avatar:/^(https:\/\/|cloud:\/\/|\/assets\/)/.test(data.avatar||'')?text(data.avatar,2048):'',mediaShare:/^[a-f0-9]{48}$/.test(data.mediaShare||'')?data.mediaShare:'',year:year(data.year),timelineYear:year(data.timelineYear),rankMetric:data.rankMetric==='amount'?'amount':'count',currency:/^[A-Z]{3}$/.test(data.currency||'')?data.currency:'CNY',layout:M.normalizeLayout(data.kind,data.layout),records:data.records.map(r=>({id:text(r.id,100),title:text(r.title),artist:text(r.artist),date:date(r.date),city:text(r.city),venue:text(r.venue),cover:/^(https:\/\/|cloud:\/\/|\/assets\/)/.test(r.cover)?text(r.cover,2048):'',quantity:Math.min(100000,Math.max(1,Math.floor(Number(r.quantity)||1))),genre:text(r.genre,80),medium:text(r.medium,32),tracks:Math.min(1000,Math.max(0,Math.floor(Number(r.tracks)||0))),expenses:(Array.isArray(r.expenses)?r.expenses:[]).slice(0,100).filter(e=>/^[A-Z]{3}$/.test(e.currency)&&Number.isSafeInteger(e.minor)&&e.minor>=0).map(e=>({currency:e.currency,minor:e.minor,type:text(e.type,16)}))}))};}
function encode(data){return encode64(pako.deflate(JSON.stringify(clean(data))));}
function decode(raw){const inf=new pako.Inflate({to:'string'});let size=0,chunks=[];inf.onData=chunk=>{size+=chunk.length;if(size>2000000)throw Error('统计快照过大');chunks.push(chunk);};inf.push(decode64(raw),true);if(inf.err)throw Error('统计快照无法读取');return clean(JSON.parse(chunks.join('')));}
// A small route budget is intentional: collection size must never determine
// whether the native WeChat card can be sent. Existing inline links still read.
const PATH_BUDGET=1024;
function sourceOf(data){
  if(!data.source)return null;
  if(data.kind==='vinyl'&&typeof data.source.ownerId==='string'&&data.source.ownerId.length<=191&&data.source.ownerId.trim()&&!/[\x00-\x1f]/.test(data.source.ownerId))return {ownerId:data.source.ownerId};
  if(data.kind==='live'&&/^[a-f0-9]{48}$/.test(data.source.token||''))return {token:data.source.token};
  throw Error('分享来源无效，请重新打开统计页');
}
function message(data){
  const source=sourceOf(data),snap=clean(source?{...data,records:[],avatar:''}:data);
  const payload=encode(snap),path='/pages/stats/index?'+(source?'uiRef=':'uiSnapshot=')+payload;
  if(path.length>PATH_BUDGET)throw Error('请先登录并同步收藏，再分享统计页面');
  return {title:(snap.owner||'音乐收藏者')+'的'+(snap.kind==='live'?'演出':'唱片')+'统计 · '+snap.year,path};
}
async function readReference(raw,readers={}){
  const snap=decode(raw),source=sourceOf(snap);
  if(!source||snap.records.length)throw Error('分享链接无效');
  let records;
  if(snap.kind==='vinyl'){
    const load=readers.vinyl|| (async ownerId=>{
      const api=require('../services/cloud-api');
      return api.normalizeCloudCollectionPayload(await api.fetchSharedCloudCollection(ownerId),require('../data/seed').albums);
    });
    const result=await load(source.ownerId);
    if(!result||!Array.isArray(result.collectionItems)||!Array.isArray(result.manualAlbums))throw Error('分享暂不可用，请稍后重试');
    records=M.vinylRecords([...(readers.albums||require('../data/seed').albums),...result.manualAlbums],result.collectionItems);
  }else{
    const result=await (readers.live||require('./stats-share-media').readShared)(source.token);
    if(!result||!Array.isArray(result.records))throw Error('分享暂不可用，请稍后重试');
    records=M.liveRecords(result.records);
  }
  return clean({...snap,records});
}
module.exports={clean,encode,decode,message,readReference,PATH_BUDGET};
