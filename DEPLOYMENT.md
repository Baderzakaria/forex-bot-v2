# Deployment

This project is deployed on an always-on VPS with Docker Compose.

## Rules

- Use Docker on a VPS.
- Do not deploy to Vercel.
- Keep secrets in `.env` only.
- Do not commit `.env` or the SQLite database.

## Services

- `bot` on port `8788`
- `cms` on port `3000`

## Data

The SQLite database and related runtime files live in the shared `data/` volume.

Back up the `data/` directory regularly. A useful backup is the entire directory, including:

- `forex-bot.db`
- `forex-bot.db-wal`
- `forex-bot.db-shm`

## Compose flow

```bash
docker compose config
docker compose build
docker compose up -d
```

## Notes

- The bot is a long-running process because it uses cron, polling, and SQLite.
- The CMS is the editorial surface.
- Google Sheets is legacy optional only.
- If you change the database location, update `DB_PATH` for both services.

