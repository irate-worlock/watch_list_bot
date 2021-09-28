const Discord = require('discord.js')
const client = new Discord.Client()
const WOKCommands = require('wokcommands')
const testServerID = '846117547778768926'
const GDServerID = '746000425643147365'
require('dotenv').config()
const { MongoClient } = require('mongodb')
const mgConfig = require('./config/mongoConfig')
const collName = 'UserRecords'

const uri = `mongodb+srv://${mgConfig.username}:${mgConfig.password}@watchlistbot.etj0y.mongodb.net/WatchListBotDB?retryWrites=true&w=majority`
const mgClient = new MongoClient(uri)
let userCollection

const numSuffix = ['st','nd','rd','th']

const modActionColors = {
    "Watch": "#00d0ff",
    "Gentle Reminder": "#fff700",
    "Formal Warning": "#ffa600",
    "Ban": "#ff0000",
}

client.on('ready', async() => {

    new WOKCommands(client, {
        commandsDir: 'commands',
        testServers: [testServerID, GDServerID],
        showWarns: false,
    })

    await mgClient.connect(async (err, mgC) => {
        const database = mgC.db("WatchListBotDB")
        database.listCollections({name:collName})
            .next((err, collInfo) => {
                if (!collInfo) {
                    database.createCollection(collName, (err, res) => {
                        if (err) throw err
                        console.log(`Collection ${collName} created!`)
                    })
                }
                userCollection = mgClient.db("WatchListBotDB").collection("UserRecords")
                console.log('connected to the database')
            })
    })
})


const recordEntry = async (args) => {
    let [userID, incident, rulesBroken, modAction, date] = args

    if (!rulesBroken) rulesBroken = 'None'
    if (!modAction) modAction = 'None'
    if (!date) date = new Date().toDateString().split(' ').splice(1).join(' ')

    const record = {incident: incident, rulesBroken: rulesBroken, modAction: modAction, date: date}

    let userDoc = await userCollection.findOne({"_id": userID})

    if (userDoc) {
        if (userDoc.records.length === 0) {
            record.id = 1
            await userCollection.updateOne({"_id": userID}, {$push:{records: record}})
        }
        else {
            record.id = userDoc.records.length + 1
            let pos = userDoc.records.length - 1
            if (new Date(date) >= new Date(userDoc.records[pos].date)) {
                pos = -1
            }
            else {
                while (new Date(date) < new Date(userDoc.records[pos].date) && pos > 0) {
                    pos--
                }
            }
            await userCollection.updateOne({"_id": userID},
                {$push: {records: {$each: [record], $position: pos}}}, (err, res) => {
                    if (err) throw err
                    else console.log("1 document updated")
                })
        }
    }
    else {
        const user = await client.users.fetch(userID)
        const userTag = `${user.username}#${user.discriminator}`
        if (!user) return ['User not found']
        record.id = 1
        userDoc = {
            _id: userID,
            userTag: userTag,
            warnings: 0,
            banned: false,
            records: [record]
        }

        await userCollection.insertOne(userDoc, (err, res) => {
            if (err) throw err
            else console.log("1 document created")
        })
    }

    const entryEmbed = new Discord.MessageEmbed()
        .setTitle('Entry Added')
        .setDescription('I have added the following entry to my database!')
        .addField("User :bust_in_silhouette:", userDoc.userTag, true)
        .addField("User ID :hash:", userDoc._id, true)
        .addField("Incident :writing_hand:", incident)
        .addField("Rules Broken :1234:", rulesBroken, true)
        .addField("Moderator Action :technologist:", modAction, true)
        .addField("Date :calendar_spiral:", date, true)
        .addField("Entry ID :book:", record['id'], true)
        .setColor(modActionColors[record.modAction])


    if (modAction.toLowerCase() === "formal warning") {
        userDoc = await userCollection.findOneAndUpdate({"_id": userID}, {$inc: {"warnings": 1}}, {returnOriginal: false})
        const ns = numSuffix[userDoc.value.warnings - 1]
        const warningEmbed = new Discord.MessageEmbed()
            .setDescription(`**Note:** ${userDoc.value.userTag} is on their ${userDoc.value.warnings}${ns} formal warning.`)
        return [entryEmbed, warningEmbed]
    }
    else if (modAction.toLowerCase() === "ban") {
        userDoc = await userCollection.findOneAndUpdate({"_id": userID}, {$set: {banned: true}})
        const banEmbed = new Discord.MessageEmbed()
            .setDescription(`**Note:** the mod team has decided to ban ${userDoc.value.userTag}.`)
        return [entryEmbed, banEmbed]
    }
    return [entryEmbed]
}

const getEntries = async (args) => {
    const userID = args[0]
    const userDoc = await userCollection.findOne({"_id": userID})
    if (!userDoc) return ["Uh oh, failed to find that userID in the database :("]
    const user = await client.users.fetch(userID)
    const response = []
    const userTag = `${user.username}#${user.discriminator}`
    response.push(`**I have retrieved the following entries for the user ${userTag} from my database:**`)
    for (const record of userDoc['records']) {
        console.log(record)
        record.modAction = record.modAction.split(' ').map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ')
        const embed = new Discord.MessageEmbed()
            .addField('Incident :writing_hand:', record['incident'])
            .addField('Rules Broken :1234:', record['rulesBroken'], true)
            .addField('Moderator Action :technologist:', record['modAction'], true)
            .addField('Date :calendar_spiral:', record['date'], true)
            .addField('Entry ID :book:', record['id'], true)
            .setColor(modActionColors[record.modAction])
        await response.push(embed)
    }
    return response
}

const deleteEntry = async (args) => {
    const userID = args[0]
    const entryID = parseInt(args[1])
    const userDoc = await userCollection.findOne({"_id": userID})
    const record = userDoc.records.find(entry => entry.id === entryID)
    if (!record) return `Oops, I could not find an entry with id ${entryID} in my database.`
    const update = {$pull:{ "records": {"id": entryID}}}
    if (record.modAction.toLowerCase() === "formal warning")
        update.$inc = {"warnings": -1}
    const updatedInfo = await userCollection.updateOne({"_id": userID}, update)
    console.log(updatedInfo)
    return "I have removed the selected entry from my database!"
}

const editEntry = async (args) => {
    const userID = args[0]
    const entryID = parseInt(args[1])
    let entryField = args[2].toLowerCase()
    if (entryField === "moderator action" || entryField === "mod action") entryField = "modAction"
    else if (entryField === "rules broken") entryField = "rulesBroken"
    else if (entryField.includes("user") || entryField.includes("entry") || entryField.includes("number"))
        return "Oops, cannot edit that field."

    let newValue = args[3]

    const update = {$set: {}}

    update.$set[`records.$[record].${entryField}`] = newValue
    const options = {arrayFilters: [{"record.id": entryID}], returnOriginal: false}

    const userDoc = await userCollection.findOne({"_id": userID})
    const record = userDoc.records.find(entry => entry.id === entryID)

    if (entryField === "modAction") {
        newValue = newValue.split(" ")
        const words = []
        for (const word of newValue) {
            words.push(word.charAt(0).toUpperCase() + word.slice(1))
        }
        newValue = words.join("")
        if (record.modAction.toLowerCase() === "formal warning") {
            if (newValue !== "Formal Warning") {
                update.$inc = {}
                update.$inc['warnings'] = -1
            }
        }
        else {
            if (newValue === "Formal Warning") {
                update.$inc = {}
                update.$inc['warnings'] = 1
            }
        }
    }

    const updated = await userCollection.findOneAndUpdate({"_id": userID}, update, options)
    const updatedRecord = updated.value.records.find(entry => entry.id === entryID)

    const updatedEmbed = new Discord.MessageEmbed()
        .addField("User :bust_in_silhouette:", updated.value.userTag, true)
        .addField("User ID :hash:", updated._id, true)
        .addField('Incident :writing_hand:', updatedRecord['incident'])
        .addField('Rules Broken :1234:', updatedRecord['rulesBroken'], true)
        .addField('Moderator Action :technologist:', updatedRecord['modAction'], true)
        .addField('Date :calendar_spiral:', updatedRecord['date'])
        .addField('Entry ID :book:', updatedRecord['id'], true)
        .setColor(modActionColors[updatedRecord.modAction])
    return ["Entry updated!", updatedEmbed]
}

const sendMessageEmbeds = (channel, embeds) => {
    setTimeout(() => {
        for (const embed of embeds) {
            console.log("embed:")
            console.log(embed)
            channel.send(embed)
        }
    }, 100)
}

client.login(process.env.TOKEN).then();

module.exports = {recordEntry, getEntries, deleteEntry, editEntry, sendMessageEmbeds}