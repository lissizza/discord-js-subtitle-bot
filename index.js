const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();
const { handleInteractionCreate, handleMessageCreate } = require('./discordInteractions');
const { generateDependencyReport } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const TOKEN = process.env.DISCORD_TOKEN;

async function setupBot() {
    console.log(generateDependencyReport());
    client.once('ready', onReady);
    client.on('interactionCreate', handleInteractionCreate);
    client.on('messageCreate', handleMessageCreate);
    client.login(TOKEN);
}

async function onReady() {
    console.log(`Logged in as ${client.user.tag}`);
    const guilds = client.guilds.cache;
    guilds.forEach(async (guild) => {
        await require('./discordInteractions').sendInitialMessage(guild);
    });
}

setupBot();
