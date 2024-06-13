const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { WHISPER_SETTINGS, AUDIO_SETTINGS } = require('./config');

const SETTINGS = {
    AUDIO: {
        MIN_DURATION: 'Minimal Speech Duration',
        SAMPLE_RATE: 'Sample Rate',
        CHANNELS: 'Audio Channels Count',
        SILENCE_DURATION: 'Silence Duration',
        BYTES_PER_SAMPLE: 'Bytes Per Sample'
    },
    WHISPER: {
        temperature: 'Whisper Temperature',
        language: 'Whisper Language'
    }
};

// Create a modal to input settings
const createSettingsModal = (setting, currentValue) => {
    let title = SETTINGS.AUDIO[setting] || SETTINGS.WHISPER[setting];

    return new ModalBuilder()
        .setCustomId(`settings_${setting}`)
        .setTitle(`Update ${title}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`input_${setting}`)
                    .setLabel(`New value for ${title}`)
                    .setValue(currentValue)
                    .setStyle(TextInputStyle.Short)
            )
        );
};

const getSettingsValue = (setting) => {
    console.log(`Getting value for setting: ${setting}`);
    const settingValues = {
        ...AUDIO_SETTINGS,
        ...WHISPER_SETTINGS
    };

    return settingValues[setting] ? settingValues[setting].toString() : '';
};

// Create buttons for settings
const createSettingsButtons = () => {
    const audioSettingsComponents = Object.keys(SETTINGS.AUDIO).map(setting => 
        new ButtonBuilder()
            .setCustomId(`update_${setting}`)
            .setLabel(SETTINGS.AUDIO[setting])
            .setStyle(ButtonStyle.Primary)
    );

    const whisperSettingsComponents = Object.keys(SETTINGS.WHISPER).map(setting => 
        new ButtonBuilder()
            .setCustomId(`update_${setting}`)
            .setLabel(SETTINGS.WHISPER[setting])
            .setStyle(ButtonStyle.Primary)
    );

    const audioSettingsRow = new ActionRowBuilder().addComponents(audioSettingsComponents);
    const whisperSettingsRow = new ActionRowBuilder().addComponents(whisperSettingsComponents);

    return [audioSettingsRow, whisperSettingsRow];
};

const createInitialMenuButtons = () => {
    return new ActionRowBuilder().addComponents(
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
            .setLabel('Select Text Channel')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('change_user')
            .setLabel('Select User')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
    );
};

const createChannelSelectionMenu = (textChannels) => {
    const options = textChannels.map(channel => ({
        label: channel.name,
        value: channel.id,
    }));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_channel')
            .setPlaceholder('Select a text channel')
            .addOptions(options)
    );
};

const createUserSelectionMenu = (members) => {
    const options = members.map(member => ({
        label: member.user.username,
        value: member.id,
    }));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_user')
            .setPlaceholder('Select a user')
            .addOptions(options)
    );
};

const showChannelSelectionMenu = async (interaction) => {
    const textChannels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);
    const row = createChannelSelectionMenu(textChannels);
    await interaction.reply({ content: 'Select the text channel to post transcriptions:', components: [row], ephemeral: true });
};

const showUserSelectionMenu = async (interaction) => {
    const members = interaction.guild.members.cache.filter(member => !member.user.bot);
    const row = createUserSelectionMenu(members);
    await interaction.reply({ content: 'Select the user to send transcriptions to:', components: [row], ephemeral: true });
};

const showSettings = async (interaction) => {
    const rows = createSettingsButtons();
    await interaction.reply({ content: 'Select a setting to update:', components: rows, ephemeral: true });
};

module.exports = {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
    createInitialMenuButtons,
    createChannelSelectionMenu,
    createUserSelectionMenu,
    showChannelSelectionMenu,
    showUserSelectionMenu,
    showSettings,
};
