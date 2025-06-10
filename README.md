# Alby Freepilot

A GitHub bot that implements issues by reading repository context, understanding requirements, and creating pull requests with the necessary code changes. The bot is currently triggered through a web interface where users can paste GitHub issue URLs.

## Development

copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

### Docker

> Make sure the `SSH_PRIVATE_KEY_BASE64` env variable is in base64 format: `base64 -w 0 id_rsa > id_rsa.b64`

    $ docker build . -t freepilot-local --progress=plain
    $ docker run -v $(pwd)/.data/docker:/data -e WORK_DIR='/data' -e DATABASE_URL='file:/data/freepilot.db' -e GITHUB_TOKEN="ghp_..." -e OPENROUTER_API_KEY="sk-or-v1-..." -e SSH_PRIVATE_KEY_BASE64="XXXXXXX" -e SSH_PUBLIC_KEY="XXXXXXX" -p 3001:3001 freepilot-local
