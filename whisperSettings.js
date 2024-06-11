const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function sendTranscriptionRequest(audioBuffer, user, selectedTextChannel, WHISPER_SETTINGS, guild) {
    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('file', audioBuffer, {
        contentType: 'audio/wav',
        filename: 'audio.wav'
    });

    // Add Whisper settings to the form
    for (const [key, value] of Object.entries(WHISPER_SETTINGS)) {
        form.append(key, value);
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
            if (selectedTextChannel && selectedTextChannel.guild.id === guild.id) {
                selectedTextChannel.send({ content: `${user.username}: ${transcription}`, ephemeral: true });
            } else {
                console.log('No text channel selected or not on the same server.');
            }
        } else {
            console.error('Transcription response does not contain text:', response.data);
        }
    } catch (error) {
        console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
    }
}

module.exports = {
    sendTranscriptionRequest,
};
