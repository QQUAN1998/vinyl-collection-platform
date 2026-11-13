// Frontend statistics, derived from existing records. No network or persistence.
const { getCollectionQuantity, getCollectionAmount } = require('../services/stats-service');
const { getMediaFormat } = require('../services/media-format-service');
const artistExpenses = require('./artist-expenses');
const { toAlbumImageSrc } = require('../services/album-library-service');
const PALETTE = ['#242424','#707070','#a3a3a3','#c7c7c7','#e2e2e2'];
const ACCENT_PALETTE = ['#242424','#d1ff66'];
const MODULES = { vinyl: [['calendar','收藏日历'],['format','收藏形式'],['artists','艺人排行'],['genres','曲风排行'],['timeline','时间线']], live: [['calendar','现场日历'],['artists','艺人排行'],['cities','城市足迹'],['timeline','时间线']] };
function exact(n) { return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function compact(n) { return Math.abs(n) < 1e6 ? exact(n) : exact(n/1e4)+'W'; }
function normalizeLayout(kind, input) {
  const allowed=MODULES[kind] || MODULES.vinyl, out=[];
  (Array.isArray(input)?input:[]).forEach(row=>{ if(row && allowed.some(([id])=>id===row.id) && !out.some(x=>x.id===row.id)) out.push({ id:row.id, visible:row.visible!==false }); });
  allowed.forEach(([id])=>{if(!out.some(row=>row.id===id))out.push({id,visible:true});});
  return out.map(row=>({...row,label:allowed.find(([id])=>id===row.id)[1]}));
}
function vinylRecords(albums, items) {
  const map=new Map(albums.map(row=>[row.id,row]));
  return items.map(item=>{ const a=map.get(item.albumId); if(!a)return null; return { id:a.id, title:a.title, artist:a.artist || '未知艺人', date:item.collectionDate || '', cover:toAlbumImageSrc(a), quantity:getCollectionQuantity(item), genre:a.style||a.genre||'未分类', medium:getMediaFormat(item.mediumKey).label, tracks:Array.isArray(a.tracks)?a.tracks.length:0, expenses:[{currency:'CNY',minor:Math.round(getCollectionAmount(item)*100),type:'唱片'}] }; }).filter(Boolean);
}
function liveRecords(records) {
  return records.filter(Boolean).map(row=>({ id:row.id,title:row.name,artist:row.artist||'未填写',date:row.date||'',cover:row.cover||row.posterUrl||'',city:row.city||'',venue:row.venue||'',quantity:1,expenses:(row.expenses||[]).filter(e=>Number.isSafeInteger(e.minor)&&e.minor>=0).map(e=>({type:e.type,currency:e.currency,minor:e.minor})) }));
}
function costs(records) {
  const totals={};records.forEach(row=>(row.expenses||[]).forEach(e=>{if(/^[A-Z]{3}$/.test(e.currency)&&Number.isSafeInteger(e.minor)&&e.minor>=0) totals[e.currency]=(totals[e.currency]||0)+e.minor;}));
  if(!Object.keys(totals).length)totals.CNY=0;
  return Object.keys(totals).sort((a,b)=>a===b?0:a==='CNY'?-1:b==='CNY'?1:a.localeCompare(b)).map(currency=>{const value=totals[currency]/(['JPY','KRW'].includes(currency)?1:100);return {currency,value,exact:exact(value),display:compact(value)};});
}
function within(row,year) {return year==='全部年份'||row.date.startsWith(year);}
function names(row,kind) { return kind==='live'?[...new Set(row.artist.split(/[/／、]/).map(s=>s.trim()).filter(Boolean))]:[row.artist]; }
function timelineRows(rows, allRows=rows) {
  const sequence=new Map(allRows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map((r,i)=>[r.id,i+1]));
  return rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).map(r=>({...r,sequence:sequence.get(r.id)||''}));
}
function view(records, kind, options={}) {
  const year=options.year || '全部年份', timelineYear=options.timelineYear||'全部年份';
  const list=records.filter(r=>within(r,year));
  const years=['全部年份',...[...new Set([...records.map(r=>r.date.slice(0,4)),String(new Date().getFullYear()),year].filter(y=>/^\d{4}$/.test(y)))].sort().reverse()];
  const ranks=new Map(),cityMap=new Map(),formats=new Map(); let units=0;
  list.forEach(row=>{names(row,kind).forEach(name=>{const r=ranks.get(name)||{name,count:0,minor:0,cover:row.cover};r.count+=row.quantity;r.minor+=(row.expenses||[]).filter(e=>e.currency==='CNY').reduce((s,e)=>s+e.minor,0);ranks.set(name,r);});if(row.city)cityMap.set(row.city,(cityMap.get(row.city)||0)+1); if(kind==='vinyl'){formats.set(row.medium,(formats.get(row.medium)||0)+row.quantity);units+=row.quantity;} });
  const currencies=costs(list).map(r=>r.currency),currency=currencies.includes(options.currency)?options.currency:currencies[0], rankMetric=options.rankMetric || 'count'; let rankRows;
  if(kind==='live'&&rankMetric==='amount') {
    const split=artistExpenses(list.map(r=>({...r,status:'已看过',artist:names(r,kind).join('/')})), '');
    rankRows=(split[currency]||[]).map(r=>({...r,cover:list.find(x=>names(x,kind).includes(r.name))?.cover||''}));
  } else rankRows=[...ranks.values()].sort((a,b)=>rankMetric==='amount'?b.minor-a.minor||a.name.localeCompare(b.name):b.count-a.count||a.name.localeCompare(b.name));
  const max=rankRows[0]?.[rankMetric==='amount'?'minor':'count']||1;
  rankRows=rankRows.slice(0,5).map((row,i)=>{const amount=row.minor/(['JPY','KRW'].includes(currency)?1:100);return {...row,rank:String(i+1).padStart(2,'0'),initial:Array.from(row.name)[0],bar:Math.max(0,Math.min(100,row[rankMetric==='amount'?'minor':'count']/max*100)),value:rankMetric==='amount'?compact(amount):row.count+(kind==='live'?' 场':' 张'),currency:rankMetric==='amount'?currency:'',exact:exact(amount)};});
  const genreMap=new Map();list.forEach(row=>{const name=row.genre||'未分类';genreMap.set(name,(genreMap.get(name)||0)+row.quantity);});
  const genreTotal=[...genreMap.values()].reduce((sum,count)=>sum+count,0);
  const genreMax=Math.max(1,...genreMap.values()),genres=[...genreMap].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count],i)=>({name,count,rank:String(i+1).padStart(2,'0'),bar:count/genreMax*100,percent:Math.round(count/(genreTotal||1)*100),color:ACCENT_PALETTE[i%ACCENT_PALETTE.length],accent:i%ACCENT_PALETTE.length===1}));
  const months=Array.from({length:12},(_,i)=>{const entries=list.filter(r=>Number(r.date.slice(5,7))===i+1),count=entries.reduce((s,r)=>s+r.quantity,0),money=costs(entries);return {month:i+1,label:String(i+1).padStart(2,'0')+' 月',count,tone:count===0?0:count<=2?1:count<=5?2:count<=9?3:4,money:money[0],more:money.length-1,entries};});
  const timeline=timelineRows(records.filter(r=>within(r,timelineYear)),records);
  return { genres,genreTotal,year,years,yearIndex:years.indexOf(year),timelineYear,timelineYears:years,timelineYearIndex:years.indexOf(timelineYear),timeline,months,totals:costs(list),ranks:rankRows,currencies:costs(list).map(r=>r.currency),currency,rankMetric,formats:[...formats].map(([name,count],i)=>({name,count,percent:Math.round(count/(units||1)*100),color:PALETTE[i%PALETTE.length]})),units,cities:[...cityMap].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).map((row,i)=>({...row,color:ACCENT_PALETTE[i%ACCENT_PALETTE.length],percent:Math.round(row.count/(list.length||1)*100)})),metrics:[{label:kind==='live'?'已看现场':'唱片收藏',value:list.reduce((sum,row)=>sum+row.quantity,0),unit:kind==='live'?'场':'张',icon:kind==='live'?'ticket':'disc'},{label:kind==='live'?'现场艺人':'收藏艺人',value:ranks.size,unit:'位',icon:'people'},{label:kind==='live'?'走过城市':'曲目总数',value:kind==='live'?cityMap.size:list.reduce((s,r)=>s+r.tracks,0),unit:kind==='live'?'座':'首',icon:kind==='live'?'location':'music'}],list };
}
module.exports={MODULES,PALETTE,ACCENT_PALETTE,normalizeLayout,timelineRows,vinylRecords,liveRecords,costs,view,compact,exact};
