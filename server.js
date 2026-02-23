const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// ✅ Premium Health Check Endpoint (Railway compatible)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'INSIDIOUS BOT',
        version: '3.0 ULTRA',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        premium: true ✨
    });
});

// ✅ Alternative health endpoint (some configs use this)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        connected: true,
        message: 'INSIDIOUS BOT is running smoothly 🛡️',
        deployment: 'railway',
        encrypted: true
    });
});

// ✅ Catch-all route: serve your premium HTML
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🚀 Start server with premium log
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════╗
║  🔐 INSIDIOUS BOT v3.0 ULTRA       ║
║  🚀 Deployed on Railway            ║
║  🛡️  Premium Health Check: ACTIVE  ║
║  🔗 http://localhost:${PORT}              ║
╚════════════════════════════════════╝
    `);
});

