const DIRECT_ID = "direct";

const DEFAULT_HOSTS = [];

async function initializeStorage() {
  const stored = await chrome.storage.local.get(["proxyHosts", "activeProxyId"]);
  const updates = {};

  if (!Array.isArray(stored.proxyHosts)) {
    updates.proxyHosts = DEFAULT_HOSTS;
  }

  if (typeof stored.activeProxyId !== "string") {
    updates.activeProxyId = DIRECT_ID;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

async function getState() {
  await initializeStorage();
  const stored = await chrome.storage.local.get(["proxyHosts", "activeProxyId"]);
  const proxySetting = await chrome.proxy.settings.get({ incognito: false });

  return {
    hosts: stored.proxyHosts,
    activeProxyId: stored.activeProxyId,
    levelOfControl: proxySetting.levelOfControl
  };
}

function normalizeHost(value) {
  const host = String(value ?? "").trim().toLowerCase();

  if (!host) {
    throw new Error("Host is required");
  }

  if (host.includes("://") || host.includes("/") || /\s/.test(host)) {
    throw new Error("Enter only a device name or IP address, without a scheme, path, or port");
  }

  if (!/^[a-z0-9._:[\]-]+$/i.test(host)) {
    throw new Error("Host contains unsupported characters");
  }

  return host;
}

function normalizePort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer between 1 and 65535");
  }

  return port;
}

function makeId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `proxy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function updateBadge(activeProxyId) {
  const connected = activeProxyId !== DIRECT_ID;
  await chrome.action.setBadgeText({ text: connected ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({
    color: connected ? "#0f9d75" : "#64748b"
  });
}

async function useDirectConnection() {
  await chrome.proxy.settings.clear({ scope: "regular" });
  await chrome.privacy.network.webRTCIPHandlingPolicy.clear({ scope: "regular" });
  await chrome.storage.local.set({ activeProxyId: DIRECT_ID });
  await updateBadge(DIRECT_ID);
}

async function useProxy(proxyId) {
  const state = await getState();
  const proxy = state.hosts.find((item) => item.id === proxyId);

  if (!proxy) {
    throw new Error("The selected proxy host could not be found");
  }

  if (
    state.levelOfControl !== "controllable_by_this_extension" &&
    state.levelOfControl !== "controlled_by_this_extension"
  ) {
    throw new Error("Chrome proxy settings are controlled by another extension or system policy");
  }

  await chrome.proxy.settings.set({
    scope: "regular",
    value: {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "socks5",
          host: proxy.host,
          port: proxy.port
        },
        bypassList: ["<local>", "localhost", "127.0.0.1"]
      }
    }
  });

  await chrome.privacy.network.webRTCIPHandlingPolicy.set({
    scope: "regular",
    value: "disable_non_proxied_udp"
  });

  await chrome.storage.local.set({ activeProxyId: proxy.id });
  await updateBadge(proxy.id);
}

async function setActiveProxy(proxyId) {
  if (proxyId === DIRECT_ID) {
    await useDirectConnection();
  } else {
    await useProxy(proxyId);
  }

  return getState();
}

async function addHost(payload) {
  const name = String(payload?.name ?? "").trim();
  const host = normalizeHost(payload?.host);
  const port = normalizePort(payload?.port);

  if (!name) {
    throw new Error("Display name is required");
  }

  if (name.length > 40) {
    throw new Error("Display name must be 40 characters or fewer");
  }

  const state = await getState();
  const duplicate = state.hosts.some(
    (item) => item.host.toLowerCase() === host && item.port === port
  );

  if (duplicate) {
    throw new Error("This host and port already exist");
  }

  const newHost = {
    id: makeId(),
    name,
    host,
    port
  };

  await chrome.storage.local.set({ proxyHosts: [...state.hosts, newHost] });
  return { state: await getState(), newHost };
}

async function deleteHost(proxyId) {
  const state = await getState();
  const nextHosts = state.hosts.filter((item) => item.id !== proxyId);

  if (nextHosts.length === state.hosts.length) {
    throw new Error("The host to delete could not be found");
  }

  if (state.activeProxyId === proxyId) {
    await useDirectConnection();
  }

  await chrome.storage.local.set({ proxyHosts: nextHosts });
  return getState();
}

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_STATE":
      return getState();
    case "SET_ACTIVE_PROXY":
      return setActiveProxy(message.proxyId);
    case "ADD_HOST":
      return addHost(message.host);
    case "DELETE_HOST":
      return deleteHost(message.proxyId);
    default:
      throw new Error("Unknown operation");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  const { activeProxyId } = await chrome.storage.local.get("activeProxyId");
  await updateBadge(activeProxyId ?? DIRECT_ID);
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();

  try {
    await setActiveProxy(state.activeProxyId);
  } catch (error) {
    console.error("Unable to restore proxy setting", error);
    await useDirectConnection();
  }
});

initializeStorage()
  .then(async () => {
    const { activeProxyId } = await chrome.storage.local.get("activeProxyId");
    await updateBadge(activeProxyId ?? DIRECT_ID);
  })
  .catch((error) => console.error("Unable to initialize extension", error));
