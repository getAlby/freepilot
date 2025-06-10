# Alby Freepilot

A GitHub bot that implements issues by reading repository context, understanding requirements, and creating pull requests with the necessary code changes. The bot is currently triggered through a web interface where users can paste GitHub issue URLs.

[Try it now](https://freepilot.fly.dev/)

## Development

### Prerequisites

1. Install [Goose](https://block.github.io/goose/docs/quickstart/)
2. NodeJS and Yarn
3. A dedicated Github account to run the bot (similar to [`freepilot-bot`](https://github.com/freepilot-bot))

### Local Git Setup

#### Option 1: docker

See docker instructions at the bottom of this file.

#### Option 2: local

> NOTE: you are trusting the agent to run in "auto" mode which is potentially dangerous.

See [this gist](https://gist.github.com/jexchan/2351996) for setting up multiple SSH keys and [this gist](https://gist.github.com/Icaruk/f024a18093dc28ec1588cfb90efc32f7) for setting up multiple git profiles

The `WORK_DIR` should have a `.gitconfig` file so that all work done by the bot is using a separate profile.

### Backend

```bash
cd backend
```

Setup your environment variables:

```bash
cp backend/.env.example backend/.env
```

Run the app

```bash
yarn install
yarn start
```

### Frontend

```bash
cd frontend
yarn install
yarn dev
```

## Docker

> Make sure the `SSH_PRIVATE_KEY_BASE64` env variable is in base64 format: `base64 -w 0 id_rsa > id_rsa.b64`

    $ docker build . -t freepilot-local --progress=plain
    $ docker run -v $(pwd)/.data/docker:/data -e WORK_DIR='/data' -e DATABASE_URL='file:/data/freepilot.db' -e GITHUB_TOKEN="ghp_..." -e OPENROUTER_API_KEY="sk-or-v1-..." -e SSH_PRIVATE_KEY_BASE64="XXXXXXX" -e SSH_PUBLIC_KEY="XXXXXXX" -p 3001:3001 freepilot-local
