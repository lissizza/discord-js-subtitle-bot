const { joinVoice, leaveVoice } = require('./audioProcessing');
const { readConfig, writeConfig } = require('./config');
const {
    createSettingsModal,
    getSettingsValue,
    createInitialMenuButtons,
    showChannelSelectionMenu,
    showUserSelectionMenu,
    showSettings,
    createTargetLanguageButton,
    showModeSelectionMenu,
    showLanguageSelectionMenu,
    SETTINGS
} = require('./visualElements');

const { sendTranscriptionRequest } = require('./whisperSettings');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

let selectedTextChannels = [];

async function handleInteractionCreate(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

    try {
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
            const setting = interaction.customId.substring(9);
            const newValue = interaction.fields.getTextInputValue(`input_${setting}`);
            await interaction.deferReply({ ephemeral: true });
            await updateSettings(interaction, setting, newValue);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
        }
    }
}

async function handleButtonInteraction(interaction) {
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
    } else if (interaction.customId === 'mode') {
        await showModeSelectionMenu(interaction);
    } else if (interaction.customId.startsWith('update_')) {
        const setting = interaction.customId.substring(7);
        if (setting === 'targetLanguage' || setting === 'language') {
            await showLanguageSelectionMenu(interaction, setting); // Pass the setting
        } else {
            const defaultValue = getSettingsValue(setting);
            if (!defaultValue) {
                console.error(`No default value for setting ${setting}`);
            } else {
                const modal = createSettingsModal(setting, defaultValue);
                await interaction.showModal(modal);
            }
        }
    }
}

async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === 'select_channel') {
        await handleChannelSelection(interaction);
    } else if (interaction.customId === 'select_user') {
        await handleUserSelection(interaction);
    } else if (interaction.customId === 'mode_select') {
        const newValue = interaction.values[0];
        await interaction.deferReply({ ephemeral: true });
        await updateSettings(interaction, 'mode', newValue);
    } else if (interaction.customId.startsWith('language_select')) {
        const setting = interaction.customId.split('_')[2]; // Get the specific setting
        const newValue = interaction.values[0];
        if (newValue === 'other') {
            const defaultValue = getSettingsValue(setting);
            const modal = createSettingsModal(setting, defaultValue);
            await interaction.showModal(modal);
        } else {
            await interaction.deferReply({ ephemeral: true });
            await updateSettings(interaction, setting, newValue); // Use the specific setting
        }
    }
}

async function updateSettings(interaction, setting, newValue) {
    console.log(`Received new value for setting ${setting}: ${newValue}`);

    const config = readConfig();

    if (config.AUDIO_SETTINGS.hasOwnProperty(setting)) {
        config.AUDIO_SETTINGS[setting] = parseFloat(newValue);
    } else if (config.WHISPER_SETTINGS.hasOwnProperty(setting)) {
        config.WHISPER_SETTINGS[setting] = newValue;
    } else if (setting === 'mode') {
        config.MODE = newValue;
        console.log(`Mode updated to: ${config.MODE}`);
        if (config.MODE === 'translate') {
            const row = createTargetLanguageButton();
            await interaction.followUp({ content: 'Set the target language for translation:', components: [row], ephemeral: true });
            writeConfig(config); // Write the updated config to file
            return;
        }
    } else {
        await interaction.followUp({ content: 'Unknown setting.', ephemeral: true });
        return;
    }
    writeConfig(config); // Write the updated config to file
    await interaction.followUp({ content: `${SETTINGS.AUDIO[setting] || SETTINGS.WHISPER[setting]} set to ${newValue}`, ephemeral: true });
}

async function handleJoin(interaction) {
    const config = readConfig();
    if (interaction.member.voice.channel) {
        await joinVoice(interaction.member, selectedTextChannels, config.MODE); // Pass MODE from config
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
    const config = readConfig();
    await joinVoice(message.member, selectedTextChannels, config.MODE); // Pass MODE from config
    message.reply('Joined the voice channel.');
}

async function handleLeaveCommand(message) {
    leaveVoice(message.guild.id);
    message.reply('Disconnected from the voice channel.');
}

async function sendInitialMessage(channel) {
    const rows = createInitialMenuButtons();
    await channel.send({ content: 'Bot is ready. Select an action:', components: rows });
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

async function handleMessageCreate(message) {
    if (message.content === '!menu') {
        await sendInitialMessage(message.channel);
    } else if (message.content === '!join') {
        await handleJoinCommand(message);
    } else if (message.content === '!leave') {
        await handleLeaveCommand(message);
    } else if (message.content.startsWith('!post')) {
        await handlePostCommand(message);
    } else if (message.content === '!settings') {
        await showSettings(message);
    } else if (message.content === '!debug') {
        await showDebugInfo(message);
    }
}

async function handlePostCommand(message) {
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
}

async function showDebugInfo(message) {
    const config = readConfig();
    const debugInfo = {
        WHISPER_SETTINGS: config.WHISPER_SETTINGS,
        AUDIO_SETTINGS: config.AUDIO_SETTINGS,
        MODE: config.MODE
    };
    message.reply(`\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``);
}

module.exports = {
    handleInteractionCreate,
    handleMessageCreate,
    sendInitialMessage,
};
