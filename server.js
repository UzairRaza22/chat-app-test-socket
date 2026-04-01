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

// Create Socket.IO server with CORS
const io = new Server(server, {
    cors: {
        origin: "*", // allow all origins
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

// Default namespace for regular clients
io.on('connection', (socket) => {
    console.log(`✅ Client Connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client Disconnected: ${socket.id}`);
    });
});

// Create /admin namespace for Admin UI monitoring
const adminNamespace = io.of('/admin');
adminNamespace.on('connection', (socket) => {
    console.log(`🛠 Admin UI Connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🛑 Admin UI Disconnected: ${socket.id}`);
    });
});

// Start MongoDB watcher and server
async function startServer() {
    try {
        await connectDB();
        await startTestMessageWatcher(io); // emits to /admin namespace

        const PORT = process.env.PORT || 3013;
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Socket Server running on http://0.0.0.0:${PORT}`);
            console.log(`🛠 Admin UI available at http://<your-ip>/test-socket/socket-admin/index.html`);
        });
    } catch (error) {
        console.error("Fatal startup error:", error);
        process.exit(1);
    }
}

startServer();