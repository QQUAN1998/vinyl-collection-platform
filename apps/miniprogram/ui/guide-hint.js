// Local guidance only; never changes account onboarding or collection data.
const KEY='vinyl:home-guide:v1';
function visible(api){try{return api.getStorageSync(KEY)!==true;}catch(_){return true;}}
function complete(api){try{api.setStorageSync(KEY,true);}catch(_){}}
module.exports={KEY,visible,complete};
