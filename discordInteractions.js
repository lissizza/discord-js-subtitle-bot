const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { sendTranscriptionRequest } = require('./whisperSettings');
const {
    WHISPER_SETTINGS,
    MIN_DURATION,
    SAMPLE_RATE,
    CHANNELS,
    BYTES_PER_SAMPLE,
    SILENCE_DURATION,
} = require('./config');
const { createSettingsModal, getSettingsValue } = require('./visualElements');

let selectedTextChannel = null;
let connection = null;

// Получение аргумента канала из командной строки
const args = process.argv.slice(2);
const startChannelName = args.length > 0 ? args[0] : 'general';

async function handleInteractionCreate(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    if (interaction.isButton()) {
        if (interaction.customId === 'join') {
            await handleJoin(interaction);
        } else if (interaction.customId === 'leave') {
            await handleLeave(interaction);
        } else if (interaction.customId === 'change_channel') {
            await showChannelSelection(interaction);
        } else if (interaction.customId === 'settings') {
            await showSettings(interaction);
        } else if (interaction.customId.startsWith('select_')) {
            await handleChannelSelection(interaction);
        } else if (interaction.customId.startsWith('update_')) {
            const setting = interaction.customId.split('_')[1];
            const modal = createSettingsModal(setting, getSettingsValue(setting));
            await interaction.showModal(modal);
        }
    } else if (interaction.isModalSubmit()) {
        const setting = interaction.customId.split('_')[1];
        const newValue = interaction.fields.getTextInputValue(`input_${setting}`);

        // Update the settings based on the interaction
        switch (setting) {
            case 'MIN_DURATION':
                MIN_DURATION = parseFloat(newValue);
                await interaction.reply({ content: `Minimal Speech Duration set to ${MIN_DURATION}`, ephemeral: true });
                break;
            case 'SAMPLE_RATE':
                SAMPLE_RATE = parseInt(newValue);
                await interaction.reply({ content: `Sample Rate set to ${SAMPLE_RATE}`, ephemeral: true });
                break;
            case 'CHANNELS':
                CHANNELS = parseInt(newValue);
                await interaction.reply({ content: `Channels set to ${CHANNELS}`, ephemeral: true });
                break;
            case 'SILENCE_DURATION':
                SILENCE_DURATION = parseInt(newValue);
                await interaction.reply({ content: `Silence Duration set to ${SILENCE_DURATION}`, ephemeral: true });
                break;
            case 'temperature':
                WHISPER_SETTINGS.temperature = parseFloat(newValue);
                await interaction.reply({ content: `Whisper Temperature set to ${WHISPER_SETTINGS.temperature}`, ephemeral: true });
                break;
            case 'language':
                WHISPER_SETTINGS.language = newValue;
                await interaction.reply({ content: `Whisper Language set to ${WHISPER_SETTINGS.language}`, ephemeral: true });
                break;
            // Add other settings as needed
            default:
                await interaction.reply({ content: 'Unknown setting.', ephemeral: true });
        }
    }
}

async function handleMessageCreate(message) {
    if (message.content === '!menu') {
        await sendInitialMessage(message.guild);
    } else if (message.content.startsWith('!join')) {
        await handleJoinCommand(message);
    } else if (message.content === '!leave') {
        await handleLeaveCommand(message);
    } else if (message.content.startsWith('!change_channel')) {
        await showChannelSelection(message);
    } else if (message.content === '!settings') {
        await showSettings(message);
    } else if (message.content.startsWith('!set')) {
        const args = message.content.split(' ');
        const setting = args[1];
        const value = args[2];

        // Update the settings based on the command
        switch (setting) {
            case 'MIN_DURATION':
                MIN_DURATION = parseFloat(value);
                message.reply(`Minimal Speech Duration set to ${MIN_DURATION}`);
                break;
            case 'SAMPLE_RATE':
                SAMPLE_RATE = parseInt(value);
                message.reply(`Sample Rate set to ${SAMPLE_RATE}`);
                break;
            case 'CHANNELS':
                CHANNELS = parseInt(value);
                message.reply(`Channels set to ${CHANNELS}`);
                break;
            case 'SILENCE_DURATION':
                SILENCE_DURATION = parseInt(value);
                message.reply(`Silence Duration set to ${SILENCE_DURATION}`);
                break;
            case 'temperature':
                WHISPER_SETTINGS.temperature = parseFloat(value);
                message.reply(`Whisper Temperature set to ${WHISPER_SETTINGS.temperature}`);
                break;
            case 'language':
                WHISPER_SETTINGS.language = value;
                message.reply(`Whisper Language set to ${WHISPER_SETTINGS.language}`);
                break;
            // Add other settings as needed
            default:
                message.reply('Unknown setting.');
        }
    }
}

// Functions to handle voice channel interactions
async function joinVoice(member) {
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
        const user = await member.client.users.fetch(userId);
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
                    await sendTranscriptionRequest(Buffer.concat(audioBuffer), user, selectedTextChannel, WHISPER_SETTINGS);
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

// Functions to handle specific actions
async function handleChannelSelection(interaction) {
    const channelId = interaction.customId.split('_')[1];
    selectedTextChannel = interaction.guild.channels.cache.get(channelId);

    if (selectedTextChannel) {
        await interaction.reply({ content: `Selected channel: ${selectedTextChannel.name}`, ephemeral: true });
    } else {
        await interaction.reply({ content: 'Channel selection failed.', ephemeral: true });
    }
}

async function handleJoin(interaction) {
    if (interaction.member.voice.channel) {
        joinVoice(interaction.member);
        await interaction.reply({ content: 'Joined the voice channel!', ephemeral: true });
    } else {
        await interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
    }
}

async function handleLeave(interaction) {
    leaveVoice(interaction.guild.id);
    await interaction.reply({ content: 'Disconnected from the voice channel.', ephemeral: true });
}

async function handleJoinCommand(message) {
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
}

async function handleLeaveCommand(message) {
    leaveVoice(message.guild.id);
    message.reply('Disconnected from the voice channel.');
}

// Utility functions
async function sendInitialMessage(guild) {
    const targetChannel = guild.channels.cache.find(channel => channel.name === startChannelName && channel.type === ChannelType.GuildText) ||
        guild.channels.cache.find(channel => channel.name === 'general' && channel.type === ChannelType.GuildText);

    if (targetChannel) {
        selectedTextChannel = targetChannel;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join')
                .setLabel('Join')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('leave')
                .setLabel('Leave')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('change_channel')
                .setLabel('Change Channel')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('settings')
                .setLabel('Settings')
                .setStyle(ButtonStyle.Secondary)
        );

        await targetChannel.send({ content: 'Bot is ready. Select an action:', components: [row] });
    } else {
        console.log('Target channel not found');
    }
}

async function showChannelSelection(interaction) {
    const textChannels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);
    const rows = [];

    let row = new ActionRowBuilder();
    textChannels.forEach((channel, index) => {
        if (row.components.length === 5) {
            rows.push(row);
            row = new ActionRowBuilder();
        }

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`select_${channel.id}`)
                .setLabel(channel.name)
                .setStyle(ButtonStyle.Primary)
        );
    });

    if (row.components.length > 0) {
        rows.push(row);
    }

    await interaction.reply({ content: 'Select the text channel to post transcriptions:', components: rows, ephemeral: true });
}

async function showSettings(interaction) {
    const components = [
        new ButtonBuilder()
            .setCustomId('update_MIN_DURATION')
            .setLabel('Minimal Speech Duration')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update_SAMPLE_RATE')
            .setLabel('Sample Rate')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update_CHANNELS')
            .setLabel('Channels')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update_SILENCE_DURATION')
            .setLabel('Silence Duration')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update_temperature')
            .setLabel('Whisper Temperature')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('update_language')
            .setLabel('Whisper Language')
            .setStyle(ButtonStyle.Primary)
    ];

    const rows = [];
    for (let i = 0; i < components.length; i += 5) {
        const row = new ActionRowBuilder().addComponents(components.slice(i, i + 5));
        rows.push(row);
    }

    await interaction.reply({ content: 'Select a setting to update:', components: rows, ephemeral: true });
}

module.exports = {
    handleInteractionCreate,
    handleMessageCreate,
    sendInitialMessage,
};
