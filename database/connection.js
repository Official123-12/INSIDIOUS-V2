// database/connection.js
const mongoose = require('mongoose');
const config = require('../config');
const { fancy } = require('../lib/font');

let isConnected = false;
let connectionAttempts = 0;
const maxAttempts = 5;

async function connectDB() {
    try {
        // Check if URI is available
        if (!config.mongodbUri && !config.mongodb) {
            console.log(fancy('[DB] ⚠️ No MongoDB URI found, using in-memory storage'));
            return false;
        }

        const uri = config.mongodbUri || config.mongodb;
        
        // Validate URI format
        if (typeof uri !== 'string' || uri.trim() === '') {
            console.log(fancy('[DB] ❌ Invalid MongoDB URI'));
            return false;
        }

        // Check if already connected
        if (mongoose.connection.readyState === 1) {
            console.log(fancy('[DB] ✅ Already connected'));
            isConnected = true;
            return true;
        }

        // Close any existing connection
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        console.log(fancy(`[DB] 🔄 Connecting to MongoDB (Attempt ${connectionAttempts + 1})...`));
        
        const options = {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            maxPoolSize: 10,
            minPoolSize: 1,
            retryWrites: true,
            w: 'majority'
        };

        await mongoose.connect(uri, options);
        
        isConnected = true;
        connectionAttempts = 0;
        console.log(fancy('[DB] ✅ MongoDB connected successfully'));
        
        // Setup connection event handlers
        mongoose.connection.on('error', (err) => {
            console.error(fancy('[DB] ❌ Connection error:'), err.message);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log(fancy('[DB] ⚠️ Disconnected from MongoDB'));
            isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log(fancy('[DB] 🔄 Reconnected to MongoDB'));
            isConnected = true;
        });

        return true;
        
    } catch (error) {
        connectionAttempts++;
        console.error(fancy('[DB] ❌ Connection failed:'), error.message);
        
        // Auto-retry logic
        if (connectionAttempts < maxAttempts) {
            console.log(fancy(`[DB] 🔄 Retrying in 5 seconds... (${connectionAttempts}/${maxAttempts})`));
            setTimeout(connectDB, 5000);
        } else {
            console.log(fancy('[DB] ⚠️ Max retry attempts reached'));
        }
        
        isConnected = false;
        return false;
    }
}

// Function to check connection status
function isDBConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

// Function to get connection
function getConnection() {
    return mongoose.connection;
}

// Graceful shutdown
async function closeDB() {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log(fancy('[DB] 🔌 MongoDB connection closed'));
        }
    } catch (error) {
        console.error(fancy('[DB] ❌ Error closing connection:'), error.message);
    }
}

module.exports = {
    connectDB,
    isDBConnected,
    getConnection,
    closeDB
};
