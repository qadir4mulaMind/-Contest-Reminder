const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

webpush.setVapidDetails(
    'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
    const response = await fetch('https://codeforces.com/api/contest.list?gym=false');
    const data = await response.json();
    
    const now = Date.now() / 1000;
    const upcomingContests = data.result.filter(c => 
        c.phase === 'BEFORE' && (c.startTimeSeconds - now) < 3600 && (c.startTimeSeconds - now) > 0
    );

    if (upcomingContests.length === 0) {
        return { statusCode: 200, body: 'No upcoming contests in the next hour.' };
    }

    const store = getStore('subscriptions');
    const { blobs } = await store.list();

    const payload = JSON.stringify({
        title: 'Contest Starting Soon! 🚀',
        body: upcomingContests[0].name + ' is starting in less than an hour!'
    });

    const notifications = blobs.map(async (blob) => {
        const subscription = await store.get(blob.key, { type: 'json' });
        try {
            await webpush.sendNotification(subscription, payload);
        } catch (error) {
            if (error.statusCode === 410) await store.delete(blob.key);
        }
    });

    await Promise.all(notifications);
    return { statusCode: 200, body: 'Notifications sent!' };
};
