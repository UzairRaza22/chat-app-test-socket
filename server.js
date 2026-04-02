require('dotenv').config();
const http = require('http');
const express = require('express');
const path = require('path');
const { Server } = require('socket.io');
const { instrument } = require('@socket.io/admin-ui');
const { connectDB } = require('./src/config/db');
const { startTestMessageWatcher } = require('./src/watchers/testMessageWatcher');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        credentials: true
    }
});

global.io = io;
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: "active",
        active_sockets: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Serve Admin UI static files
app.use('/socket-admin', express.static(
    path.join(__dirname, 'node_modules/@socket.io/admin-ui/ui/dist')
));

// Admin UI instrumentation
instrument(io, {
    auth: false,
    mode: "development"
});

// Main namespace — handles frontend clients
io.on('connection', (socket) => {
    console.log(`✅ Client Connected: ${socket.id}`);

    // When a user is typing — broadcast to everyone else
    socket.on('typing', (data) => {
        socket.broadcast.emit('user_typing', {
            sender_id: data.sender_id,
            isTyping: data.isTyping
        });
        console.log(`✍️  ${data.sender_id} is ${data.isTyping ? 'typing' : 'stopped typing'}`);
    });

    // When a message is sent directly via socket (instant delivery)
    socket.on('send_message', (data) => {
        // Broadcast to all OTHER connected clients
        socket.broadcast.emit('message_received', {
            text: data.text,
            sender_id: data.sender_id,
            timestamp: new Date().toISOString()
        });
        console.log(`📨 Message from ${data.sender_id}: ${data.text}`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client Disconnected: ${socket.id}`);
    });
});

// Start server
async function startServer() {
    try {
        await connectDB();
        await startTestMessageWatcher(io);

        const PORT = process.env.PORT || 3013;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Socket Server running on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error("Fatal startup error:", error);
        process.exit(1);
    }
}

startServer();