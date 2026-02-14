module.exports = {
    name: "unpair",
    ownerOnly: true,
    description: "Remove a paired co-owner number",
    usage: "[phone number]",
    
    execute: async (conn, msg, args, { from, isOwner, reply, config, fancy, unpairNumber }) => {
        if (!isOwner) return reply("❌ This command is for owner only!");
        if (!args[0]) return reply(`🔐 Usage: ${config.prefix}unpair <number>\nExample: ${config.prefix}unpair 255712345678`);

        const number = args[0].replace(/[^0-9]/g, '');
        if (number.length < 10) return reply("❌ Invalid phone number!");

        // Check if it's the deployer's own number
        if (config.ownerNumber && config.ownerNumber.includes(number)) {
            return reply("❌ Cannot unpair the deployer's own number!");
        }

        try {
            const result = await unpairNumber(number);
            if (result) {
                await reply(fancy(`✅ Number ${number} has been unpaired successfully.`));
            } else {
                await reply(fancy(`❌ Number ${number} is not paired.`));
            }
        } catch (e) {
            reply(`❌ Unpair failed: ${e.message}`);
        }
    }
};