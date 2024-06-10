const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, generateDependencyReport } = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

(async () => {
    console.log(generateDependencyReport());

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);

        // Find the #general channel
        const guilds = client.guilds.cache;
        guilds.forEach(async (guild) => {
            const channel = guild.channels.cache.find(channel => channel.name === 'general' && channel.type === ChannelType.GuildText);

            if (channel) {
                // Create buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('join')
                            .setLabel('Join')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('leave')
                            .setLabel('Leave')
                            .setStyle(ButtonStyle.Danger),
                    );

                // Send message with buttons
                await channel.send({ content: 'Use the buttons below to control the bot:', components: [row] });
            } else {
                console.log('Channel #general not found');
            }
        });
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'join') {
            if (interaction.member.voice.channel) {
                const connection = joinVoiceChannel({
                    channelId: interaction.member.voice.channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                connection.on('stateChange', (oldState, newState) => {
                    if (oldState.status === 'ready' && newState.status === 'connecting') {
                        console.log('The bot has connected to the channel!');
                    }
                });

                const receiver = connection.receiver;

                receiver.speaking.on('start', async userId => {
                    const user = await client.users.fetch(userId);
                    const audioStream = receiver.subscribe(userId, {
                        end: {
                            behavior: EndBehaviorType.AfterSilence,
                            duration: 100,
                        },
                    });

                    const pcmStream = audioStream.pipe(new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 }));
                    const wavStream = new PassThrough();
                    const ffmpeg = require('fluent-ffmpeg');

                    const ffmpegProcess = ffmpeg(pcmStream)
                        .inputFormat('s16le')
                        .audioFrequency(48000)
                        .audioChannels(1)
                        .toFormat('wav')
                        .on('error', (err) => {
                            console.error('Error processing audio:', err);
                        })
                        .pipe(wavStream);

                    const form = new FormData();
                    form.append('model', 'whisper-1');
                    form.append('file', wavStream, {
                        contentType: 'audio/wav',
                        filename: 'audio.wav'
                    });

                    const headers = {
                        ...form.getHeaders(),
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    };

                    try {
                        console.log('Sending transcription request...');
                        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, { headers });

                        if (response.data && response.data.text) {
                            console.log(`Transcription: ${response.data.text}`);
                            interaction.channel.send(`${user.username}: ${response.data.text}`);
                        } else {
                            console.error('Transcription response does not contain text:', response.data);
                        }
                    } catch (error) {
                        console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
                    }
                });

                await interaction.reply({ content: 'Joined the voice channel!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            }
        } else if (interaction.customId === 'leave') {
            const connection = getVoiceConnection(interaction.guild.id);
            if (connection) {
                connection.destroy();
                await interaction.reply({ content: 'Disconnected from the voice channel.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'I am not in a voice channel!', ephemeral: true });
            }
        }
    });

    client.login(TOKEN);
})();
