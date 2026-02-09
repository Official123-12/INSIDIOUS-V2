const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    // Generate unique ID
    generateId: (length = 8) => {
        return crypto.randomBytes(length).toString('hex');
    },

    // Check if file exists
    fileExists: async (filePath) => {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    },

    // Create directory if not exists
    ensureDir: async (dirPath) => {
        await fs.ensureDir(dirPath);
    },

    // Format bytes to human readable
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    // Delay function
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Clean text
    cleanText: (text) => {
        return text
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
