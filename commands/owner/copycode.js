module.exports = {
    name: "copycode",
    ownerOnly: true,
    description: "Display a pairing code for copying",
    usage: "[code]",
    execute: async (conn, msg, args, { reply, fancy }) => {
        const code = args.join(' ');
        if (!code) return reply("❌ No code provided.");

        await reply(fancy(
            `📋 *CODE TO COPY*\n\n` +
            `🔑 *${code}*\n\n` +
            `_Paste it into your WhatsApp to complete pairing._`
        ));
    }
};