# forex-bot-v2

Telegram bot plus CMS for forex publishing and macro-event operations.

## Architecture

- Bot: long-running Node process with cron, polling, Telegram integration, and SQLite.
- CMS: Next.js admin surface for editing, monitoring, and ops.
- Storage: shared SQLite database under `./data` when running on a VPS or in Docker.

This is not a Vercel deployment. The app needs an always-on Docker host because it relies on:

- `node-cron`
- SQLite file access
- long-lived Telegram polling and background loops

CMS is the primary editorial surface. Google Sheets is optional legacy support only.

## Quick Start

1. Copy `.env.example` to `.env` and fill in secrets.
2. Build and validate the compose stack:

```bash
docker compose config
docker compose build
```

3. Start the services:

```bash
docker compose up -d
```

4. Open the services:

- Bot health: `http://localhost:8788/health`
- CMS: `http://localhost:3000`

## Ports

- Bot: `8788`
- CMS: `3000`

## Environment

Set secrets only in `.env`. Do not commit it.

Required bot variables include:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_PUBLIC_CHAT_ID`
- `TELEGRAM_ALLOWED_USER_IDS`

Common runtime variables:

- `PORT=8788`
- `DB_PATH=/data/forex-bot.db`
- `NODE_ENV=production`
- `USE_POLLING=true`

CMS reads the shared database from `DB_PATH` and proxies bot health from `NEXT_PUBLIC_BOT_API_URL=http://bot:8788` inside Docker.

If you inspect the CMS from a browser outside Docker networking, use the host-accessible bot URL for any browser-side assumptions. The internal container hostname is only for server-to-server traffic.

Legacy Sheets variables are optional and only needed if you keep the old workflow enabled.

## Build Commands

- `docker compose config`
- `docker compose build`
- `docker compose up -d`
- `docker compose logs -f bot`
- `docker compose logs -f cms`

