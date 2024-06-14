const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();
const ISO6391 = require('iso-639-1');
const { MODEL, WHISPER_SETTINGS } = require('./config');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to validate ISO-639-1 language codes and 'auto'
const isValidISO6391 = (code) => ISO6391.validate(code) || code === 'auto';

async function sendTranscriptionRequest(audioBuffer, user, selectedTextChannels, settings, guild) {
    const form = new FormData();
    form.append('model', MODEL.TRANSCRIPTION_MODEL);
    form.append('file', audioBuffer, {
        contentType: 'audio/wav',
        filename: 'audio.wav'
    });

    // Add Whisper settings to the form
    for (const [key, value] of Object.entries(settings.WHISPER_SETTINGS)) {
        // Validate language setting
        if ((key === 'language' || key === 'targetLanguage') && !isValidISO6391(value)) {
            const warningMessage = `**Error:** Invalid language '${value}'. Language parameter must be specified in ISO-639-1 format or 'auto' for automatic language detection.`;
            for (const target of selectedTextChannels) {
                if (target.type === 'channel' && target.value.guild.id === guild.id) {
                    await target.value.send(`${user.username}: ${warningMessage}`);
                } else if (target.type === 'user') {
                    await target.value.send(`${user.username}: ${warningMessage}`);
                }
            }
            return;
        }
        // Append setting to form if language is not 'auto'
        if (!(key === 'language' && value === 'auto')) {
            form.append(key, value);
        }
    }

    const headers = {
        ...form.getHeaders(),
        'Authorization': `Bearer ${OPENAI_API_KEY}`
    };

    try {
        console.log('Sending transcription request...');
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, { headers });

        if (response.data && response.data.text) {
            const transcription = response.data.text.trim();
            console.log(`Transcription: ${transcription}`);
            const content = settings.MODE === 'translate'
                ? `**Original:** ${transcription}\n**Translation:** ${await translateText(transcription, settings.WHISPER_SETTINGS.targetLanguage, user, selectedTextChannels, guild)}`
                : transcription;

            console.log(`Final message: ${content}`);
            for (const target of selectedTextChannels) {
                if (target.type === 'channel' && target.value.guild.id === guild.id) {
                    await target.value.send(`${user.username}: ${content}`);
                } else if (target.type === 'user') {
                    await target.value.send(`${user.username}: ${content}`);
                } else {
                    console.log('No valid text channel or user selected.');
                }
            }
        } else {
            console.error('Transcription response does not contain text:', response.data);
        }
    } catch (error) {
        console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data && error.response.data.error) {
            const errorMessage = error.response.data.error.message;
            const warningMessage = `**Error:** ${errorMessage}`;
            for (const target of selectedTextChannels) {
                if (target.type === 'channel' && target.value.guild.id === guild.id) {
                    await target.value.send(`${user.username}: ${warningMessage}`);
                } else if (target.type === 'user') {
                    await target.value.send(`${user.username}: ${warningMessage}`);
                }
            }
        }
    }
}

async function translateText(text, targetLanguage, user, selectedTextChannels, guild) {
    const data = {
        model: MODEL.TRANSLATION_MODEL,
        messages: [
            { role: 'system', content: 'Translate the following text.' },
            { role: 'user', content: `Translate to ${targetLanguage}: ${text}` }
        ],
        max_tokens: 100
    };

    const headers = {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('Sending translation request...');
        const response = await axios.post('https://api.openai.com/v1/chat/completions', data, { headers });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const translation = response.data.choices[0].message.content.trim();
            console.log(`Translation: ${translation}`);
            return translation;
        } else {
            console.error('Translation response does not contain valid data:', response.data);
            return '**Translation error**';
        }
    } catch (error) {
        console.error('Error translating text:', error.response ? error.response.data : error.message);
        return '**Translation error**';
    }
}

module.exports = {
    sendTranscriptionRequest,
};
