const functions = require('./../index')

module.exports = {
    slash: true,
    testOnly: "true",
    description: "Record a server member's misbehavior",
    minArgs: 1,
    expectedArgs: '<user_id>',
    callback: async ({channel, args}) => {
        const response = await functions.getEntries(args)
        functions.sendMessageEmbeds(channel, response.splice(1))
        return response[0]
    }
}
