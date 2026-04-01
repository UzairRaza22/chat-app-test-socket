// testMessageWatcher.js
const { getDB } = require('../config/db');

let socketIoInstance = null;
let isWatching = false;

// Keep last 50 messages in memory for late Admin UI clients
const messageBuffer = [];
const MAX_BUFFER_SIZE = 50;

/**
 * Starts the Test Message Watcher and emits events to Admin UI.
 * @param {import('socket.io').Server} io
 */
async function startTestMessageWatcher(io) {
    if (isWatching) return;
    if (io) socketIoInstance = io;

    const db = getDB();
    const testingCollection = db.collection('testings');

    console.log("🔍 Starting Test Message Watcher for Admin UI...");

    isWatching = true;

    try {
        // Watch for new inserts in 'testing' collection
        const changeStream = testingCollection.watch(
            [{ $match: { operationType: 'insert' } }],
            { fullDocument: 'updateLookup' }
        );

        // Emit messages to /admin namespace
        const adminNamespace = socketIoInstance.of('/admin');

        // Send buffered messages to newly connected Admin UI clients
        adminNamespace.on('connection', (socket) => {
            console.log(`✅ Admin UI connected: ${socket.id}`);
            if (messageBuffer.length > 0) {
                socket.emit('bulk_test_messages', messageBuffer);
            }
        });

        changeStream.on('change', (change) => {
            const doc = change.fullDocument;
            if (!doc) return;

            const payload = {
                id: doc._id,
                text: doc.text,
                sender_id: doc.sender_id,
                timestamp: doc.created_at || new Date()
            };

            // Save in buffer
            messageBuffer.push(payload);
            if (messageBuffer.length > MAX_BUFFER_SIZE) {
                messageBuffer.shift();
            }

            // Emit to all connected Admin UI clients
            adminNamespace.emit('test_message_received', payload);
            console.log(`📩 Test message emitted: ${doc.text}`);
        });

        changeStream.on('error', (err) => {
            console.error("❌ Watcher Error:", err);
            isWatching = false;
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
}

module.exports = { startTestMessageWatcher };