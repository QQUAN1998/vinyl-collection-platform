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

function bindTvLoginSession(bindings = [], userId, session = {}, now = new Date().toISOString()) {
  const deviceCode = normalizeDeviceCode(session.code);
  if (!userId || !deviceCode) {
    return {
      bindings,
      binding: null,
      event: null
    };
  }

  const binding = {
    id: `tv-${deviceCode}`,
    userId,
    deviceName: session.deviceName || extractDeviceName(session.scanUrl || session.confirmUrl) || "\u5531\u7247\u67dc TV",
    deviceCode,
    status: "active",
    lastSyncedAt: now,
    scanUrl: session.scanUrl || "",
    confirmUrl: session.confirmUrl || ""
  };

  return {
    bindings: upsertTvBinding(bindings, binding),
    binding,
    event: {
      type: "tv-login-qr-bound",
      userId,
      deviceCode,
      requestedAt: now
    }
  };
}

function unbindTvLoginSession(bindings = [], userId, deviceCode = "", now = new Date().toISOString()) {
  const normalizedDeviceCode = normalizeDeviceCode(deviceCode);
  if (!userId) {
    return {
      bindings,
      event: null
    };
  }

  const nextBindings = (bindings || []).filter((binding) => {
    if (binding.userId !== userId) return true;
    if (normalizedDeviceCode && normalizeDeviceCode(binding.deviceCode) !== normalizedDeviceCode) return true;
    return false;
  });

  return {
    bindings: nextBindings,
    event: {
      type: "tv-login-qr-unbound",
      userId,
      deviceCode: normalizedDeviceCode,
      requestedAt: now
    }
  };
}

function upsertTvBinding(bindings = [], nextBinding) {
  const next = (bindings || []).filter((binding) => (
    binding.deviceCode !== nextBinding.deviceCode
    && binding.id !== nextBinding.id
  ));
  return [nextBinding, ...next];
}

function normalizeDeviceCode(value) {
  return String(value || "").trim().toUpperCase();
}

function extractDeviceName(value) {
  const raw = String(value || "");
  const match = raw.match(/[?&]deviceName=([^&#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch (error) {
    return match[1].trim();
  }
}

module.exports = {
  bindTvLoginSession,
  triggerTvSync,
  unbindTvLoginSession
};
