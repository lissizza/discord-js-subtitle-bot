const WHISPER_SETTINGS = {
    temperature: 0.5,
    language: 'en',
    targetLanguage: 'en'
};

const AUDIO_SETTINGS = {
    MIN_DURATION: 1.0,
    SAMPLE_RATE: 48000,
    CHANNELS: 1,
    SILENCE_DURATION: 100,
    BYTES_PER_SAMPLE: 2
};

let MODE = 'transcribe';

const MODEL = {
    TRANSLATION_MODEL: 'gpt-3.5-turbo',
    TRANSCRIPTION_MODEL: 'whisper-1'
};

module.exports = {
    WHISPER_SETTINGS,
    AUDIO_SETTINGS,
    MODE,
    MODEL
};
