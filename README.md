# Discord JS Subtitle Bot

This is a Discord bot that joins a voice channel, listens to the conversation, and posts transcriptions in a selected text channel using OpenAI's Whisper API.

## Features

- Joins a voice channel and listens to conversations.
- Transcribes audio using OpenAI's Whisper API.
- Posts transcriptions in a selected text channel.
- Allows users to select the text channel using buttons or commands.

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

1. Start the bot:

   ```bash
   npm start
   ```

2. The bot will log in and send a message in the `#general` channel of each server it is part of, asking users to select a text channel for posting transcriptions.

## Usage

### Commands

- `!join #channel`: Selects the text channel to post transcriptions and joins the voice channel.
- `!leave`: Leaves the voice channel.

### Buttons

- **Join**: Joins the voice channel.
- **Leave**: Leaves the voice channel.
- **Text Channel Buttons**: Selects the text channel to post transcriptions.


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Discord.js](https://discord.js.org/)
- [@discordjs/voice](https://github.com/discordjs/voice)
- [OpenAI Whisper API](https://beta.openai.com/docs/api-reference/whisper)
