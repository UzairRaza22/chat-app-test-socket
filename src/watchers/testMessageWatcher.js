const { getDB } = require('../config/db');

let socketIoInstance = null;
let isWatching = false;

async function startTestMessageWatcher(io) {
    if (isWatching) return;
    if (io) socketIoInstance = io;

    const db = getDB();
    const testingCollection = db.collection('testing');

    console.log("🔍 Starting Test Message Watcher...");
    isWatching = true;

    try {
        const changeStream = testingCollection.watch([
            { $match: { operationType: 'insert' } }
        ], { fullDocument: 'updateLookup' });

        changeStream.on('change', async (change) => {
            const doc = change.fullDocument;
            if (!doc) return;

            const payload = {
                id: doc._id,
                text: doc.text,
                sender_id: doc.sender_id,
                timestamp: doc.created_at || new Date()
            };

            socketIoInstance.emit('test_message_received', payload);
            console.log(`📩 Test message emitted: ${doc.text}`);
        });

        changeStream.on('error', (err) => {
            console.error("❌ Watcher Error:", err);
            isWatching = false;
            setTimeout(() => startTestMessageWatcher(socketIoInstance), 5000);
        });

    } catch (err) {
        console.error("❌ Watcher Error:", err);
        isWatching = false;
        setTimeout(() => startTestMessageWatcher(socketIoInstance), 5000);
    }
}

module.exports = { startTestMessageWatcher };