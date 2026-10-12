const CACHE_NAME = "pazar-radar-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.webmanifest",
  "/offline.html",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![CACHE_NAME, "pazar-radar-public-data-v1"].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const publicData = ["/api/pazar", "/api/pazar/populer/list", "/api/tezgah"].includes(
    url.pathname,
  );
  if (url.pathname.startsWith("/api/") && !publicData) return;

  if (publicData) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open("pazar-radar-public-data-v1").then((cache) => cache.put(request, copy));
            return response;
          }
          if (response.status >= 500) throw new Error("API geçici olarak kullanılamıyor");
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set("X-Pazar-Radar-Cache", "stale-offline");
            return new Response(await cached.arrayBuffer(), { status: cached.status, headers });
          }
          return new Response(
            JSON.stringify({
              success: false,
              message: "Çevrimdışısın; bu kayıt daha önce önbelleğe alınmamış.",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json; charset=utf-8" },
            },
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match("/offline.html")),
    ),
  );
});
