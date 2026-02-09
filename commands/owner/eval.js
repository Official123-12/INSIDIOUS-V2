module.exports = {
    name: "eval",
    execute: async (conn, msg, args, { from, isOwner }) => {
        if (!isOwner) return;
        try {
            let evaled = await eval(args.join(' '));
            if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
            conn.sendMessage(from, { text: evaled });
        } catch (err) {
            conn.sendMessage(from, { text: String(err) });
        }
    }
};
