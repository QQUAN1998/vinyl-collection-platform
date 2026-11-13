const KEY='ui.live-view.v1';const TTL=86400000;
function read(api,owner,now=Date.now()){if(!owner)return null;try{const v=api.getStorageSync(KEY);return v&&v.owner===owner&&Array.isArray(v.records)&&now-v.at>=0&&now-v.at<TTL?v.records:null;}catch(_){return null;}}
function save(api,owner,records,now=Date.now()){if(!owner||!Array.isArray(records))return;try{api.setStorageSync(KEY,{owner,at:now,records});}catch(_){}}
module.exports={read,save};
