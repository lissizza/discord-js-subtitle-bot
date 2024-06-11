const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    switch (setting) {
        case 'MIN_DURATION':
            return MIN_DURATION.toString();
        case 'SAMPLE_RATE':
            return SAMPLE_RATE.toString();
        case 'CHANNELS':
            return CHANNELS.toString();
        case 'SILENCE_DURATION':
            return SILENCE_DURATION.toString();
        case 'temperature':
            return WHISPER_SETTINGS.temperature.toString();
        case 'language':
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

module.exports = {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
};
