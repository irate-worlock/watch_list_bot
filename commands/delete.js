const functions = require('./../index')

module.exports = {
    slash: true,
    testOnly: "true",
    description: "Remove a recorded entry for a certain server member.",
    minArgs: 2,
    expectedArgs: '<user_id> <entry_id>',
    callback: async ({ args }) => {
        const response = await functions.deleteEntry(args)
        return response
    }
}
