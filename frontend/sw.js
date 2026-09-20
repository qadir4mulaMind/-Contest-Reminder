const CACHE = "contests-v2";
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    if (event.request.url.includes("/api/")) {
        return fetch(event.request);
    }
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});