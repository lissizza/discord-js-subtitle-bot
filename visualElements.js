const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { WHISPER_SETTINGS, AUDIO_SETTINGS, MODE } = require('./config');
const ISO6391 = require('iso-639-1');

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
        language: 'Recognition Language',
        targetLanguage: 'Target Language'
    }
};

// Create a modal to input settings
const createSettingsModal = (setting, currentValue) => {
    const title = SETTINGS.AUDIO[setting] || SETTINGS.WHISPER[setting];

    return new ModalBuilder()
        .setCustomId(`settings_${setting}`)
        .setTitle(`Update ${title}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`input_${setting}`)
                    .setLabel(`Value for ${title}`)
                    .setValue(currentValue)
                    .setStyle(TextInputStyle.Short)
            )
        );
};

const getSettingsValue = (setting) => {
    console.log(`Getting value for setting: ${setting}`);
    const settingValues = {
        ...AUDIO_SETTINGS,
        ...WHISPER_SETTINGS,
        mode: MODE
    };

    return settingValues[setting] !== undefined ? settingValues[setting].toString() : '';
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

    const components = [...audioSettingsComponents, ...whisperSettingsComponents];
    const rows = [];
    
    for (let i = 0; i < components.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 5)));
    }

    return rows;
};

const createInitialMenuButtons = () => {
    const components = [
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
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('mode')
            .setLabel('Mode')
            .setStyle(ButtonStyle.Secondary)
    ];

    const rows = [];
    
    for (let i = 0; i < components.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 5)));
    }

    return rows;
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

const createTargetLanguageButton = () => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('update_targetLanguage')
            .setLabel('Target Language')
            .setStyle(ButtonStyle.Secondary)
    );
};

const showModeSelectionMenu = async (interaction) => {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('mode_select')
            .setPlaceholder('Select Mode')
            .addOptions([
                { label: 'Transcribe', value: 'transcribe' },
                { label: 'Translate', value: 'translate' }
            ])
    );
    await interaction.reply({ content: 'Select operation mode:', components: [row], ephemeral: true });
};

const showLanguageSelectionMenu = async (interaction, setting) => {
    const languages = [
        { label: 'English', value: 'en' },
        { label: 'Spanish', value: 'es' },
        { label: 'French', value: 'fr' },
        { label: 'German', value: 'de' },
        { label: 'Russian', value: 'ru' },
        { label: 'Chinese', value: 'zh' },
        { label: 'Portuguese', value: 'pt' },
        { label: 'Hindi', value: 'hi' },
        { label: 'Urdu', value: 'ur' },
        { label: 'Japanese', value: 'ja' },
        { label: 'Arabic', value: 'ar' },
        { label: 'Turkish', value: 'tr' },
        { label: 'Other Language', value: 'other' }
    ];

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`language_select_${setting}`)
            .setPlaceholder('Select a language')
            .addOptions(languages)
    );

    await interaction.reply({ content: 'Select a language:', components: [row], ephemeral: true });
};

module.exports = {
    createSettingsModal,
    getSettingsValue,
    createSettingsButtons,
    createInitialMenuButtons,
    showChannelSelectionMenu,
    showUserSelectionMenu,
    showSettings,
    createTargetLanguageButton,
    showModeSelectionMenu,
    showLanguageSelectionMenu,
    SETTINGS // Экспортируем SETTINGS
};
