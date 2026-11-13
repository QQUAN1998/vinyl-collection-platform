// Refresh only already-shared covers via the existing readShare service.
// Never fetch another account's private media or alter the receiver's records.
async function hydrate(snapshot, readShare) {
  if (snapshot.kind !== 'live' || !/^[a-f0-9]{48}$/.test(snapshot.mediaShare || '')) return snapshot.records;
  const result = await readShare(snapshot.mediaShare);
  const covers = new Map((result.records || []).map(row => [row.id, row.cover || row.posterUrl || '']));
  return snapshot.records.map(row => {
    const cover = covers.get(row.id);
    return cover && /^https:\/\//.test(cover) ? { ...row, cover } : row;
  });
}

// This reader is intentionally restricted to the existing public readShare API.
// It does not initialize or replace the application's default cloud environment.
async function readShared(token) {
  if (!/^[a-f0-9]{48}$/.test(token || '')) throw new Error('分享链接无效');
  if (!wx.cloud || !wx.cloud.Cloud) throw new Error('云服务暂不可用');
  const config = require('./live-share-config');
  const client = new wx.cloud.Cloud({resourceAppid:config.appid,resourceEnv:config.env});
  await client.init();
  const response = await client.callFunction({name:config.functionName,data:{action:'readShare',token}});
  if (!response.result || !response.result.ok) throw new Error('分享暂不可用');
  return response.result.data;
}
module.exports = { hydrate, readShared };
