const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function sendTranscriptionRequest(audioBuffer, user, selectedTextChannels, settings, guild) {
    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('file', audioBuffer, {
        contentType: 'audio/wav',
        filename: 'audio.wav'
    });

    for (const [key, value] of Object.entries(settings.WHISPER_SETTINGS)) {
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
            console.log(`Current mode: ${settings.MODE}`);

            if (settings.MODE === 'translate') {
                console.log('Sending translation request...');
                try {
                    const translationResponse = await axios.post(
                        'https://api.openai.com/v1/chat/completions',
                        {
                            model: 'gpt-3.5-turbo',
                            messages: [
                                { role: 'system', content: 'You are a helpful assistant.' },
                                { role: 'user', content: `Translate the following text to ${settings.WHISPER_SETTINGS.targetLanguage}: ${transcription}` }
                            ],
                            max_tokens: 100
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${OPENAI_API_KEY}`
                            }
                        }
                    );

                    if (translationResponse.data && translationResponse.data.choices) {
                        const translation = translationResponse.data.choices[0].message.content.trim();
                        console.log(`Translation: ${translation}`);

                        const content = `**Original:** ${transcription}\n**Translation:** ${translation}`;

                        for (const target of selectedTextChannels) {
                            if (target.type === 'channel') {
                                await target.value.send(content);
                            } else if (target.type === 'user') {
                                await target.value.send(content);
                            }
                        }
                    } else {
                        console.error('Translation response does not contain translations:', translationResponse.data);
                    }
                } catch (error) {
                    console.error('Error translating text:', error.response ? error.response.data : error.message);
                }
            } else {
                const content = transcription;
                for (const target of selectedTextChannels) {
                    if (target.type === 'channel') {
                        await target.value.send(content);
                    } else if (target.type === 'user') {
                        await target.value.send(content);
                    }
                }
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
