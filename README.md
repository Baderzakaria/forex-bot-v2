# forex-bot-v2

Telegram bot plus CMS for forex publishing and macro-event operations.

## Architecture

- Bot: long-running Node process with cron, polling, Telegram integration, and SQLite.
- CMS: Next.js admin surface for editing, monitoring, and ops.
- Storage: shared SQLite database under `./data` when running on a VPS or in Docker.
- Railway deploys both services in one container using `Dockerfile.railway`; keep OpenClaw outside that image.

This is not a Vercel deployment. The app needs an always-on Docker host because it relies on:

- `node-cron`
- SQLite file access
- long-lived Telegram polling and background loops

CMS is the primary editorial surface. Google Sheets is optional legacy support only.

Macro event alerts cover three stages in Telegram:

- T-30 pre-alert drafts
- T+0 release-time drafts
- after-actual follow-ups once data lands

Apify is called from two places:

- `cron-discover` at 07:00 UTC for the daily macro refresh
- `cron-actual-fetch` on the minute cron for due high-impact events with missing actuals
- `telegram-command` for `/calendar` and `/discover_calendar`

The minute cron stays SQLite-only for T-30 and T+0. It only calls Apify for targeted, one-shot actual fetches when a release-time event is due and still missing its actual.

Apify token handling:

- Leave `APIFY_TOKEN` blank, or set `APIFY_TOKEN_DISABLED` if you want to keep Apify off without re-enabling spend
- Morning full discovery remains the only daily scheduled macro refresh
- Actual fetches are targeted to due high-impact events only, never blanket refreshes
- Macro discovery omits the actor's optional country filter, so it covers all actor-supported countries. It remains high-impact only; keep `APIFY_MACRO_DAYS_AHEAD` narrow to control cost.

The Apify pipeline now rejects placeholder titles, missing event times, smoke/self-test rows, and other junk rows before anything is upserted or drafted.

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

For Railway, use the single-image path in `Dockerfile.railway` and mount a persistent volume at `/data`.

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

Telegram writing chat is optional. Leave `TELEGRAM_WRITING_CHAT_ID` blank if you do not want the bot to publish to a writing group.

## Build Commands

- `docker compose config`
- `docker compose build`
- `docker compose up -d`
- `docker compose logs -f bot`
- `docker compose logs -f cms`
