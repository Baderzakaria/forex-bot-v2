# Forex Bot CMS

Next.js CMS for `forex-bot-v2`.

## What it does

- Reads and writes the shared SQLite database.
- Shows bot health, event queues, drafts, and settings.
- Acts as the primary editorial surface for the project.

## Runtime

- CMS port: `3000`
- Shared DB path: `DB_PATH=/data/forex-bot.db`
- Bot API URL inside Docker: `NEXT_PUBLIC_BOT_API_URL=http://bot:8788`

## Local dev

```bash
npm install
npm run dev
```

## Docker build

```bash
npm run build
```

Google Sheets support is legacy optional only. If the relevant env vars are unset, the CMS and bot still work without it.

