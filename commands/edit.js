const functions = require('./../index')

module.exports = {
    slash: true,
    testOnly: "true",
    description: "Edit a field for a recorded entry for a certain server member.",
    minArgs: 4,
    expectedArgs: '<user_id> <entry_id> <field> <new_value>',
    callback: async ({ args, channel }) => {
        const response = await functions.editEntry(args)
        await functions.sendMessageEmbeds(channel, response.splice(1))
        return response[0]
    }
}
