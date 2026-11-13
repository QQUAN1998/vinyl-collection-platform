const routes={vinyl:'pages/cabinet/index',live:'packages/live-archive/pages/index/index'};
const navigating=new WeakSet();
function switchSpace(space,api,pages){
 if(!routes[space]||navigating.has(api))return;
 const stack=pages||(typeof getCurrentPages==='function'?getCurrentPages():[]),page=stack[stack.length-1];
 const current=page?.route||'',tab=current==='pages/add/index'?'add':current==='pages/stats/index'?'stats':page?.data?.uiTab||page?.data?.tab||page?.options?.tab||'home';
 const suffix=['add','stats'].includes(tab)?tab:'home';
 const url='/'+routes[space]+(suffix==='home'?'':'?tab='+suffix);
 if(current===routes[space])return;
 navigating.add(api);
 const release=()=>navigating.delete(api);
 const fail=()=>{release();api.showToast({title:'切换失败，请重试',icon:'none'});};
 let existing=-1;
 for(let i=stack.length-1;i>=0;i--)if(stack[i].route===routes[space]){existing=i;break;}
 try{
  if(existing>=0){
   // Return to the retained host: its gallery and visited panes stay mounted.
   const target=stack[existing];
   api.navigateBack({delta:stack.length-1-existing,success:()=>target.uiPrimary?.(suffix),complete:release,fail});
  }else if(stack.length<8){api.navigateTo({url,complete:release,fail});}
  else{api.redirectTo({url,complete:release,fail});}
 }catch(error){release();throw error;}
}
const fresh=new Map();
function key(kind,app){return kind+':'+(app.globalData?.userId||'guest');}
function recent(kind,app,now=Date.now()){return now-(fresh.get(key(kind,app))||0)<30000;}
function mark(kind,app,now=Date.now()){fresh.set(key(kind,app),now);}
module.exports={switchSpace,recent,mark};
