self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Contest Reminder';
    const options = {
        body: data.body || 'A new contest is starting soon!',
        icon: 'https://cdn-icons-png.flaticon.com/512/1077/1077052.png',
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
