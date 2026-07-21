import config from './config.js';

export async function sendMessage(chatId, text, opts = {}) {
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs || 30000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'sendMessage failed');
  return data;
}

export async function answerCallbackQuery(callbackId, text, opts = {}) {
  await fetch(`https://api.telegram.org/bot${config.botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text: text || '',
      show_alert: opts.showAlert || false,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

export async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  try {
    await fetch(`https://api.telegram.org/bot${config.botToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {}
}

export async function getUpdates(offset) {
  const params = new URLSearchParams({ timeout: '25', allowed_updates: JSON.stringify(['message', 'callback_query']) });
  if (offset) params.set('offset', String(offset));
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getUpdates?${params}`, {
    signal: AbortSignal.timeout(35000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'getUpdates failed');
  return data.result || [];
}

export async function setWebhook(url, secret) {
  await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: JSON.stringify(['message', 'callback_query']) }),
  });
}
