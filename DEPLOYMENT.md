# Deployment

This project supports two deployment modes:

- Railway: single Docker image / single container from `Dockerfile.railway`
- VPS: Docker Compose for the existing multi-service setup

## Rules

- Use Docker on a VPS.
- Do not deploy to Vercel.
- Keep secrets in `.env` only.
- Do not commit `.env` or the SQLite database.
- Keep OpenClaw outside the Railway image.

## Railway

Railway runs both the bot and the CMS in one container.

### Dockerfile

- Use `Dockerfile.railway` as the build file.
- Railway should inject the public `PORT` for the CMS.
- The bot always listens on `127.0.0.1:8788` inside the container.

### Environment

Required runtime variables:

- `DB_PATH=/data/forex-bot.db`
- `NEXT_PUBLIC_BOT_API_URL=http://127.0.0.1:8788`
- `PORT` provided by Railway for the CMS public port
- `USE_POLLING=true`
- Telegram and any other bot secrets already used by the app

Attach a persistent Railway volume at:

- `/data`

The shared SQLite database and related runtime files live there. Back up the volume regularly, including:

- `forex-bot.db`
- `forex-bot.db-wal`
- `forex-bot.db-shm`

Do not put OpenClaw into this image.

## VPS / Compose

Use Docker Compose for local VPS deployments and keep the existing two-container layout there.

```bash
docker compose config
docker compose build
docker compose up -d
```

## Notes

- The bot is a long-running process because it uses cron, polling, and SQLite.
- The CMS is the editorial surface.
- Google Sheets is legacy optional only.
- Telegram alerting now includes T-30, T+0, and after-actual drafts. The writing destination is optional and can be disabled by leaving `TELEGRAM_WRITING_CHAT_ID` blank.
- Macro discovery intentionally omits the optional Apify country filter and fetches all actor-supported countries. The `importances: 'high'` filter and the narrow `APIFY_MACRO_DAYS_AHEAD` window remain the cost controls.
- If you change the database location, update `DB_PATH` for both services.


## Container images (GHCR)

Published images (after CI/manual push):

- `ghcr.io/baderzakaria/forex-bot-v2:latest` — Telegram bot + crons
- `ghcr.io/baderzakaria/forex-bot-v2-cms:latest` — Next.js CMS

Pull and run via `docker compose` on a VPS with a persistent `./data` volume. Do not use Vercel (no always-on crons / SQLite / polling).
