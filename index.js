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

const MIN_DURATION = 1.0; // minimum duration in seconds
const SAMPLE_RATE = 48000; // audio sample rate
const CHANNELS = 1; // number of audio channels
const BYTES_PER_SAMPLE = 2; // bytes per sample
const SILENCE_DURATION = 100; // duration of silence to end the recording

(async () => {
    console.log(generateDependencyReport());

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);

        const guilds = client.guilds.cache;
        guilds.forEach(async (guild) => {
            const channel = guild.channels.cache.find(channel => channel.name === 'general' && channel.type === ChannelType.GuildText);

            if (channel) {
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
