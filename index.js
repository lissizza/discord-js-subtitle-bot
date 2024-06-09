const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, generateDependencyReport } = require('@discordjs/voice');
const fs = require('fs');
const prism = require('prism-media');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const sodium = require('libsodium-wrappers');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const TOKEN = fs.readFileSync('discord_token.txt', 'utf-8').trim();
const OPENAI_API_KEY = fs.readFileSync('openai_api_key.txt', 'utf-8').trim();

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Ensure recordings directory exists
const path = './recordings';
if (!fs.existsSync(path)){
    fs.mkdirSync(path);
}

(async () => {
    await sodium.ready;
    console.log(generateDependencyReport());

    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);

        // Найти канал #general
        const guilds = client.guilds.cache;
        guilds.forEach(async (guild) => {
            const channel = guild.channels.cache.find(channel => channel.name === 'general' && channel.type === ChannelType.GuildText);

            if (channel) {
                // Создать кнопки
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

                // Отправить сообщение с кнопками
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
                    const pcmPath = `./recordings/${user.username}-${Date.now()}.pcm`;
                    const wavPath = pcmPath.replace('.pcm', '.wav');

                    const audioStream = receiver.subscribe(userId, {
                        end: {
                            behavior: EndBehaviorType.AfterSilence,
                            duration: 100,
                        },
                    });

                    const pcmStream = audioStream.pipe(new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 }));
                    const fileStream = fs.createWriteStream(pcmPath);

                    pcmStream.pipe(fileStream);

                    fileStream.on('finish', () => {
                        ffmpeg(pcmPath)
                            .inputFormat('s16le')
                            .audioFrequency(48000)
                            .audioChannels(1)
                            .toFormat('wav')
                            .save(wavPath)
                            .on('end', async () => {
                                try {
                                    const audioData = fs.createReadStream(wavPath);
                                    const response = await openai.audio.transcriptions.create({
                                        model: 'whisper-1',
                                        file: audioData,
                                        response_format: 'json',
                                    });

                                    if (response.data && response.data.text) {
                                        interaction.channel.send(`${user.username}: ${response.data.text}`);
                                    } else {
                                        console.error('Transcription response does not contain text:', response);
                                    }
                                } catch (error) {
                                    console.error('Error transcribing audio:', error);
                                } finally {
                                    // fs.unlinkSync(pcmPath); // Uncomment if you want to delete the pcm file
                                    // fs.unlinkSync(wavPath); // Uncomment if you want to delete the wav file
                                }
                            });
                    });

                    fileStream.on('error', error => {
                        console.error('Error writing PCM file:', error);
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
