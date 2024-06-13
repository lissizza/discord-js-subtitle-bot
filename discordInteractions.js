const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    StringSelectMenuBuilder,
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const {
    WHISPER_SETTINGS,
    MIN_DURATION,
    SAMPLE_RATE,
    CHANNELS,
    BYTES_PER_SAMPLE,
    SILENCE_DURATION,
} = require('./config');
const { sendTranscriptionRequest } = require('./whisperSettings');
const {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
    createInitialMenuButtons,
    createChannelSelectionMenu,
    createUserSelectionMenu,
} = require('./visualElements');

let selectedTextChannels = []; // Array to hold selected channels and users
let connection = null;

async function handleInteractionCreate(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    try {
        if (interaction.isButton()) {
            if (interaction.customId === 'join') {
                await handleJoin(interaction);
            } else if (interaction.customId === 'leave') {
                await handleLeave(interaction);
            } else if (interaction.customId === 'change_channel') {
                await showChannelSelectionMenu(interaction);
            } else if (interaction.customId === 'change_user') {
                await showUserSelectionMenu(interaction);
            } else if (interaction.customId === 'settings') {
                await showSettings(interaction);
            } else if (interaction.customId.startsWith('update_')) {
                const setting = interaction.customId.substring(7);
                console.log(`Received update request for setting: ${setting}`);
                const defaultValue = getSettingsValue(setting);
                console.log(`Updating setting ${setting} with default value: ${defaultValue}`);
                if (!defaultValue) {
                    console.error(`No default value for setting ${setting}`);
                } else {
                    const modal = createSettingsModal(setting, defaultValue);
                    await interaction.showModal(modal);
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_channel') {
                await handleChannelSelection(interaction);
            } else if (interaction.customId === 'select_user') {
                await handleUserSelection(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            const setting = interaction.customId.substring(9);
            const newValue = interaction.fields.getTextInputValue(`input_${setting}`);
            await updateSettings(interaction, setting, newValue);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
        }
    }
}

async function updateSettings(interaction, setting, newValue) {
    console.log(`Received new value for setting ${setting}: ${newValue}`);

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
            await interaction.reply({ content: `Audio Channels Count set to ${CHANNELS}`, ephemeral: true });
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

async function joinVoice(member) {
    if (!member.voice.channel) {
        member.send('You need to join a voice channel first!');
        return;
    }

    if (selectedTextChannels.length === 0) {
        member.send('Please select a text channel for transcription using !transcribe #channel or !transcribe @username');
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
                    const transcription = await sendTranscriptionRequest(Buffer.concat(audioBuffer), user, selectedTextChannels, WHISPER_SETTINGS, member.guild);
                    if (transcription) {
                        for (const target of selectedTextChannels) {
                            if (target.type === 'channel') {
                                await target.value.send(`${user.username}: ${transcription}`);
                            } else if (target.type === 'user') {
                                await target.value.send(`${user.username}: ${transcription}`);
                            }
                        }
                    } else {
                        console.log('No transcription available.');
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

async function handleChannelSelection(interaction) {
    const channelId = interaction.values[0];
    const selectedChannel = interaction.guild.channels.cache.get(channelId);

    if (selectedChannel) {
        selectedTextChannels.push({ type: 'channel', value: selectedChannel });
        await interaction.reply({ content: `Selected channel: ${selectedChannel.name}`, ephemeral: true });
    } else {
        await interaction.reply({ content: 'Channel selection failed.', ephemeral: true });
    }
}

async function handleUserSelection(interaction) {
    const userId = interaction.values[0];
    const selectedUser = interaction.guild.members.cache.get(userId);

    if (selectedUser) {
        selectedTextChannels.push({ type: 'user', value: selectedUser.user });
        await interaction.reply({ content: `Selected user: ${selectedUser.user.username}`, ephemeral: true });
    } else {
        await interaction.reply({ content: 'User selection failed.', ephemeral: true });
    }
}

async function handleJoin(interaction) {
    if (interaction.member.voice.channel) {
        await joinVoice(interaction.member);
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
    await joinVoice(message.member);
    message.reply('Joined the voice channel.');
}

async function handleLeaveCommand(message) {
    leaveVoice(message.guild.id);
    message.reply('Disconnected from the voice channel.');
}

async function sendInitialMessage(channel) {
    const row = createInitialMenuButtons();
    await channel.send({ content: 'Bot is ready. Select an action:', components: [row] });
}

async function showChannelSelectionMenu(interaction) {
    const textChannels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);
    const row = createChannelSelectionMenu(textChannels);
    await interaction.reply({ content: 'Select the text channel to post transcriptions:', components: [row], ephemeral: true });
}

async function showUserSelectionMenu(interaction) {
    const members = interaction.guild.members.cache.filter(member => !member.user.bot);
    const row = createUserSelectionMenu(members);
    await interaction.reply({ content: 'Select the user to send transcriptions to:', components: [row], ephemeral: true });
}

async function showSettings(interaction) {
    const rows = createSettingsButtons();
    await interaction.reply({ content: 'Select a setting to update:', components: rows, ephemeral: true });
}

async function handleMessageCreate(message) {
    if (message.content === '!menu') {
        await sendInitialMessage(message.channel);
    } else if (message.content === '!join') {
        await handleJoinCommand(message);
    } else if (message.content === '!leave') {
        await handleLeaveCommand(message);
    } else if (message.content.startsWith('!transcribe')) {
        const args = message.content.split(' ');
        const target = args[1];

        if (target.startsWith('<#')) {
            const channelId = target.slice(2, -1);
            const textChannel = message.guild.channels.cache.get(channelId);
            if (textChannel) {
                selectedTextChannels.push({ type: 'channel', value: textChannel });
                message.reply(`Selected channel for transcription: ${textChannel.name}`);
            } else {
                message.reply('Channel not found.');
            }
        } else if (target.startsWith('<@')) {
            const userId = target.slice(2, -1);
            const user = await message.client.users.fetch(userId);
            if (user) {
                selectedTextChannels.push({ type: 'user', value: user });
                message.reply(`Selected user for transcription: ${user.username}`);
            } else {
                message.reply('User not found.');
            }
        } else {
            message.reply('Invalid target for transcription.');
        }
    } else if (message.content === '!settings') {
        await showSettings(message);
    }
}

module.exports = {
    handleInteractionCreate,
    handleMessageCreate,
    sendInitialMessage,
};
