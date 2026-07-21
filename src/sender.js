import db from './db.js';
import config from './config.js';
import {
  claimNext,
  markSent,
  markFailed,
  markDeadLetter,
  isPaused,
  setSetting,
  getBoolSetting,
} from './outbox.js';
import { sendMessage } from './telegram.js';
import { scheduleAutoPublish } from './approval.js';

export async function processSender() {
  const row = claimNext();
  if (!row) return false;

  if (row.destination_type === 'telegram_writing' && (config.writingChatDisabled || getBoolSetting('telegram_writing_disabled', false))) {
    markDeadLetter(row.id, new Error('Writing destination disabled'));
    return true;
  }

  if (isPaused() && row.destination_type !== 'telegram_admin') {
    // Don't send non-admin messages when paused, but don't lose them
    db.prepare(`UPDATE outbox SET status = 'pending', scheduled_at = ? WHERE id = ?`)
      .run(new Date(Date.now() + 60000).toISOString(), row.id);
    return true;
  }

  try {
    const result = await sendMessage(row.destination_id, row.content_text, {
      replyMarkup: row.reply_markup,
    });
    const messageId = result.result?.message_id;

    // If published to public/writing, update post status
    if (row.post_id && row.content_version && (row.destination_type === 'telegram_public' || row.destination_type === 'telegram_writing')) {
      db.prepare(`UPDATE posts SET status = 'published', publish_chat_id = ?, publish_message_id = ?, updated_at = datetime('now')
        WHERE post_id = ? AND version = ? AND status IN ('approved', 'drafted')`)
        .run(row.destination_id, String(messageId || ''), row.post_id, row.content_version);
    }

    markSent(row.id, messageId);

    // Schedule auto-publish after admin preview
    if (row.destination_type === 'telegram_admin' && row.reply_markup && row.post_id && row.content_version && config.autoApprove && config.autoPublish) {
      scheduleAutoPublish(row.post_id, row.content_version, row.destination_id);
    }
  } catch (err) {
    const delay = Math.min(300000, 5000 * Math.pow(2, Math.max(0, (row.attempts || 0) - 1)));
    console.error('[sender] failed', row.dedupe_key, err.message);
    if (isChatNotFoundError(err)) {
      if (row.destination_type === 'telegram_writing') {
        setSetting('telegram_writing_disabled', 'true');
      }
      markDeadLetter(row.id, err);
      return true;
    }
    markFailed(row.id, err, delay);
  }
  return true;
}

function isChatNotFoundError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('chat not found');
}
