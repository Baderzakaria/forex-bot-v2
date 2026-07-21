#!/bin/bash
set -e
V1_DIR="/home/bader/Desktop/forex-telegram-control-room"
cd "$V1_DIR"

echo "Exporting from v1 PostgreSQL..."

docker compose exec -T postgres psql -U forex_user -d forex_control -t -A -F'|' -c "
  SELECT post_id, version, kind, status, requested_by, admin_chat_id, request_text,
         draft_text, llm_model, metadata::text, publish_chat_id, publish_message_id,
         lock_version, created_at, updated_at
  FROM posts_log WHERE status IN ('drafted', 'approved', 'published')
  ORDER BY created_at DESC LIMIT 200
" > /tmp/v1_posts.csv

docker compose exec -T postgres psql -U forex_user -d forex_control -t -A -F'|' -c "
  SELECT key, value FROM control_room_settings
" > /tmp/v1_settings.csv

echo "Exported $(wc -l < /tmp/v1_posts.csv) posts, $(wc -l < /tmp/v1_settings.csv) settings"
