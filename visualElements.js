const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { WHISPER_SETTINGS, MIN_DURATION, SAMPLE_RATE, CHANNELS, SILENCE_DURATION } = require('./config');

// Create a modal to input settings
const createSettingsModal = (setting, currentValue) => {
    return new ModalBuilder()
        .setCustomId(`settings_${setting}`)
        .setTitle(`Update ${setting}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`input_${setting}`)
                    .setLabel(`New value for ${setting}`)
                    .setValue(currentValue)
                    .setStyle(TextInputStyle.Short)
            )
        );
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

module.exports = {
    createSettingsModal,
    getSettingsValue,
};
