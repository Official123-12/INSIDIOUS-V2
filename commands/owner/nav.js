module.exports = {
    name: "nav",
    description: "Navigate menu categories",
    execute: async (conn, msg, args, { from, reply, config, fancy }) => {
        // Re‑call the menu command with the provided arguments
        const menuCmd = require('./menu');
        await menuCmd.execute(conn, msg, args, { from, fancy, config });
    }
};