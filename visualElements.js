const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { WHISPER_SETTINGS, MIN_DURATION, SAMPLE_RATE, CHANNELS, SILENCE_DURATION } = require('./config');

// Create a modal to input settings
const createSettingsModal = (setting, currentValue) => {
    let title = getSettingsTitle(setting);

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

// Get title for settings
const getSettingsTitle = (setting) => {
    switch (setting) {
        case 'MIN_DURATION':
            return 'Minimal Speech Duration';
        case 'SAMPLE_RATE':
            return 'Sample Rate';
        case 'CHANNELS':
            return 'Audio Channels Count';
        case 'SILENCE_DURATION':
            return 'Silence Duration';
        case 'temperature':
            return 'Whisper Temperature';
        case 'language':
            return 'Whisper Language';
        default:
            return setting;
    }
};

const getSettingsValue = (setting) => {
    console.log(`Getting value for setting: ${setting}`);
    switch (setting) {
        case 'MIN_DURATION':
            console.log(`Getting value for MIN_DURATION: ${MIN_DURATION}`);
            return MIN_DURATION.toString();
        case 'SAMPLE_RATE':
            console.log(`Getting value for SAMPLE_RATE: ${SAMPLE_RATE}`);
            return SAMPLE_RATE.toString();
        case 'CHANNELS':
            console.log(`Getting value for CHANNELS: ${CHANNELS}`);
            return CHANNELS.toString();
        case 'SILENCE_DURATION':
            console.log(`Getting value for SILENCE_DURATION: ${SILENCE_DURATION}`);
            return SILENCE_DURATION.toString();
        case 'temperature':
            console.log(`Getting value for temperature: ${WHISPER_SETTINGS.temperature}`);
            return WHISPER_SETTINGS.temperature.toString();
        case 'language':
            console.log(`Getting value for language: ${WHISPER_SETTINGS.language}`);
            return WHISPER_SETTINGS.language;
        default:
            return '';
    }
};

// Create buttons for settings
const createSettingsButtons = () => {
    const settings = [
        { id: 'MIN_DURATION', label: 'Minimal Speech Duration' },
        { id: 'SAMPLE_RATE', label: 'Sample Rate' },
        { id: 'CHANNELS', label: 'Audio Channels Count' },
        { id: 'SILENCE_DURATION', label: 'Silence Duration' },
        { id: 'temperature', label: 'Whisper Temperature' },
        { id: 'language', label: 'Whisper Language' },
    ];

    const components = settings.map(setting => 
        new ButtonBuilder()
            .setCustomId(`update_${setting.id}`)
            .setLabel(setting.label)
            .setStyle(ButtonStyle.Primary)
    );

    const rows = [];
    for (let i = 0; i < components.length; i += 5) {
        const row = new ActionRowBuilder().addComponents(components.slice(i, i + 5));
        rows.push(row);
    }

    return rows;
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
            .setLabel('Change Text Channel')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('change_user')
            .setLabel('Change User')
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

module.exports = {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
    createInitialMenuButtons,
    createChannelSelectionMenu,
    createUserSelectionMenu,
};
