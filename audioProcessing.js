const { joinVoiceChannel, getVoiceConnection, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { sendTranscriptionRequest } = require('./whisperSettings');
const {
    WHISPER_SETTINGS,
    MIN_DURATION,
    SAMPLE_RATE,
    CHANNELS,
    BYTES_PER_SAMPLE,
    SILENCE_DURATION,
} = require('./config');

let connection = null;

async function joinVoice(member, selectedTextChannels) {
    if (!member.voice.channel) {
        member.send('You need to join a voice channel first!');
        return;
    }

    if (selectedTextChannels.length === 0) {
        member.send('Please select a text channel for transcription using !transcribe #channel or !transcribe @username');
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

        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: SILENCE_DURATION,
            },
        });

        const pcmStream = audioStream.pipe(new prism.opus.Decoder({ rate: SAMPLE_RATE, channels: CHANNELS, frameSize: 960 }));
        const wavStream = new PassThrough();

        const audioBuffer = [];
        let duration = 0;

        const ffmpegProcess = ffmpeg(pcmStream)
            .inputFormat('s16le')
            .audioFrequency(SAMPLE_RATE)
            .audioChannels(CHANNELS)
            .toFormat('wav')
            .on('error', (err) => {
                console.error('Error processing audio:', err);
            })
            .on('end', async () => {
                if (duration > MIN_DURATION) {
                    const transcription = await sendTranscriptionRequest(Buffer.concat(audioBuffer), user, selectedTextChannels, WHISPER_SETTINGS, member.guild);
                    if (transcription) {
                        for (const target of selectedTextChannels) {
                            if (target.type === 'channel') {
                                await target.value.send(`${user.username}: ${transcription}`);
                            } else if (target.type === 'user') {
                                await target.value.send(`${user.username}: ${transcription}`);
                            }
                        }
                    } else {
                        console.log('No transcription available.');
                    }
                } else {
                    console.log('Audio is too short to transcribe.');
                }
            })
            .pipe(wavStream);

        wavStream.on('data', chunk => {
            audioBuffer.push(chunk);
            duration += chunk.length / (SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS);
        });
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
