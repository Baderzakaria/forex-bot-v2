# Railway environment checklist (safe template)

Copy these into Railway → Variables.  
**Do not paste real secrets into git.** Fill values from your local `.env` in the Railway UI only.

## Required

| Variable | Example / notes |
|----------|-----------------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | Admin group/channel id (negative for groups) |
| `TELEGRAM_PUBLIC_CHAT_ID` | Public publish destination |
| `TELEGRAM_ALLOWED_USER_IDS` | Comma-separated numeric user ids |
| `APIFY_TOKEN` | Apify API token |
| `DB_PATH` | `/data/forex-bot.db` |
| `USE_POLLING` | `true` |
| `NODE_ENV` | `production` |

Railway sets `PORT` automatically (CMS listens on it). Bot stays on internal `8788`.

Also set in Railway (or rely on image defaults):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_BOT_API_URL` | `http://127.0.0.1:8788` |

Attach a **volume** mounted at `/data`.

## Optional but recommended

| Variable | Default / notes |
|----------|-----------------|
| `TELEGRAM_WRITING_CHAT_ID` | Leave blank to disable writing chat |
| `TELEGRAM_WRITING_DISABLED` | `false` |
| `AUTO_APPROVE` | `true` / `false` |
| `AUTO_PUBLISH_TELEGRAM` | `true` / `false` |
| `AUTO_APPROVE_GRACE_SECONDS` | `90` |
| `PRE_ALERT_MINUTES` | `30` |
| `RELEASE_ALERT_ENABLED` | `true` (T+0) |
| `ACTUAL_ALERT_ENABLED` | `true` |
| `ACTUAL_LOOKBACK_MINUTES` | `120` |
| `ACTUAL_REFRESH_MINUTES` | `5` |
| `APIFY_ACTOR_ID` | `pintostudio/economic-calendar-data-investing-com` |
| `APIFY_MACRO_COUNTRIES` | e.g. `united states, united kingdom, germany, canada, australia, japan, new zealand` |
| `APIFY_MACRO_DAYS_AHEAD` | `7` |
| `ZAI_API_KEY` | Optional LLM |
| `ZAI_BASE_URL` | `https://api.z.ai/api/paas/v4` |
| `LLM_MODEL` | `glm-4.5-flash` |
| `SERPER_API_KEY` | Optional CMS research |
| `TAVILY_API_KEY` | Optional CMS research |

## Legacy (skip unless you still use Sheets)

- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_URL`
- `GOOGLE_OAUTH_TOKEN_PATH`
- `GOOGLE_OAUTH_CREDENTIALS_PATH`

## Not for Railway

- OpenClaw / Jarvis — keep off this service for now
- Do not put local absolute paths from your laptop into Railway

## After deploy

1. Open the public CMS URL  
2. Settings / Social → confirm Telegram chat ids  
3. Use **Send test** from CMS  
4. Watch admin Telegram for T-30 / T+0 / actual drafts  
