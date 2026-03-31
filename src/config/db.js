const { MongoClient } = require('mongodb');

let client = null;
let dbConnection = null;

async function connectDB() {
    if (dbConnection) return dbConnection;
    const uri = process.env.MONGO_URI;
    const dbName = process.env.DB_NAME;
    if (!uri || !dbName) {
        console.error("Fatal: MONGO_URI and DB_NAME must be set.");
        process.exit(1);
    }
    client = new MongoClient(uri);
    try {
        await client.connect();
        dbConnection = client.db(dbName);
        console.log(`✅ Connected to database: ${dbName}`);
        return dbConnection;
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
}

function getDB() {
    if (!dbConnection) throw new Error("Database not connected. Call connectDB() first.");
    return dbConnection;
}

module.exports = { connectDB, getDB };