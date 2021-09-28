const functions = require('./../index')

module.exports = {
    slash: true,
    testOnly: "true",
    description: "Record a server member's misbehavior",
    minArgs: 2,
    expectedArgs: '<user_id> <incident> [rules_broken] [moderator_action] [date]',
    callback: async ({ channel, args }) => {
        const response = await functions.recordEntry(args)
        if (response.length > 1) await functions.sendMessageEmbeds(channel, response.splice(1))
        return response[0]
    }
}
