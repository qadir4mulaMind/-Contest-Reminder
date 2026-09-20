const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const subscription = JSON.parse(event.body);
        const store = getStore('subscriptions');
        const id = subscription.endpoint.split('/').pop();
        await store.setJSON(id, subscription);
        return { statusCode: 201, body: 'Subscription saved.' };
    } catch (error) {
        return { statusCode: 500, body: error.message };
    }
};
