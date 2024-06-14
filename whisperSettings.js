const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();
const ISO6391 = require('iso-639-1');
const { readConfig } = require('./config');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to validate ISO-639-1 language codes and 'auto'
const isValidISO6391 = (code) => ISO6391.validate(code) || code === 'auto';

async function sendTranscriptionRequest(audioBuffer, user, selectedTextChannels, settings, guild) {
    const config = readConfig();
    const form = new FormData();
    form.append('model', config.MODEL.TRANSCRIPTION_MODEL);
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

            let content = transcription;
            console.log('Current mode:', config.MODE);
            if (config.MODE === 'translate') {
                const translation = await translateText(transcription, config.WHISPER_SETTINGS.targetLanguage);
                content = `**Original:** ${transcription}\n**Translation:** ${translation}`;
            }

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

async function translateText(text, targetLanguage) {
    const config = readConfig();
    const data = {
        model: config.MODEL.TRANSLATION_MODEL,
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: `Translate the following text to ${targetLanguage}: ${text}` }
        ],
        max_tokens: 100
    };

    const headers = {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log('Sending translation request with data:', JSON.stringify(data, null, 2));
        const response = await axios.post('https://api.openai.com/v1/chat/completions', data, { headers });
        console.log('Translation response:', response.data);
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error translating text:', error.response ? error.response.data : error.message);
        return '**Translation error**';
    }
}

module.exports = {
    sendTranscriptionRequest,
};
