#!/bin/bash
echo "🚀 Installing INSIDIOUS V2..."

# Clean up
rm -rf node_modules package-lock.json

# Install dependencies
echo "📦 Installing dependencies..."
npm install @whiskeysockets/baileys axios fs-extra mongoose qrcode-terminal --no-audit --no-fund

# Create necessary directories
mkdir -p sessions commands lib database logs

# Create font.js
cat > lib/font.js << 'EOF'
module.exports = {
    fancy: (text) => text,
    runtime: (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}h ${minutes}m ${secs}s`;
    }
};
EOF

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file..."
    cat > .env << 'EOF'
BOT_NAME="ɪɴꜱɪᴅɪᴏᴜꜱ: ᴛʜᴇ ʟᴀꜱᴛ ᴋᴇʏ"
OWNER_NUMBER="255618558502"
BOT_PREFIX="."
MONGODB_URI="mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/insidious"
NEWSLETTER_JID="120363404317544295@newsletter"
AI_API_URL="https://gpt.aliali.dev/api/v1?text="
EOF
fi

echo "✅ Installation complete!"
echo "🚀 Start bot with: node index.js"
