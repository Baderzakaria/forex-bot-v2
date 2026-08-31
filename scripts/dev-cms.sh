#!/usr/bin/env bash
# Stable local CMS bring-up for forex-bot-v2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMS="$ROOT/cms"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
DB_PATH="${DB_PATH:-$ROOT/data/forex-bot.db}"

cd "$CMS"

# Free only THIS app's next on PORT (not other projects)
if command -v ss >/dev/null 2>&1; then
  PIDS="$(ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)"
  for pid in $PIDS; do
    if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "forex-bot-v2/cms"; then
      echo "Stopping forex CMS pid $pid on :$PORT"
      kill "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
fi

# Stale turbopack cache often leaves Next accepting TCP but hanging on HTTP
if [[ "${CLEAN_NEXT:-0}" == "1" ]]; then
  echo "Clearing $CMS/.next"
  rm -rf "$CMS/.next"
fi

export DB_PATH
echo "Starting CMS DB_PATH=$DB_PATH host=$HOST port=$PORT"
exec npm run dev -- -H "$HOST" -p "$PORT"
