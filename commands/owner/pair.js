const axios = require('axios');

module.exports = {
    name: "pair",
    aliases: ["getcode", "pairbot"],
    description: "Get a pairing code from the official website",
    usage: ".pair <phone_number_with_country_code>",
    
    execute: async (conn, msg, args, { from, sender, reply }) => {
        try {
            if (!args.length) {
                await conn.sendMessage(from, { 
                    text: "❌ Please provide your phone number with country code.\nExample: .pair 255712345678" 
                }, { quoted: msg });
                return;
            }

            const phoneNumber = args[0].replace(/[^0-9]/g, '');
            if (phoneNumber.length < 10) {
                await conn.sendMessage(from, { 
                    text: "❌ Invalid number. Must be at least 10 digits." 
                }, { quoted: msg });
                return;
            }

            await conn.sendMessage(from, { 
                text: "⏳ Requesting pairing code..." 
            }, { quoted: msg });

            // Endpoint yako ya pairing – inafanana na ile kwenye index.js
            const apiUrl = `https://insidiousstanytz.up.railway.app/pair?num=${phoneNumber}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (response.data && response.data.success && response.data.code) {
                const code = response.data.code;
                
                // Tuma code kwa mtumiaji (plain text, hakuna fancy fonts)
                await conn.sendMessage(from, { 
                    text: `🔑 Your 8-digit pairing code: ${code}` 
                }, { quoted: msg });
                
                await conn.sendMessage(from, { 
                    text: "📱 Open WhatsApp → Settings → Linked Devices → Link a Device → Link with Phone Number, then enter this code.\n\n_Code expires in 60 seconds._" 
                }, { quoted: msg });

                // 🔥 Optional: Hifadhi kwenye MongoDB (kama unataka)
                // try {
                //     const { PairRequest } = require('../../database/models');
                //     await PairRequest.create({ number: phoneNumber, code, timestamp: new Date() });
                // } catch (dbErr) {
                //     console.error('Failed to save pairing request:', dbErr);
                // }
            } else {
                throw new Error('Invalid response from pairing service');
            }
        } catch (error) {
            console.error('[PAIR] Error:', error);
            await conn.sendMessage(from, { 
                text: "❌ Failed to get pairing code. The service might be down. Please try again later or visit the website directly: https://insidiousstanytz.up.railway.app" 
            }, { quoted: msg });
        }
    }
};