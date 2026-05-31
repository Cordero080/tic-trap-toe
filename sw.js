const CACHE_NAME = "tic-trap-toe-v11";

const LOCAL_ASSETS = [
  "/",
  "/src/styles/base.css",
  "/src/styles/dark.css",
  "/src/components/cube/cube.css",
  "/src/components/hud/hud.css",
  "/src/components/landing/landing.css",
  "/src/components/model/model.css",
  "/src/components/celeb/celeb.css",
  "/src/components/modal/modal.css",
  "/src/components/title/title.css",
  "/src/app.js",
  "/src/audio.js",
  "/src/background.js",
  "/src/components/cube/cube.js",
  "/src/components/title/title.js",
  "/src/components/model/model.js",
  "/src/components/celeb/celeb.js",
  "/manifest.json",
  "/public/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(LOCAL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Pass through DevTools probes, chrome-extension, and non-GET requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/.well-known/") ||
    url.protocol === "chrome-extension:"
  ) {
    return;
  }

  // GLB models are large — let the browser HTTP cache handle them
  if (url.pathname.startsWith("/public/models/")) return;

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}
