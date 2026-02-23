const fs = require('fs-extra');
const path = require('path');
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");

const SESSIONS_DIR = path.join(__dirname, '../sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Get auth state for a specific session
 * @param {string} sessionId - Phone number or unique ID
 * @returns {Promise<{state, saveCreds}>}
 */
async function getSessionAuthState(sessionId) {
    const cleanId = sessionId.replace(/[^a-zA-Z0-9@]/g, '_');
    const sessionPath = path.join(SESSIONS_DIR, cleanId);
    
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    return await useMultiFileAuthState(sessionPath);
}

/**
 * Delete a session completely
 * @param {string} sessionId 
 * @returns {boolean
