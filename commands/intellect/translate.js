const axios = require('axios');

module.exports = {
    name: "translate",
    description: "Translate text to another language",
    usage: "[lang] [text]",
    execute: async (conn, msg, args, { reply, fancy }) => {
        if (args.length < 2) return reply("❌ Usage: .translate sw Hello world");

        const target = args[0];
        const text = args.slice(1).join(' ');

        try {
            const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`);
            const translation = res.data.responseData.translatedText;
            reply(fancy(`🔤 *Translation (${target}):*\n${translation}`));
        } catch {
            reply("❌ Translation failed.");
        }
    }
};