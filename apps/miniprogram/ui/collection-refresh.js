const { recent, mark } = require('./space-navigation');
const pending = new WeakMap();

function owner(app) {
  return app.globalData?.userId || app.globalData?.auth?.me?.id || 'guest';
}

// Reuse the existing account-aware loader, coalescing reads across primary panes.
function refreshCollection(app, force = false) {
  if (typeof app.loadCloudCollection !== 'function') return Promise.resolve(null);
  if (!force && recent('vinyl', app)) return Promise.resolve(null);
  const key = owner(app);
  const current = pending.get(app);
  if (!force && current?.owner === key) return current.task;
  const entry = { owner: key };
  entry.task = Promise.resolve().then(() => app.loadCloudCollection(force ? { force: true } : {}))
    .then(payload => {
      if (owner(app) !== key) return null;
      if (payload) mark('vinyl', app);
      return payload;
    })
    .finally(() => { if (pending.get(app) === entry) pending.delete(app); });
  pending.set(app, entry);
  return entry.task;
}

module.exports = { refreshCollection };
