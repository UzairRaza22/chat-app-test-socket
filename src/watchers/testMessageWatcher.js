// testMessageWatcher.js
const { getDB } = require('../config/db');

let socketIoInstance = null;
let isWatching = false;

/**
 * Starts the Test Message Watcher and emits events to Admin UI.
 * Automatically reconnects if change stream closes or errors.
 * @param {import('socket.io').Server} io
 */
async function startTestMessageWatcher(io) {
    if (isWatching) return; // Prevent multiple watchers
    if (io) socketIoInstance = io;

    const db = getDB();
    const testingCollection = db.collection('testing');

    console.log("🔍 Starting Test Message Watcher for Admin UI...");

    isWatching = true;

    const startChangeStream = () => {
        try {
            const changeStream = testingCollection.watch(
                [{ $match: { operationType: 'insert' } }],
                { fullDocument: 'updateLookup' }
            );

            changeStream.on('change', (change) => {
                const doc = change.fullDocument;
                if (!doc) return;

                const payload = {
                    id: doc._id,
                    text: doc.text,
                    sender_id: doc.sender_id,
                    timestamp: doc.created_at || new Date()
                };

                // Emit to Admin UI namespace
                socketIoInstance.of('/admin').emit('test_message_received', payload);
                console.log(`📩 Emitted to Admin UI: ${doc.text}`);
            });

            changeStream.on('error', (err) => {
                console.error("❌ Watcher Error:", err);
                isWatching = false;
                changeStream.close();
                setTimeout(() => startTestMessageWatcher(socketIoInstance), 5000);
            });

            changeStream.on('close', () => {
                console.warn("⚠️ Change stream closed. Restarting watcher...");
                isWatching = false;
                setTimeout(() => startTestMessageWatcher(socketIoInstance), 5000);
            });
        } catch (err) {
            console.error("❌ Fatal watcher startup error:", err);
            isWatching = false;
            setTimeout(() => startTestMessageWatcher(socketIoInstance), 5000);
        }
    };

    startChangeStream();
}

module.exports = { startTestMessageWatcher };