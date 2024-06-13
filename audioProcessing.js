const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { sendTranscriptionRequest } = require('./whisperSettings');
const { AUDIO_SETTINGS } = require('./config');

let connection = null;

async function joinVoice(member, selectedTextChannels) {
    if (!member.voice.channel) {
        member.send('You need to join a voice channel first!');
        return;
    }

    leaveVoice(member.guild.id);

    connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: member.guild.id,
        adapterCreator: member.guild.voiceAdapterCreator,
    });

    connection.on('stateChange', (oldState, newState) => {
        if (oldState.status === 'ready' && newState.status === 'connecting') {
            console.log('The bot has connected to the channel!');
        }
    });

    const receiver = connection.receiver;

    receiver.speaking.on('start', async userId => {
        const user = await member.client.users.fetch(userId);

        if (selectedTextChannels.length > 0) {
            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: AUDIO_SETTINGS.SILENCE_DURATION,
                },
            });

            const pcmStream = audioStream.pipe(new prism.opus.Decoder({ 
                rate: AUDIO_SETTINGS.SAMPLE_RATE, 
                channels: AUDIO_SETTINGS.CHANNELS, 
                frameSize: 960 
            }));
            const wavStream = new PassThrough();

            const audioBuffer = [];
            let duration = 0;

            const ffmpegProcess = ffmpeg(pcmStream)
                .inputFormat('s16le')
                .audioFrequency(AUDIO_SETTINGS.SAMPLE_RATE)
                .audioChannels(AUDIO_SETTINGS.CHANNELS)
                .toFormat('wav')
                .on('error', (err) => {
                    console.error('Error processing audio:', err);
                })
                .on('end', async () => {
                    if (duration > AUDIO_SETTINGS.MIN_DURATION) {
                        await sendTranscriptionRequest(Buffer.concat(audioBuffer), user, selectedTextChannels, AUDIO_SETTINGS);
                    } else {
                        console.log('Audio is too short to transcribe.');
                    }
                })
                .pipe(wavStream);

            wavStream.on('data', chunk => {
                audioBuffer.push(chunk);
                duration += chunk.length / (AUDIO_SETTINGS.SAMPLE_RATE * AUDIO_SETTINGS.BYTES_PER_SAMPLE * AUDIO_SETTINGS.CHANNELS);
            });
        } else {
            console.log('No text channel or user selected for transcription.');
        }
    });
}

function leaveVoice(guildId) {
    const conn = getVoiceConnection(guildId);
    if (conn) {
        conn.destroy();
    }
    connection = null;
}

module.exports = {
    joinVoice,
    leaveVoice,
};
