const uiLocale=require("../../../ui/locale-runtime");
const account = require("./account");
const client = require("./cloud-client");
const state = require("./state");
const config = require("../config");
function id() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}
async function call(action, data = {}) {
  if (action !== "readShare") await account.requireAccount();
  if (!wx.cloud || !config.env) throw new Error("请先配置演出集云环境");
  let response;
  try {
    response = await (await client.get()).callFunction({
      name: config.functionName,
      data: { action, ...data },
    });
  } catch (cause) {
    console.error(
      "liveArchiveApi call failed",
      cause.errCode || cause.code || "CLOUD_CALL",
    );
    const error = new Error("云服务暂不可用，请稍后重试");
    error.code = "CLOUD_CALL";
    throw error;
  }
  const result = response.result;
  if (!result || !result.ok) {
    const e = new Error(result?.error?.message || "服务暂不可用");
    e.code = result?.error?.code;
    throw e;
  }
  return result.data;
}
let pendingLoad;
function load() {
  if (pendingLoad) return pendingLoad;
  pendingLoad = (async () => {
    try {
      const data = await call("bootstrap"),
        app = state;
      if (app.ownerKey && app.ownerKey !== data.ownerKey) app.localChanges = {};
      const rows = new Map(data.records.map((r) => [r.id, r]));
      for (const [id, change] of Object.entries(app.localChanges || {})) {
        const remote = rows.get(id);
        if (change === null) {
          rows.delete(id);
          if (!remote) delete app.localChanges[id];
        } else if (!remote || remote.version < change.version) {
          rows.set(id, change);
        } else {
          delete app.localChanges[id];
        }
      }
      Object.assign(app, data, { records: [...rows.values()] });
      return app.records;
    } finally {
      pendingLoad = null;
    }
  })();
  return pendingLoad;
}
function remember(id, record) {
  const app = state;
  if (!app.localChanges) app.localChanges = Object.create(null);
  app.localChanges[id] = record;
}
async function save(record, requestId) {
  const { record: r } = await call("save", { record, requestId });
  const app = state;
  app.records = app.records.filter((v) => v.id !== r.id).concat(r);
  remember(r.id, r);
  return r;
}
async function remove(id, version) {
  await call("delete", { id, version });
  const app = state;
  app.records = app.records.filter((r) => r.id !== id);
  remember(id, null);
}
async function upload(path) {
  if (!state.ownerKey) await load();
  const file = await (await client.get()).uploadFile({
    cloudPath:
      "live-archive/" + state.ownerKey + "/images/" + id(),
    filePath: path,
  });
  try {
    return (await call("registerMedia", { fileID: file.fileID })).url;
  } catch (e) {
    await (await client.get()).deleteFile({ fileList: [file.fileID] }).catch(() => {});
    throw e;
  }
}
async function choose(count = 1) {
  const result = await wx.chooseMedia({
    count,
    mediaType: ["image"],
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
  });
  const uploaded = [];
  for (const item of result.tempFiles) {
    if (item.size > 10 * 1024 * 1024) throw new Error("单张图片不能超过 10MB");
    uploaded.push(await upload(item.tempFilePath));
  }
  return uploaded;
}
function error(e) {
  if (!/cancel/.test(e.errMsg || ""))
    uiLocale.toast(wx,{
      title: e.message || "操作失败，请重试",
      icon: "none",
      duration: 2500,
    });
}
module.exports = { id, call, load, save, remove, choose, error };
