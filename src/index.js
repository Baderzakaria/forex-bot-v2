import "./load-env.js";
import express from 'express';
import cron from 'node-cron';
import config from './config.js';
import db from './db.js';
import { getUpdates, answerCallbackQuery, sendMessage } from './telegram.js';
import { handleMessage, handleCallback } from './dispatcher.js';
import { processSender } from './sender.js';
import { processDueAutoApprovals } from './approval.js';
import { generateDailyQuote } from './content.js';
import {
  discoverMacro,
  processT30PreAlerts,
  processT0ReleaseAlerts,
  processActualAlerts,
  refreshRecentActuals,
  formatDiscoverSummary,
} from './apify.js';
import { syncAllFromDb } from './sheets.js';
import { sendMorningBrief } from './morning.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ─── Health ───
app.get('/health', (_req, res) => res.json({ ok: true, service: 'forex-bot-v2', env: config.environment }));

// ─── Telegram webhook ───
app.post(`/telegram/webhook`, async (req, res) => {
  const update = req.body;
  if (!update?.update_id) return res.status(400).json({ ok: false });

  // Dedupe
  const seen = db.prepare(`INSERT OR IGNORE INTO processed_updates (update_id) VALUES (?)`).run(update.update_id);
  if (!seen.changes) return res.json({ ok: true, duplicate: true });

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error('[webhook] error', err.message);
  }
  res.json({ ok: true });
});

// ─── Sender loop ───
async function senderLoop() {
  while (true) {
    const hadWork = await processSender();
    if (!hadWork) await new Promise(r => setTimeout(r, config.senderPollMs));
  }
}

// ─── Auto-approve loop ───
async function autoApproveLoop() {
  while (true) {
    try {
      processDueAutoApprovals();
    } catch (err) {
      console.error('[auto-approve]', err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── Telegram long-poll (fallback if no webhook) ───
let usePolling = process.env.USE_POLLING === 'true';
async function pollLoop() {
  let offset = 0;
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        const seen = db.prepare(`INSERT OR IGNORE INTO processed_updates (update_id) VALUES (?)`).run(update.update_id);
        if (!seen.changes) continue;
        if (update.callback_query) {
          await handleCallback(update.callback_query);
        } else if (update.message) {
          await handleMessage(update.message);
        }
      }
      if (!updates.length) await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error('[poller]', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ─── Crons ───
let macroAlertTickRunning = false;
let lastActualRefreshAt = 0;

cron.schedule('30 7 * * *', async () => {
  console.log('[cron] daily quote');
  const s = db.prepare(`SELECT value FROM settings WHERE key = 'daily_quote_enabled'`).get();
  if (s?.value !== 'false') await generateDailyQuote().catch(e => console.error('[quote]', e.message));
}, { timezone: 'UTC' });

cron.schedule('0 7 * * *', async () => {
  console.log('[cron] macro discover');
  try {
    const result = await discoverMacro({ daysAhead: config.apifyDaysAhead, countries: config.apifyCountries });
    const summary = formatDiscoverSummary(result);
    console.log(summary.replace(/\n/g, ' | '));
    if (config.adminChatId) {
      await sendMessage(config.adminChatId, summary).catch((err) => console.error('[discover-msg]', err.message));
    }
  } catch (err) {
    console.error('[discover]', err.message);
    if (config.adminChatId) {
      await sendMessage(config.adminChatId, `⚠️ Macro discover failed: ${err.message}`).catch(() => {});
    }
  } finally {
    syncAllFromDb(db).catch((err) => console.error('[cron-sheet-sync]', err.message));
  }
}, { timezone: 'UTC' });

cron.schedule('15 7 * * *', async () => {
  console.log('[cron] morning brief');
  try {
    await sendMorningBrief({ preAlertMinutes: config.preAlertMinutes });
  } catch (err) {
    console.error('[morning-brief]', err.message);
  }
}, { timezone: 'UTC' });

cron.schedule('* * * * *', async () => {
  if (macroAlertTickRunning) return;
  macroAlertTickRunning = true;
  try {
    const refreshInterval = Math.max(1, Number(config.actualRefreshMinutes) || 5);
    const shouldRefreshActuals = Boolean(config.apifyToken)
      && (new Date().getUTCMinutes() % refreshInterval === 0)
      && Date.now() - lastActualRefreshAt >= (refreshInterval - 1) * 60_000;

    if (shouldRefreshActuals) {
      try {
        const refreshResult = await refreshRecentActuals({ countries: config.apifyCountries });
        lastActualRefreshAt = Date.now();
        console.log(`[cron] actual refresh saved=${refreshResult.saved || 0}`);
      } catch (err) {
        console.error('[actual-refresh]', err.message);
      }
    }

    const result = processT30PreAlerts({
      preAlertMinutes: config.preAlertMinutes,
      adminChatId: config.adminChatId,
    });
    if (result.drafted) {
      console.log(`[cron] t30 drafts=${result.drafted}`);
    }
    const t0Result = processT0ReleaseAlerts({
      adminChatId: config.adminChatId,
    });
    if (t0Result.drafted) {
      console.log(`[cron] t0 drafts=${t0Result.drafted}`);
    }

    const actualResult = processActualAlerts({
      adminChatId: config.adminChatId,
      lookbackMinutes: config.actualLookbackMinutes,
    });
    if (actualResult.drafted) {
      console.log(`[cron] actual drafts=${actualResult.drafted}`);
    }
  } catch (err) {
    console.error('[alerts]', err.message);
  } finally {
    macroAlertTickRunning = false;
  }
}, { timezone: 'UTC' });

// ─── Start ───
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[forex-bot-v2] listening on :${PORT} | env=${config.environment}`);
  console.log(`[forex-bot-v2] auto-publish=${config.autoApprove && config.autoPublish ? `ON (${config.autoApproveGraceSeconds}s)` : 'OFF'}`);
  console.log(`[forex-bot-v2] polling=${usePolling} webhook=${!usePolling}`);
  void (async () => {
    const total = db.prepare(`SELECT COUNT(*) as c FROM events`).get();
    if (Number(total?.c || 0) !== 0) return;
    console.log('[startup] events table empty, refreshing macro calendar');
    try {
      const result = await discoverMacro({
        daysAhead: config.apifyDaysAhead,
        countries: config.apifyCountries,
        force: true,
      });
      console.log(`[startup] ${formatDiscoverSummary(result).replace(/\n/g, ' | ')}`);
    } catch (err) {
      console.error('[startup-discover]', err.message);
    }
  })();
});

// Start loops
senderLoop();
autoApproveLoop();
if (usePolling) pollLoop();

console.log('[forex-bot-v2] started — 1 process, 1 SQLite DB, 0 containers');
