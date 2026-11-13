const config = require('../config');
let pending;
function get() {
  if (!pending) pending = (async () => {
    if (!wx.cloud || !wx.cloud.Cloud) throw new Error('请升级微信后重试');
    const client = new wx.cloud.Cloud({ resourceAppid: config.appid, resourceEnv: config.env });
    await client.init();
    return client;
  })().catch(error => { pending = null; throw error; });
  return pending;
}
module.exports = { get };
