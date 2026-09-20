const CACHE = "contests-v3";
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

self.addEventListener("push", event => {
    let data = { title: "Contest Reminder", body: "You have a contest soon!", url: "/" };
    try {
        if (event.data) data = event.data.json();
    } catch (e) {
        console.error("Push parse error:", e);
    }

    const options = {
        body: data.body,
        icon: data.icon || "./icon-192.png",
        badge: "./icon-192.png",
        tag: data.tag || "contest-reminder",
        requireInteraction: true,
        data: { url: data.url || "/" },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const url = event.notification.data?.url || "/";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});