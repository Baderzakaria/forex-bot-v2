#!/usr/bin/env bash
set -euo pipefail

BOT_PORT=8788
CMS_PORT="${PORT:-3000}"
DATA_PATH="${DB_PATH:-/data/forex-bot.db}"

bot_pid=""
cms_pid=""

shutdown() {
  if [[ -n "${cms_pid}" ]] && kill -0 "${cms_pid}" 2>/dev/null; then
    kill "${cms_pid}" 2>/dev/null || true
  fi
  if [[ -n "${bot_pid}" ]] && kill -0 "${bot_pid}" 2>/dev/null; then
    kill "${bot_pid}" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit 0
}

trap shutdown INT TERM HUP

PORT="${BOT_PORT}" DB_PATH="${DATA_PATH}" USE_POLLING=true node /app/src/index.js &
bot_pid=$!

PORT="${CMS_PORT}" DB_PATH="${DATA_PATH}" NEXT_PUBLIC_BOT_API_URL=http://127.0.0.1:8788 node /app/cms/server.js &
cms_pid=$!

wait -n "${bot_pid}" "${cms_pid}"

kill "${cms_pid}" 2>/dev/null || true
kill "${bot_pid}" 2>/dev/null || true
wait 2>/dev/null || true
exit 1
