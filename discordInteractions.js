const { joinVoice, leaveVoice } = require('./audioProcessing');
const { WHISPER_SETTINGS, AUDIO_SETTINGS } = require('./config');
const {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
    createInitialMenuButtons,
    createChannelSelectionMenu,
    createUserSelectionMenu,
    showChannelSelectionMenu,
    showUserSelectionMenu,
    showSettings,
} = require('./visualElements');

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
}

async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === 'select_channel') {
        await handleChannelSelection(interaction);
    } else if (interaction.customId === 'select_user') {
        await handleUserSelection(interaction);
    }
}

async function updateSettings(interaction, setting, newValue) {
    console.log(`Received new value for setting ${setting}: ${newValue}`);

    if (AUDIO_SETTINGS.hasOwnProperty(setting)) {
        AUDIO_SETTINGS[setting] = parseFloat(newValue);
    } else if (WHISPER_SETTINGS.hasOwnProperty(setting)) {
        WHISPER_SETTINGS[setting] = setting === 'language' ? newValue : parseFloat(newValue);
    } else {
        await interaction.reply({ content: 'Unknown setting.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: `${SETTINGS.AUDIO[setting] || SETTINGS.WHISPER[setting]} set to ${newValue}`, ephemeral: true });
}

async function handleJoin(interaction) {
    if (interaction.member.voice.channel) {
        await joinVoice(interaction.member, selectedTextChannels);
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
    await joinVoice(message.member, selectedTextChannels);
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
    } else if (message.content.startsWith('!transcribe')) {
        await handleTranscribeCommand(message);
    } else if (message.content === '!settings') {
        await showSettings(message);
    }
}

async function handleTranscribeCommand(message) {
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

module.exports = {
    handleInteractionCreate,
    handleMessageCreate,
    sendInitialMessage,
};
