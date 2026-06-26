const AUTH_SYNC_CHANNEL = "logos_voice_auth_sync";
const AUTH_SYNC_STORAGE_KEY = "logos_voice_auth_sync_event";
let externalAuthSyncUntil = 0;

export type AuthSyncReason = "login" | "logout" | "profile" | "delete" | "session";

type AuthSyncPayload = {
  reason: AuthSyncReason;
  timestamp: number;
};

export function notifyAuthChanged(reason: AuthSyncReason) {
  const payload: AuthSyncPayload = {
    reason,
    timestamp: Date.now()
  };

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // BroadcastChannel is an enhancement; localStorage below covers older browsers.
  }

  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Auth still works without cross-tab sync if browser storage is unavailable.
  }
}

export function subscribeToAuthChanges(onChange: (reason: AuthSyncReason) => void) {
  let channel: BroadcastChannel | null = null;

  const handlePayload = (payload: unknown) => {
    if (!isAuthSyncPayload(payload)) return;
    onChange(payload.reason);
  };

  try {
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.onmessage = (event) => handlePayload(event.data);
    }
  } catch {
    channel = null;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;

    try {
      handlePayload(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed external storage values.
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.close();
  };
}

export function markExternalAuthSyncActive() {
  externalAuthSyncUntil = Date.now() + 3000;
}

export function isExternalAuthSyncActive() {
  return Date.now() < externalAuthSyncUntil;
}

function isAuthSyncPayload(payload: unknown): payload is AuthSyncPayload {
  if (!payload || typeof payload !== "object") return false;

  const record = payload as Record<string, unknown>;
  return (
    typeof record.timestamp === "number" &&
    typeof record.reason === "string" &&
    ["login", "logout", "profile", "delete", "session"].includes(record.reason)
  );
}
