const WHISPER_SETTINGS = {
    temperature: 0.9,
    language: 'en',
    suppress_tokens: '-1'
};

const MIN_DURATION = 1.0;
const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;
const SILENCE_DURATION = 100;

module.exports = {
    WHISPER_SETTINGS,
    MIN_DURATION,
    SAMPLE_RATE,
    CHANNELS,
    BYTES_PER_SAMPLE,
    SILENCE_DURATION,
};
