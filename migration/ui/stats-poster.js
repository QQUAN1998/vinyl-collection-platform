// Native Canvas 2D export of the same statistics model and selected module order.
const M=require('./stats-model');
const {load,CODE}=require('./ticket-poster');
async function render(component, selected){
 const node=await new Promise(resolve=>component.createSelectorQuery().select('#statsPoster').fields({node:true}).exec(rows=>resolve(rows[0]?.node)));
 if(!node)throw Error('画布暂不可用，请重试');
 const data=component.data,blocks=[],images=new Map(),W=390,PAGE=6000,codeSrc=CODE;
 const add=(height,draw)=>blocks.push({height,draw});
 const bg='#f5f6f2',ink='#171a17',muted='#687063',lime='#d1ff66',line='#e3e7de';
 let ctx;
 function text(value,x,y,size=12,color=ink,weight=400,align='left'){ctx.fillStyle=color;ctx.font=(weight>=600?'bold':'normal')+' '+size+'px sans-serif';ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(String(value??''),x,y);}
 function round(x,y,w,h,r=18,color='#fff'){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();}
 function trunc(value,width,size=12){ctx.font='bold '+size+'px sans-serif';let str=String(value||'');while(str&&ctx.measureText(str).width>width)str=str.slice(0,-1);return str===String(value||'')?str:str.slice(0,-1)+'…';}
 function image(src,x,y,w,h){const img=images.get(src);if(!img)return round(x,y,w,h,12,'#eef1e9');ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);ctx.restore();}
 function fit(value,width,size=24,weight=600){ctx.font=(weight>=600?'bold':'normal')+' '+size+'px sans-serif';return Math.min(size,size*width/Math.max(1,ctx.measureText(String(value)).width));}
 function costRows(rows,y){rows.forEach((r,i)=>{text(r.currency,40,y+i*34+9,10,'#c5c9c2');text(r.exact,350,y+i*34,fit(r.exact,240), '#fff',600,'right');});}
 // The exported poster has a fixed light palette, independent of the screen theme.
 function ringColor(color){return color;}
 function ring(rows,total,y,label){let angle=-Math.PI/2;ctx.lineWidth=22;rows.forEach(r=>{const end=angle+r.count/(total||1)*2*Math.PI;ctx.beginPath();ctx.arc(195,y+118,52,angle,end);ctx.strokeStyle=ringColor(r.color);ctx.stroke();angle=end;});if(!total){ctx.beginPath();ctx.arc(195,y+118,52,0,Math.PI*2);ctx.strokeStyle='#eeeeee';ctx.stroke();}text(total,195,y+98,28,ink,650,'center');text(label,195,y+132,9,muted,400,'center');}
 const owner=data.owner||'音乐收藏者',timelineOnly=selected.length===1&&selected[0]==='timeline';
 add(112,y=>{
  const avatar=data.avatar;
  if(avatar&&images.has(avatar)){ctx.save();ctx.beginPath();ctx.arc(46,y+32,22,0,Math.PI*2);ctx.clip();image(avatar,24,y+10,44,44);ctx.restore();}
  else{round(24,y+10,44,44,22,lime);text(Array.from(owner)[0],46,y+20,20,ink,700,'center');}
  text(trunc(owner,198,15),80,y+13,15,ink,700);
  text((data.kind==='live'?'演出集':'唱片柜')+' · '+(timelineOnly?data.timelineYear:data.year),80,y+36,10,muted);
  text(timelineOnly?'收藏时间线':data.kind==='live'?'现场统计':'收藏统计',24,y+77,17,ink,700);
  round(298,y+4,68,68,10,'#fff');ctx.drawImage(images.get(codeSrc),302,y+8,60,60);
  text('扫码打开小程序',332,y+80,7,muted,400,'center');
 });
 if(selected.includes('costs'))add(68+data.totals.length*34,y=>{round(20,y,350,54+data.totals.length*34,16,ink);text('花费',40,y+17,12,'#fff');costRows(data.totals,y+44);});
 if(selected.includes('overview'))add(112,y=>{data.metrics.forEach((r,i)=>{const x=20+i*120;round(x,y,110,98,16,i===0?lime:'#fff');text(r.label,x+14,y+17,10,muted);const value=String(r.value),unit=String(r.unit||''),size=fit(value,66,24),numWidth=(()=>{ctx.font='bold '+size+'px sans-serif';return ctx.measureText(value).width;})();text(value,x+14,y+45,size,ink,650);text(unit,x+14+numWidth+5,y+45+size-12,9,muted);});});
 data.layout.filter(r=>r.visible&&selected.includes(r.id)).forEach(module=>{
  if(module.id==='calendar')add(318,y=>{round(20,y,350,304);text(module.label,40,y+22,15,ink,700);text(data.year,350,y+26,11,muted,400,'right');data.months.forEach((r,i)=>{const x=40+(i%4)*79,top=y+58+Math.floor(i/4)*78;round(x,top,73,68,12,['#eef1e9','#edf3e3','#e1f4bb',lime,'#b9ee45'][r.tone]);text(r.label,x+9,top+10,9,muted,550);text(r.count+(data.kind==='live'?' 场':' 张'),x+9,top+32,fit(r.count+(data.kind==='live'?' 场':' 张'),55,16),ink,650);});});
  if(module.id==='genres')add(220+data.genres.length*36,y=>{round(20,y,350,206+data.genres.length*36);text('曲风排行',40,y+22,15,ink,700);text(data.genres.length+' 种',350,y+26,11,muted,400,'right');ring(data.genres,data.genreTotal,y,'曲风');data.genres.forEach((r,i)=>{round(40,y+204+i*36,8,8,4,ringColor(r.color));text(trunc(r.name,165),58,y+200+i*36,12);text(r.count+' 张  '+r.percent+'%',350,y+200+i*36,12,muted,400,'right');});});
  if(module.id==='format')add(220+data.formats.length*36,y=>{round(20,y,350,206+data.formats.length*36);text('收藏形式',40,y+22,15,ink,700);text(data.units+' 件',350,y+26,11,muted,400,'right');ring(data.formats,data.units,y,'收藏');data.formats.forEach((r,i)=>{round(40,y+204+i*36,8,8,4,ringColor(r.color));text(r.name,58,y+200+i*36,12);text(r.count+' 件  '+r.percent+'%',350,y+200+i*36,12,muted,400,'right');});});
  if(module.id==='artists')add(76+Math.max(1,data.ranks.length)*60,y=>{round(20,y,350,62+Math.max(1,data.ranks.length)*60);text('艺人排行',40,y+22,15,ink,700);text(data.rankMetric==='amount'?'花费 · '+data.currency:data.kind==='live'?'场次':'数量',350,y+26,10,muted,400,'right');data.ranks.forEach((r,i)=>{let top=y+56+i*60;text(r.rank,40,top+12,11,muted);image(r.cover,67,top,36,36);text(trunc(r.name,138),115,top+1,12,ink,650);round(115,top+28,130,3,1,'#eef1e9');round(115,top+28,Math.max(1,1.3*r.bar),3,1,lime);text(data.rankMetric==='amount'?r.currency+' '+r.exact:r.value,350,top+13,11,ink,600,'right');});if(!data.ranks.length)text('暂无记录',195,y+89,12,muted,400,'center');});
  if(module.id==='cities'){
   add(204,y=>{round(20,y,350,204);text('城市足迹',40,y+22,15,ink,700);text(data.cities.length+' 座',350,y+26,11,muted,400,'right');ring(data.cities,data.cities.reduce((sum,row)=>sum+row.count,0),y,'现场');round(20,y+180,350,24,0);});
   data.cities.forEach((r,i)=>add(66,y=>{round(20,y-1,350,68,i===data.cities.length-1?18:0);round(20,y-1,350,20,0);round(40,y,310,54,18,'#eef1e9');round(53,y+24,8,8,4,ringColor(r.color));text(r.name,72,y+18,16,ink,650);text(r.count+' 场',334,y+17,18,ink,650,'right');}));
   if(!data.cities.length)add(74,y=>{round(20,y,350,58);text('暂无城市足迹',195,y+20,12,muted,400,'center');});
   add(16,()=>{});
  }
  if(module.id==='timeline'){
   add(66,y=>{round(20,y,350,66);text('时间线',40,y+22,15,ink,700);text(data.timelineYear,350,y+26,11,muted,400,'right');round(20,y+44,350,22,0);});
   if(!data.timeline.length)add(90,y=>{round(20,y,350,74);text('这一年还没有记录',195,y+27,12,muted,400,'center');});
   data.timeline.forEach((r,i)=>add(90,y=>{round(20,y-1,350,92,i===data.timeline.length-1?18:0);round(20,y-1,350,20,0);ctx.strokeStyle=line;ctx.beginPath();ctx.lineWidth=1;ctx.moveTo(44.5,y+(i===0?44.5:0));ctx.lineTo(44.5,y+(i===data.timeline.length-1?44.5:90));ctx.stroke();round(40,y+40,9,9,4.5,lime);image(r.cover,60,y+13,48,data.kind==='live'?64:48);text(r.date||'日期待补',120,y+13,10,muted);text(trunc(r.title,219),120,y+30,12,ink,650);text(trunc(data.kind==='live'?r.city+' · '+r.venue:r.artist,219,10),120,y+49,10,muted);if(r.sequence)text('人生第 '+r.sequence+(data.kind==='live'?' 场演出':' 张唱片'),120,y+65,9,ink); }));
   add(16,()=>{});
  }
 });
 const needed=[...new Set([codeSrc,data.avatar,...[...(selected.includes("artists")?data.ranks:[]),...(selected.includes("timeline")?data.timeline:[])].map(r=>r.cover).filter(Boolean)])].filter(Boolean);
 for(const src of needed){try{
  images.set(src,await load(node,src));
 }catch(e){if(src===codeSrc)throw Error('小程序码加载失败，请重试');/* A failed image keeps a neutral tile; stats and remaining images still export. */}}
 const pages=[[]];let height=20;for(const b of blocks){if(height+b.height>PAGE-40&&pages[pages.length-1].length){pages.push([]);height=20;}pages[pages.length-1].push(b);height+=b.height;}
 const urls=[];for(let i=0;i<pages.length;i++){const h=pages[i].reduce((s,b)=>s+b.height,40);node.width=W*2;node.height=h*2;ctx=node.getContext('2d');ctx.scale(2,2);ctx.fillStyle=bg;ctx.fillRect(0,0,W,h);let y=20;pages[i].forEach(b=>{b.draw(y);y+=b.height;});if(pages.length>1)text((i+1)+' / '+pages.length,370,h-18,9,muted,400,'right');if(typeof node.requestAnimationFrame==='function')await new Promise(resolve=>node.requestAnimationFrame(()=>node.requestAnimationFrame(resolve)));const file=await wx.canvasToTempFilePath({canvas:node,fileType:'png',destWidth:W*2,destHeight:h*2});urls.push(file.tempFilePath);}
 return urls;
}
module.exports={render};
