import db from './db.js';
import config from './config.js';
import { enqueue, getBoolSetting } from './outbox.js';
import { sendMessage } from './telegram.js';
import crypto from 'crypto';

export function createTokens(postId, version) {
  const expires = new Date(Date.now() + 1440 * 60 * 1000).toISOString();
  const tokens = {};
  for (const scope of ['approve', 'reject', 'edit']) {
    const token = crypto.randomBytes(6).toString('base64url');
    db.prepare(`INSERT INTO approval_tokens (token, post_id, version, action_scope, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .run(token, postId, version, scope, expires);
    tokens[scope] = token;
  }
  return tokens;
}

export function keyboard(tokens) {
  return {
    inline_keyboard: [
      [{ text: '✅ Approve now', callback_data: `ap:${tokens.approve}` }, { text: '❌ Reject', callback_data: `rj:${tokens.reject}` }],
      [{ text: '✏️ Edit', callback_data: `ed:${tokens.edit}` }, { text: '📋 Queue', callback_data: 'qu:pending' }],
    ],
  };
}

export function resolveToken(data) {
  const m = String(data || '').match(/^(ap|rj|ed):([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const scopes = { ap: 'approve', rj: 'reject', ed: 'edit' };
  const row = db.prepare(`
    SELECT * FROM approval_tokens
    WHERE token = ? AND action_scope = ? AND consumed_at IS NULL AND expires_at > datetime('now')
  `).get(m[2], scopes[m[1]]);
  return row || null;
}

export function executeApprovePublish(post, opts = {}) {
  const { actorUserId = 'system', actorUsername = 'auto-approve', adminChatId = config.adminChatId, confirmPrefix = '✅ Draft' } = opts;

  db.prepare(`UPDATE posts SET status = 'approved', updated_at = datetime('now'), lock_version = lock_version + 1
    WHERE post_id = ? AND version = ? AND status IN ('drafted', 'approved')`).run(post.post_id, post.version);

  const publicChat = config.publicChatId;
  const writingChat = config.writingChatId;
  const postToWriting = getBoolSetting('post_to_writing_on_approve', true);
  const writingDisabled = config.writingChatDisabled || getBoolSetting('telegram_writing_disabled', false);
  const targets = [];

  // Publish to public chat (same as admin is OK now)
  if (publicChat) {
    targets.push({ type: 'telegram_public', id: publicChat, label: 'public' });
  }
  if (postToWriting && writingChat && !writingDisabled && isUsableTelegramChatId(writingChat) && writingChat !== config.adminChatId) {
    targets.push({ type: 'telegram_writing', id: writingChat, label: 'writing group' });
  }

  for (const t of targets) {
    enqueue({
      dedupe_key: `${t.type}:${post.post_id}:${post.version}`,
      destination_type: t.type,
      destination_id: String(t.id),
      content_text: post.draft_text,
      post_id: post.post_id,
      content_version: post.version,
      created_by: actorUserId,
    });
  }

  const destNote = targets.length ? ` Queued for ${targets.map(t => t.label).join(' + ')}.` : '';
  const who = actorUsername === 'auto-approve' ? 'auto-approve timer' : `@${actorUsername || 'admin'}`;
  enqueue({
    dedupe_key: `admin:approve_confirm:${post.post_id}:${post.version}:${actorUsername || 'admin'}`,
    destination_type: 'telegram_admin',
    destination_id: String(adminChatId),
    content_text: `${confirmPrefix} ${post.post_id} v${post.version} (${who}).${destNote}`,
    post_id: post.post_id,
    content_version: post.version,
    created_by: actorUserId,
  });
}

function isUsableTelegramChatId(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.startsWith('@')) return text.length > 1;
  return /^-?\d+$/.test(text);
}

export function processApprovalCallback(tokenRow, userId, username, chatId) {
  const action = tokenRow.action_scope;
  const post = db.prepare(`SELECT * FROM posts WHERE post_id = ? AND version = ?`).get(tokenRow.post_id, tokenRow.version);
  if (!post) return { ok: false, error: 'Draft not found.' };
  if (post.status === 'published') return { ok: false, error: 'Already published.' };
  if (post.status === 'rejected' && action !== 'edit') return { ok: false, error: 'Draft was rejected.' };

  // Consume token
  const consumed = db.prepare(`UPDATE approval_tokens SET consumed_at = datetime('now'), consumed_by = ? WHERE id = ? AND consumed_at IS NULL`)
    .run(String(userId), tokenRow.id);
  if (!consumed.changes) return { ok: false, error: 'Token already used or expired.' };

  // Log action
  db.prepare(`INSERT INTO admin_actions (post_id, version, action, actor_user_id, actor_username, admin_chat_id, callback_data, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    tokenRow.post_id, tokenRow.version,
    action === 'edit' ? 'request_edit' : action,
    String(userId), username || 'unknown', String(chatId),
    `${action}:${tokenRow.token}`, '{}'
  );

  if (action === 'reject') {
    cancelAutoPublish(tokenRow.post_id, tokenRow.version, 'rejected');
    db.prepare(`UPDATE posts SET status = 'rejected', updated_at = datetime('now') WHERE post_id = ? AND version = ?`)
      .run(tokenRow.post_id, tokenRow.version);
    enqueue({
      dedupe_key: `admin:reject:${tokenRow.post_id}:${tokenRow.version}`,
      destination_type: 'telegram_admin', destination_id: String(chatId),
      content_text: `❌ Draft ${tokenRow.post_id} v${tokenRow.version} rejected by @${username || 'admin'}.`,
      post_id: tokenRow.post_id, content_version: tokenRow.version, created_by: userId,
    });
    return { ok: true, action: 'reject' };
  }

  if (action === 'edit') {
    cancelAutoPublish(tokenRow.post_id, tokenRow.version, 'edit_requested');
    db.prepare(`UPDATE posts SET status = 'drafted', updated_at = datetime('now') WHERE post_id = ? AND version = ?`)
      .run(tokenRow.post_id, tokenRow.version);
    enqueue({
      dedupe_key: `admin:edit_prompt:${tokenRow.post_id}:${tokenRow.version}:${userId}`,
      destination_type: 'telegram_admin', destination_id: String(chatId),
      content_text: `✏️ Send your edit instructions for ${tokenRow.post_id} v${tokenRow.version} (10 min window).`,
      created_by: userId,
    });
    return { ok: true, action: 'edit' };
  }

  // approve
  cancelAutoPublish(tokenRow.post_id, tokenRow.version, 'manual_approve');
  executeApprovePublish(post, { actorUserId: userId, actorUsername: username, adminChatId: chatId });
  return { ok: true, action: 'approve', draft_text: post.draft_text };
}

// Auto-approve
export function scheduleAutoPublish(postId, version, adminChatId) {
  if (!config.autoApprove || !config.autoPublish) return;
  const at = new Date(Date.now() + config.autoApproveGraceSeconds * 1000).toISOString();
  const meta = JSON.parse(db.prepare(`SELECT metadata FROM posts WHERE post_id = ? AND version = ?`).get(postId, version)?.metadata || '{}');
  meta.auto_publish_at = at;
  meta.auto_publish_cancelled = false;
  meta.auto_publish_admin_chat_id = String(adminChatId);
  db.prepare(`UPDATE posts SET metadata = ?, updated_at = datetime('now') WHERE post_id = ? AND version = ? AND status = 'drafted'`)
    .run(JSON.stringify(meta), postId, version);
}

export function cancelAutoPublish(postId, version, reason = 'manual') {
  const meta = JSON.parse(db.prepare(`SELECT metadata FROM posts WHERE post_id = ? AND version = ?`).get(postId, version)?.metadata || '{}');
  meta.auto_publish_cancelled = true;
  meta.auto_publish_cancel_reason = reason;
  db.prepare(`UPDATE posts SET metadata = ?, updated_at = datetime('now') WHERE post_id = ? AND version = ?`)
    .run(JSON.stringify(meta), postId, version);
}

export function processDueAutoApprovals() {
  if (!config.autoApprove || !config.autoPublish) return 0;
  const due = db.prepare(`
    SELECT * FROM posts
    WHERE status = 'drafted'
      AND json_extract(metadata, '$.auto_publish_cancelled') IS NOT 1
      AND json_extract(metadata, '$.auto_publish_cancelled') != 'true'
      AND json_extract(metadata, '$.auto_publish_at') IS NOT NULL
      AND json_extract(metadata, '$.auto_publish_at') <= datetime('now')
    ORDER BY json_extract(metadata, '$.auto_publish_at') ASC LIMIT 5
  `).all();

  let count = 0;
  for (const post of due) {
    try {
      const meta = JSON.parse(post.metadata || '{}');
      if (meta.auto_publish_cancelled === true || meta.auto_publish_cancelled === 'true') continue;

      db.prepare(`INSERT INTO admin_actions (post_id, version, action, actor_user_id, actor_username, admin_chat_id, callback_data, metadata)
        VALUES (?, ?, 'approve', 'system', 'auto-approve', ?, 'auto', ?)`).run(
        post.post_id, post.version, String(post.admin_chat_id || config.adminChatId),
        JSON.stringify({ grace_seconds: config.autoApproveGraceSeconds })
      );

      executeApprovePublish(post, {
        actorUserId: 'system', actorUsername: 'auto-approve',
        adminChatId: post.admin_chat_id || config.adminChatId,
        confirmPrefix: '🤖 Auto-published',
      });

      const m = JSON.parse(post.metadata || '{}');
      m.auto_publish_done = true;
      db.prepare(`UPDATE posts SET metadata = ? WHERE post_id = ? AND version = ?`).run(JSON.stringify(m), post.post_id, post.version);
      count++;
    } catch (err) {
      console.error('[auto-approve] failed', post.post_id, err.message);
    }
  }
  return count;
}
