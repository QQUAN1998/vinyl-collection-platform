// Shared by the on-screen canvas, poster, and model checks.
function points(values,width,height,pad=12){const max=Math.max(1,...values.map(v=>Math.max(0,Number(v)||0)));return values.map((v,i)=>({x:pad+i*(width-pad*2)/Math.max(1,values.length-1),y:height-pad-Math.max(0,Number(v)||0)/max*(height-pad*2),value:Math.max(0,Number(v)||0)}));}
function line(ctx,rows){if(!rows.length)return;ctx.moveTo(rows[0].x,rows[0].y);for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],mid=(a.x+b.x)/2;ctx.bezierCurveTo(mid,a.y,mid,b.y,b.x,b.y);}}
function arcs(rows){const total=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.count)||0),0);let angle=-Math.PI/2;return rows.map(r=>{const start=angle;angle+=Math.max(0,Number(r.count)||0)/(total||1)*Math.PI*2;return {...r,start,end:angle};});}
module.exports={points,line,arcs};
