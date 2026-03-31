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

// Serve Socket Admin UI
app.use('/socket-admin', express.static(
    path.join(__dirname, 'node_modules/@socket.io/admin-ui/ui/dist')
));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: "active",
        active_sockets: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Socket Admin UI
instrument(io, {
    auth: false,
    mode: "development"
});

io.on('connection', (socket) => {
    console.log(`✅ Client Connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client Disconnected: ${socket.id}`);
    });
});

async function startServer() {
    try {
        await connectDB();
        await startTestMessageWatcher(io);
        const PORT = process.env.PORT || 3013;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Test Socket Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Fatal startup error:", error);
        process.exit(1);
    }
}

startServer();