const WHISPER_SETTINGS = {
    temperature: 0.5,
    language: 'en',
};

let AUDIO_SETTINGS = {
    MIN_DURATION: 1.0,
    SAMPLE_RATE: 48000,
    CHANNELS: 1,
    SILENCE_DURATION: 100,
    BYTES_PER_SAMPLE: 2
};

module.exports = {
    WHISPER_SETTINGS,
    AUDIO_SETTINGS
};
