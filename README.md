# Discord JS Subtitle Bot

This is a Discord bot that joins a voice channel, listens to the conversation, and posts transcriptions in a selected text channel using OpenAI's Whisper API.

## Version

Current version: v1.1.0


## Features

- Joins a voice channel and listens to conversations.
- Transcribes audio using OpenAI's Whisper API.
- Posts transcriptions in a selected text channel.
- Allows users to select the text channel using buttons or commands.
- Provides a settings menu to configure transcription parameters.

## Setup

### Prerequisites

- Node.js and npm installed
- Discord bot token
- OpenAI API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/lissizza/discord-js-subtitle-bot.git
   cd discord-js-subtitle-bot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory of the project and add your Discord bot token and OpenAI API key:

   ```env
   DISCORD_TOKEN=your_discord_token
   OPENAI_API_KEY=your_openai_api_key
   ```

### Running the Bot

1. Start the bot with a specified text channel (optional):

   ```bash
   npm start your_channel_name
   ```

   If no channel is specified, the bot will post messages in the `#general` channel.

## Usage

### Commands

- `!menu`: Displays the main menu with options to join, leave, change the text channel, and access settings.
- `!join`: Joins the voice channel.
- `!leave`: Leaves the voice channel.
- `!set_text_channel`: Displays buttons to select a new text channel for transcriptions.
- `!settings`: Displays the settings menu to configure transcription parameters.

### Buttons

- **Join**: Joins the voice channel.
- **Leave**: Leaves the voice channel.
- **Change Text Channel**: Displays buttons to select a new text channel for transcriptions.
- **Settings**: Displays the settings menu to configure transcription parameters.
- **Minimal Speech Duration**: Configures the minimum duration of speech to be transcribed.
- **Sample Rate**: Configures the audio sample rate.
- **Audio Channels Count**: Configures the number of audio channels.
- **Silence Duration**: Configures the duration of silence to end the recording.
- **Whisper Temperature**: Configures the temperature parameter for the Whisper API.
- **Whisper Language**: Configures the language parameter for the Whisper API.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Discord.js](https://discord.js.org/)
- [@discordjs/voice](https://github.com/discordjs/voice)
- [OpenAI Whisper API](https://beta.openai.com/docs/api-reference/whisper)
