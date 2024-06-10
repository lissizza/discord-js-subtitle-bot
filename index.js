const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, generateDependencyReport } = require('@discordjs/voice');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const FormData = require('form-data');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
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

const MIN_DURATION = 0.7; // minimum duration in seconds
const SAMPLE_RATE = 48000; // audio sample rate
const CHANNELS = 1; // number of audio channels
const BYTES_PER_SAMPLE = 2; // bytes per sample
const SILENCE_DURATION = 100; // duration of silence to end the recording

const WHISPER_SETTINGS = {
    temperature: 0.1, // Lower temperature reduces creativity and ensures more deterministic output
    language: 'en', // Specify the language, if known, to improve accuracy
    suppress_tokens: '-1' // Suppress tokens to avoid common issues, '-1' disables this feature
};

let selectedTextChannel = null;
let connection = null;

(async () => {
    console.log(generateDependencyReport());

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);

        const guilds = client.guilds.cache;
        guilds.forEach(async (guild) => {
            const textChannels = guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);
            const row = new ActionRowBuilder();

            textChannels.forEach(channel => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`select_${channel.id}`)
                        .setLabel(channel.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Danger)
            );

            const generalChannel = guild.channels.cache.find(channel => channel.name === 'general' && channel.type === ChannelType.GuildText);
            if (generalChannel) {
                await generalChannel.send({ content: 'Select the text channel to post transcriptions:', components: [row] });
            } else {
                console.log('Channel #general not found');
            }
        });
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId.startsWith('select_')) {
            const channelId = interaction.customId.split('_')[1];
            selectedTextChannel = interaction.guild.channels.cache.get(channelId);

            if (selectedTextChannel) {
                await interaction.reply({ content: `Selected channel: ${selectedTextChannel.name}`, ephemeral: true });
                joinVoice(interaction.member);
            } else {
                await interaction.reply({ content: 'Channel selection failed.', ephemeral: true });
            }

            return;
        }

        if (interaction.customId === 'join') {
            if (interaction.member.voice.channel) {
                joinVoice(interaction.member);
                await interaction.reply({ content: 'Joined the voice channel!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
            }
        } else if (interaction.customId === 'leave') {
            leaveVoice(interaction.guild.id);
            await interaction.reply({ content: 'Disconnected from the voice channel.', ephemeral: true });
        }
    });

    client.on('messageCreate', async message => {
        if (message.content.startsWith('!join')) {
            const args = message.content.split(' ');
            if (args.length !== 2) {
                message.reply('Usage: !join #channel');
                return;
            }

            const channelName = args[1].replace('#', '').trim();
            const textChannel = message.guild.channels.cache.find(channel => channel.name === channelName && channel.type === ChannelType.GuildText);
            if (textChannel) {
                selectedTextChannel = textChannel;
                await message.reply(`Selected channel: ${selectedTextChannel.name}`);
                joinVoice(message.member);
            } else {
                message.reply('Text channel not found.');
            }
        } else if (message.content === '!leave') {
            leaveVoice(message.guild.id);
            message.reply('Disconnected from the voice channel.');
        }
    });

    function joinVoice(member) {
        if (!member.voice.channel) {
            member.send('You need to join a voice channel first!');
            return;
        }

        leaveVoice(member.guild.id);

        connection = joinVoiceChannel({
            channelId: member.voice.channel.id,
            guildId: member.guild.id,
            adapterCreator: member.guild.voiceAdapterCreator,
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
                    duration: SILENCE_DURATION,
                },
            });

            const pcmStream = audioStream.pipe(new prism.opus.Decoder({ rate: SAMPLE_RATE, channels: CHANNELS, frameSize: 960 }));
            const wavStream = new PassThrough();

            const audioBuffer = [];
            let duration = 0;

            const ffmpegProcess = ffmpeg(pcmStream)
                .inputFormat('s16le')
                .audioFrequency(SAMPLE_RATE)
                .audioChannels(CHANNELS)
                .toFormat('wav')
                .on('error', (err) => {
                    console.error('Error processing audio:', err);
                })
                .on('end', async () => {
                    if (duration > MIN_DURATION) {
                        const form = new FormData();
                        form.append('model', 'whisper-1');
                        form.append('file', Buffer.concat(audioBuffer), {
                            contentType: 'audio/wav',
                            filename: 'audio.wav'
                        });

                        // Add Whisper settings to the form
                        for (const [key, value] of Object.entries(WHISPER_SETTINGS)) {
                            form.append(key, value);
                        }

                        const headers = {
                            ...form.getHeaders(),
                            'Authorization': `Bearer ${OPENAI_API_KEY}`
                        };

                        try {
                            console.log('Sending transcription request...');
                            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, { headers });

                            if (response.data && response.data.text) {
                                const transcription = response.data.text.trim();
                                console.log(`Transcription: ${transcription}`);
                                if (selectedTextChannel) {
                                    selectedTextChannel.send(`${user.username}: ${transcription}`);
                                } else {
                                    console.log('No text channel selected for transcription.');
                                }
                            } else {
                                console.error('Transcription response does not contain text:', response.data);
                            }
                        } catch (error) {
                            console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
                        }
                    } else {
                        console.log('Audio is too short to transcribe.');
                    }
                })
                .pipe(wavStream);

            wavStream.on('data', chunk => {
                audioBuffer.push(chunk);
                duration += chunk.length / (SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS);
            });
        });
    }

    function leaveVoice(guildId) {
        const conn = getVoiceConnection(guildId);
        if (conn) {
            conn.destroy();
        }
        connection = null;
    }

    client.login(TOKEN);
})();
