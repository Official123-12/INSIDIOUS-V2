const axios = require('axios');
const yts = require('yt-search');
const moment = require('moment-timezone');
const config = require('../../config'); // if you store newsletter info in config

module.exports = {
    name: "video",
    aliases: ["ytvideo", "mp4"],
    description: "Download video from YouTube (search by keyword)",
    usage: ".video <search term>",
    
    execute: async (conn, msg, args, { from, fancy, reply }) => {
        try {
            if (!args.length) {
                return reply("❌ Please provide a video name or keyword.\nExample: .video never gonna give you up");
            }

            // Send searching message
            await conn.sendMessage(from, {
                text: fancy('*🔍 Searching for your video...*')
            }, { quoted: msg });

            const query = args.join(' ');
            const search = await yts(query);

            if (!search || !search.videos || !search.videos.length) {
                return reply("❌ No videos found for your query.");
            }

            const video = search.videos[0];
            const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
            const apiURL = `https://noobs-api.top/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp4`;

            // Call API to get download link
            const response = await axios.get(apiURL);

            if (response.status !== 200 || !response.data || !response.data.downloadLink) {
                return reply("❌ Failed to retrieve the download link. Please try again later.");
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
                        newsletterJid: config.NEWSLETTER_JID || "120363404317544295@newsletter", // replace with your channel JID
                        newsletterName: config.BOT_NAME || "INSIDIOUS BOT",
                        serverMessageId: 100
                    }
                }
            }, { quoted: msg });

            // Send the video – FORWARDED FROM YOUR CHANNEL
            await conn.sendMessage(from, {
                video: { url: downloadLink },
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.NEWSLETTER_JID || "120363404317544295@newsletter",
                        newsletterName: config.BOT_NAME || "INSIDIOUS BOT",
                        serverMessageId: 100
                    }
                }
            }, { quoted: msg });

        } catch (err) {
            console.error('[VIDEO] Error:', err);
            if (err.response && err.response.status === 500) {
                reply("❌ The API is currently experiencing issues. Please try again later.");
            } else {
                reply("❌ An error occurred: " + err.message);
            }
        }
    }
};