#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Free bot port if our process owns it
PORT="${PORT:-8788}"
if command -v ss >/dev/null 2>&1; then
  PIDS="$(ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)"
  for pid in $PIDS; do
    if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "forex-bot-v2"; then
      echo "Stopping forex bot pid $pid on :$PORT"
      kill "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
fi
exec node src/index.js
