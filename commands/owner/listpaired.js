const handler = require('../../handler');

module.exports = {
    name: "listpaired",
    aliases: ["owners"],
    ownerOnly: true,
    description: "List all paired owner numbers",
    
    execute: async (conn, msg, args, { from, fancy, isOwner, reply }) => {
        if (!isOwner) return;

        const paired = handler.getPairedNumbers();
        let text = `╭─── • 🥀 • ───╮\n   *PAIRED NUMBERS*\n╰─── • 🥀 • ───╯\n\n`;
        if (paired.length === 0) text += "No paired numbers.";
        else paired.forEach((num, i) => text += `${i+1}. ${num}\n`);
        reply(fancy(text));
    }
};