const axios = require('axios');
const yts = require('yt-search');
const moment = require('moment-timezone');

module.exports = {
    name: "play",
    aliases: ["audio", "song", "ytmp3"],
    description: "Download audio from YouTube (search by keyword)",
    usage: ".play <song name>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) {
                return reply("❌ Please provide a song name or keyword.\nExample: .play never gonna give you up");
            }

            // Send searching message
            await conn.sendMessage(from, {
                text: fancy('*🔍 Searching for your song...*')
            }, { quoted: msg });

            const query = args.join(' ');
            const search = await yts(query);

            if (!search || !search.videos || !search.videos.length) {
                return reply("❌ No songs found for your query.");
            }

            const video = search.videos[0];
            const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
            const fileName = `${safeTitle}.mp3`;
            const apiURL = `https://noobs-api.top/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp3`;

            // Call API to get download link
            const response = await axios.get(apiURL);

            if (response.status !== 200 || !response.data || !response.data.downloadLink) {
                return reply("❌ Failed to retrieve the audio download link. Please try again later.");
            }

            const downloadLink = response.data.downloadLink;

            // Determine greeting based on time
            moment.tz.setDefault("Africa/Dar_es_Salaam"); // change to your timezone
            const hour = moment().hour();
            let greeting = "Good Morning";
            if (hour >= 12 && hour < 18) greeting = "Good Afternoon!";
            else if (hour >= 18) greeting = "Good Evening!";
            else if (hour >= 22 || hour < 5) greeting = "Good Night";

            // Send thumbnail with info – FORWARDED FROM YOUR CHANNEL
            await conn.sendMessage(from, {
                image: { url: video.thumbnail },
                caption: fancy(
                    `🎧 *Title:* ${video.title}\n` +
                    `👁️ *Views:* ${video.views.toLocaleString()}\n` +
                    `📅 *Uploaded:* ${video.ago}\n` +
                    `⏱️ *Duration:* ${video.timestamp}\n\n` +
                    `${greeting}`
                ),
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: "120363404317544295@newsletter", // replace with your channel JID
                        newsletterName: "INSIDIOUS BOT",
                        serverMessageId: 100
                    }
                }
            }, { quoted: msg });

            // Send the audio – FORWARDED FROM YOUR CHANNEL
            await conn.sendMessage(from, {
                audio: { url: downloadLink },
                mimetype: 'audio/mpeg',
                fileName: fileName,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: "120363404317544295@newsletter",
                        newsletterName: "INSIDIOUS BOT",
                        serverMessageId: 100
                    },
                    externalAdReply: {
                        title: "⇆ㅤ ||◁ㅤ❚❚ㅤ▷||ㅤ ↻",
                        mediaType: 1,
                        previewType: 0,
                        thumbnailUrl: video.thumbnail,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

        } catch (err) {
            console.error('[PLAY] Error:', err);
            if (err.response && err.response.status === 500) {
                reply("❌ The audio service is currently experiencing issues. Please try again later.");
            } else {
                reply("❌ An error occurred: " + err.message);
            }
        }
    }
};