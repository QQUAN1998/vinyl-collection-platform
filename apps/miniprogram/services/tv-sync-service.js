function triggerTvSync(bindings, userId, now = new Date().toISOString()) {
  const nextBindings = bindings.map((binding) => {
    if (binding.userId !== userId || binding.status === "unbound") return binding;
    return {
      ...binding,
      status: "active",
      lastSyncedAt: now
    };
  });

  return {
    bindings: nextBindings,
    event: {
      type: "tv-sync-requested",
      userId,
      requestedAt: now
    }
  };
}

module.exports = {
  triggerTvSync
};
