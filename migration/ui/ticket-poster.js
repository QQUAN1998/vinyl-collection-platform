// Smooth tickets on a kraft-paper backdrop. Artwork and codes retain their original pixels.
const CODE='/assets/ui/miniprogram-code.jpg';
const LOGO='/assets/ui/brand/ticket-logo.png',MASCOT='/assets/ui/brand/default-avatar.jpg';
const W=450,ink='#d1ff66',white='#f2ead7';
function wrap(ctx,value,width,size,weight){
 ctx.font=(weight?'bold ':'normal ')+size+'px sans-serif';
 const lines=[];let line='';
 const add=token=>{if(line&&ctx.measureText(line+token).width>width){lines.push(line.trimEnd());line='';}if(line||token.trim())line+=token;};
 for(const token of String(value??'').match(/[A-Za-z0-9]+(?:[.'’_-][A-Za-z0-9]+)*|[\s\S]/gu)||[]){
  if(token==='\n'){lines.push(line.trimEnd());line='';continue;}
  // Keep normal English words together; very long unbroken words still wrap safely.
  if(ctx.measureText(token).width>width)Array.from(token).forEach(add);else add(token);
 }
 if(line)lines.push(line);return lines.length?lines:[''];
}
function fitLines(ctx,value,width,size,bold,max){
 const all=wrap(ctx,value,width,size,bold),lines=all.slice(0,max);
 if(all.length>max){let last=Array.from(lines[max-1]);while(last.length&&ctx.measureText(last.join('')+'…').width>width)last.pop();lines[max-1]=last.join('')+'…';}
 return lines;
}
function layout(ctx,ticket,img){
 if(!img||!(img.width>0&&img.height>0))throw Error('封面暂不可用，请先补充图片');
 const live=ticket.kind==='live',titleSize=live?16:18;
 const titles=fitLines(ctx,ticket.title,W-64,titleSize,true,6),artists=ticket.artist?fitLines(ctx,ticket.artist,W-64,11,false,3):[];
 const titleTop=92,artistTop=titleTop+titles.length*(titleSize+7)+5;
 const sequenceTop=artistTop+artists.length*17+9;
 const artTop=sequenceTop+(ticket.sequence?46:8),scale=Math.min(310/img.width,(live?380:310)/img.height);
 const artW=img.width*scale,artH=img.height*scale;
 const fieldsTop=artTop+artH+28,rows=[];
 for(let i=0;i<(ticket.fields||[]).length;i+=2){
  const pair=ticket.fields.slice(i,i+2),full=pair.length===1;
  const fields=pair.map(f=>({label:String(f[0]??''),lines:fitLines(ctx,f[1],full?W-64:(W-86)/2,12,false,8)}));
  rows.push({fields,full,height:17+Math.max(...fields.map(f=>f.lines.length))*18+13});
 }
 const tear=fieldsTop+rows.reduce((s,r)=>s+r.height,0)+9;
 const owners=fitLines(ctx,ticket.owner||'音乐收藏者',176,15,true,2);
 return {live,titleSize,titles,artists,titleTop,artistTop,artTop,artW,artH,sequenceTop,fieldsTop,rows,tear,owners,H:tear+126};
}
function draw(canvas,ticket,images){
 let ctx=canvas.getContext('2d');const img=images.get(ticket.cover);
 if(!img)throw Error(ticket.kind==='live'?'演出海报加载失败，请重试':'专辑封面加载失败，请重试');
 const l=layout(ctx,ticket,img),{live,tear,H}=l,inset=32,top=36,ratio=(W-inset*2)/W,exportHeight=Math.ceil(H*ratio+top*2);
 canvas.width=W*3;canvas.height=exportHeight*3;ctx=canvas.getContext('2d');ctx.scale(3,3);
 const text=(s,x,y,size=12,color=white,bold=false,align='left')=>{ctx.font=(bold?'bold ':'normal ')+size+'px sans-serif';ctx.textAlign=align;ctx.textBaseline='top';ctx.fillStyle=color;ctx.fillText(String(s),x,y);};
 const line=(x,y,x2,y2,color='#626b42',width=.6)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();};
 // Seeded short paper fibers: no texture bitmaps, remote requests or package weight.
 const fibers=(x,y,w,h,light,seed=127)=>{
  let state=seed;const random=()=>{state=state*16807%2147483647;return state/2147483647;};
  for(let pass=0;pass<2;pass++){
   ctx.strokeStyle=pass?(light?'rgba(47,35,19,.15)':'rgba(0,0,0,.20)'):(light?'rgba(255,248,224,.25)':'rgba(243,238,208,.10)');
   ctx.lineWidth=.3;ctx.beginPath();
   const count=Math.ceil(w*h/5);
   for(let i=0;i<count;i++){const px=x+random()*w,py=y+random()*h,len=.2+random()*1.5,angle=random()*Math.PI;ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(angle)*len,py+Math.sin(angle)*len);}ctx.stroke();
  }
  // Uneven long fibers with paired light/shade give the paper a shallow relief.
  for(let pass=0;pass<2;pass++){
   ctx.strokeStyle=pass?(light?'rgba(255,253,231,.12)':'rgba(255,248,222,.075)'):(light?'rgba(73,49,24,.10)':'rgba(0,0,0,.23)');
   ctx.lineWidth=.35;ctx.beginPath();state=seed+71;
   for(let i=0;i<w*h/45;i++){const px=x+random()*w,py=y+random()*h+pass*.35,len=1+random()*3,angle=random()*Math.PI*2,dx=Math.cos(angle)*len,dy=Math.sin(angle)*len;ctx.moveTo(px,py);ctx.quadraticCurveTo(px+dx*.5-dy*.15,py+dy*.5+dx*.15,px+dx,py+dy);}ctx.stroke();
  }
 };
 const backdrop=(x,y,w,h)=>{
  const light=ctx.createLinearGradient(x,y,x+w,y+h*.75);
  light.addColorStop(0,'#dfc9a6');light.addColorStop(.42,'#bea27b');light.addColorStop(1,'#957752');
  ctx.fillStyle=light;ctx.fillRect(x,y,w,h);
  // Low-frequency pulp clouds sit beneath visible short fibers.
  let state=739;const random=()=>{state=state*16807%2147483647;return state/2147483647;};
  for(let i=0;i<Math.ceil(w*h/450);i++){
   const px=x+random()*w,py=y+random()*h,r=2+random()*9;
   const cloud=ctx.createRadialGradient(px,py,0,px,py,r);
   cloud.addColorStop(0,i%2?'rgba(74,46,20,.065)':'rgba(255,245,216,.10)');cloud.addColorStop(1,'rgba(180,148,106,0)');
   ctx.fillStyle=cloud;ctx.fillRect(px-r,py-r,r*2,r*2);
  }
  fibers(x,y,w,h,true,181);
 };
 backdrop(0,0,W,exportHeight);ctx.save();ctx.translate(inset,top);ctx.scale(ratio,ratio);
 // One continuous paper silhouette keeps the shadow outside the ticket, without edge dots.
 const outline=()=>{
  const r=12,rt=28,n=10;ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(W-rt,0);ctx.quadraticCurveTo(W,0,W,rt);
  ctx.lineTo(W,tear-n);ctx.arc(W,tear,n,-Math.PI/2,-Math.PI*1.5,true);
  ctx.lineTo(W,H-r);ctx.quadraticCurveTo(W,H,W-r,H);ctx.lineTo(r,H);ctx.quadraticCurveTo(0,H,0,H-r);
  ctx.lineTo(0,tear+n);ctx.arc(0,tear,n,Math.PI/2,-Math.PI/2,true);
  ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);ctx.closePath();
 };
 // Two quiet backing tickets peek out beneath the main ticket.
 for(const layer of [{dx:3,dy:14,angle:.064,color:'#b6a381'},{dx:-4,dy:6,angle:-.044,color:'#ddceb0'}]){
  ctx.save();ctx.translate(W/2+layer.dx,H/2+layer.dy);ctx.rotate(layer.angle);ctx.translate(-W/2,-H/2);
  ctx.shadowColor='rgba(45,28,13,.38)';ctx.shadowBlur=7;ctx.shadowOffsetX=3;ctx.shadowOffsetY=5;
  ctx.fillStyle=layer.color;outline();ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle='rgba(255,248,225,.26)';ctx.lineWidth=.7;outline();ctx.stroke();ctx.restore();
 }
 ctx.save();ctx.shadowColor='rgba(31,20,10,.68)';ctx.shadowBlur=18;ctx.shadowOffsetX=5;ctx.shadowOffsetY=9;ctx.fillStyle='#141713';outline();ctx.fill();ctx.restore();
 ctx.save();outline();ctx.clip();
 ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
 ctx.fillStyle='#202321';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#b5cf62';ctx.fillRect(0,0,9,tear);
 ctx.fillStyle='#c3ed60';ctx.fillRect(0,tear,W,H-tear);
 line(9,.7,W-1,.7,'rgba(255,248,219,.24)',1);line(W-1,1,W-1,H-1,'rgba(0,0,0,.35)',1.3);line(1,H-1,W-1,H-1,'rgba(0,0,0,.3)',1.3);
 ctx.restore();
 const logo=images.get(LOGO),mascot=images.get(MASCOT),avatar=images.get(ticket.avatar)||mascot;
 ctx.save();ctx.beginPath();ctx.arc(50,44,22,0,Math.PI*2);ctx.clip();ctx.fillStyle='#50563a';ctx.fillRect(28,22,44,44);
 if(avatar){const side=Math.min(avatar.width,avatar.height);ctx.drawImage(avatar,(avatar.width-side)/2,(avatar.height-side)/2,side,side,28,22,44,44);}else text(Array.from(ticket.owner||'音')[0],50,33,18,white,true,'center');ctx.restore();
 const ownerTop=l.owners.length>1?17:27;
 l.owners.forEach((s,i)=>text(s,86,ownerTop+i*20,15,white,true));
 text('大收藏家 - 唱片演出记录',86,ownerTop+l.owners.length*20+4,10,'#c0c3b0');
 if(logo)ctx.drawImage(logo,W-112,24,80,40);else{text('MUSIC',W-112,25,17,ink,true);text('&LIVE',W-112,44,17,ink,true);}
 line(32,80,W-32,80,'#6c7951',.6);
 // Fine registration rails frame the content without crossing text or artwork.
 [20,W-20].forEach((x,i)=>{line(x,94,x,tear-16,'rgba(180,207,98,.28)',.45);for(let y=108;y<tear-15;y+=24)line(x,y,x+(i?-3:3),y,'rgba(196,218,136,.38)',.45);});
 l.titles.forEach((s,i)=>text(s,W/2,l.titleTop+i*(l.titleSize+7),l.titleSize,white,true,'center'));
 l.artists.forEach((s,i)=>text(s,W/2,l.artistTop+i*17,11,'#c0c3b0',false,'center'));
 const artX=(W-l.artW)/2;
 // Five-argument drawImage contains every source pixel for every artwork ratio.
 ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=6;ctx.shadowOffsetY=3;ctx.drawImage(img,artX,l.artTop,l.artW,l.artH);ctx.restore();
 [[artX-7,l.artTop-7,1,1],[artX+l.artW+7,l.artTop-7,-1,1],[artX-7,l.artTop+l.artH+7,1,-1],[artX+l.artW+7,l.artTop+l.artH+7,-1,-1]].forEach(([x,y,dx,dy])=>{line(x,y+dy*9,x,y,'#c8cbb6',.8);line(x,y,x+dx*9,y,'#c8cbb6',.8);});
 if(ticket.sequence){
  const runs=[['人生第 ',12,false],[String(ticket.sequence),28,true],[live?' 场现场':' 张唱片',12,false]];
  const widths=runs.map(([s,size,bold])=>{ctx.font=(bold?'bold ':'normal ')+size+'px sans-serif';return ctx.measureText(s).width;});let x=(W-widths.reduce((a,b)=>a+b,0))/2;
  const margin=Math.min(33,Math.max(0,x-42)),right=W-x;
  for(let i=0;i<5&&margin>12;i++){const h=[4,9,15,9,4][i],dx=i*3;line(x-15-dx,l.sequenceTop+18-h/2,x-15-dx,l.sequenceTop+18+h/2,'#87995b',.8);line(right+15+dx,l.sequenceTop+18-h/2,right+15+dx,l.sequenceTop+18+h/2,'#87995b',.8);}
  runs.forEach(([s,size,bold],i)=>{ctx.font=(bold?'bold ':'normal ')+size+'px sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=bold?ink:white;ctx.fillText(s,x,l.sequenceTop+28);x+=widths[i];});
 }
 let fy=l.fieldsTop;line(32,fy-8,W-32,fy-8,'#a6b365',.8);
 l.rows.forEach(row=>{
  row.fields.forEach((f,i)=>{const x=32+i*(W/2-21);text(f.label,x,fy,9,'#bdc2ad');f.lines.forEach((s,j)=>text(s,x,fy+17+j*18,12));});
  if(!row.full)line(W/2,fy+2,W/2,fy+row.height-13,'#747b65',.5);
  fy+=row.height;line(32,fy-8,W-32,fy-8,'#737b62',.5);
 });
 // Tear-off seam belongs to the cream stub, with visible pinholes.
 for(let x=15;x<W-10;x+=10){ctx.beginPath();ctx.ellipse(x,tear+1,1.5,.8,0,0,Math.PI*2);ctx.fillStyle='#373e29';ctx.fill();}
 ctx.save();ctx.beginPath();ctx.rect(0,tear,W,H-tear);ctx.clip();ctx.globalAlpha=.08;ctx.globalCompositeOperation='multiply';
 if(logo)ctx.drawImage(logo,-15,tear-42,W+30,(W+30)/2);else{text('MUSIC',-15,tear-42,80,'#202321',true);text('&LIVE',-15,tear+48,80,'#202321',true);}ctx.restore();
 ctx.beginPath();ctx.arc(W/2,tear+59,37.5,0,Math.PI*2);ctx.strokeStyle='#7b8548';ctx.lineWidth=.7;ctx.stroke();
 ctx.save();ctx.beginPath();ctx.arc(W/2,tear+59,35.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.clip();ctx.drawImage(images.get(CODE),W/2-30,tear+29,60,60);ctx.restore();
 text('扫码打开小程序',W/2,tear+103,8,'#3f492d',false,'center');
 ctx.restore();
 ctx.restore();return {width:W,height:exportHeight};
}

async function load(canvas,source){
 let src=source;if(src.startsWith('cloud://'))src=(await wx.cloud.downloadFile({fileID:src})).tempFilePath;
 // The image element and Canvas accept formats that getImageInfo may reject.
 // Metadata lookup is optional: a failure must still try the actual artwork.
 let info;try{info=await new Promise((resolve,reject)=>{
  const result=wx.getImageInfo({src,success:resolve,fail:reject});
  if(result?.then)result.then(resolve,reject);
 });}catch(e){info=null;}
 let path=info?.path||src;
 if(source.startsWith('/')&&!/^(?:\/|[a-z][a-z\d+.-]*:)/i.test(path))path='/'+path;
 for(const candidate of [...new Set([path,src])]){try{return await new Promise((resolve,reject)=>{
  const img=canvas.createImage(),timer=setTimeout(()=>{img.onload=img.onerror=null;reject(Error('图片加载超时'));},8000);
  img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('图片加载失败'));};try{img.src=candidate;}catch(e){clearTimeout(timer);reject(e);}
 });}catch(e){/* Retry the original absolute path if a native temporary URL expired. */}}
 throw Error('图片加载失败');
}
async function render(component,ticket){
 const canvas=await new Promise(resolve=>component.createSelectorQuery().select('#ticketPoster').fields({node:true}).exec(rows=>resolve(rows[0]?.node)));
 if(!canvas)throw Error('画布暂不可用，请重试');
 const images=new Map();
 await Promise.all([CODE,ticket.cover].map(async src=>{if(!src)throw Error('封面暂不可用，请先补充图片');try{images.set(src,await load(canvas,src));}catch(e){throw Error(src===CODE?'小程序码加载失败，请重试':'封面加载失败，请重试');}}));
 // Decode only one image at a time. Decorative brand failures cannot block sharing.
 for(const src of [LOGO,MASCOT]){try{images.set(src,await load(canvas,src));}catch(e){/* Text branding and owner initial remain available. */}}
 if(ticket.avatar){try{images.set(ticket.avatar,await load(canvas,ticket.avatar));}catch(e){/* An unavailable avatar falls back to the owner's initial. */}}
 const size=draw(canvas,ticket,images);await new Promise(resolve=>component.setData({posterHeight:size.height},resolve));
 // Allow the visible canvas to paint before asking WeChat for the exported file.
 await new Promise(resolve=>canvas.requestAnimationFrame(()=>canvas.requestAnimationFrame(resolve)));
 const file=await wx.canvasToTempFilePath({canvas,fileType:'png',destWidth:size.width*3,destHeight:size.height*3});
 return file.tempFilePath;
}
module.exports={draw,render,wrap,fitLines,layout,load,CODE};
