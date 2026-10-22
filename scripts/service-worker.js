const CACHE = "romdex-shell-__VERSION__";
const ASSETS = __ASSETS__;
const INVENTORY = new Set(ASSETS);
const keyFor = (request) => {
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.search ||
    request.headers.has("Authorization")
  )
    return null;
  let key = url.pathname;
  if (request.mode === "navigate" && !INVENTORY.has(key))
    key = key.endsWith("/") ? key + "index.html" : key + "/index.html";
  return INVENTORY.has(key) ? key : null;
};
self.addEventListener("install", (event) => {
  const precache = async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(ASSETS);
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  };
  event.waitUntil(precache());
});
self.addEventListener("activate", (event) => {
  const activate = async () => {
    for (const name of await caches.keys())
      if (name.startsWith("romdex-shell-") && name !== CACHE)
        await caches.delete(name);
    await self.clients.claim();
  };
  event.waitUntil(activate());
});
self.addEventListener("fetch", (event) => {
  const key = keyFor(event.request);
  if (!key) return;
  const respond = async () =>
    (await (await caches.open(CACHE)).match(key)) ?? fetch(event.request);
  event.respondWith(respond());
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "ACTIVATE_UPDATE") return;
  const update = async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const scope = new URL(self.registration.scope);
    const otherWindows = windows.filter(
      (client) =>
        client.id !== event.source?.id && client.url.startsWith(scope.href),
    );
    if (otherWindows.length) {
      event.ports[0]?.postMessage({ blocked: true });
      return;
    }
    event.ports[0]?.postMessage({ blocked: false });
    await self.skipWaiting();
  };
  event.waitUntil(update());
});
