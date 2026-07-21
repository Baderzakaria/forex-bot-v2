import db from './db.js';
import config from './config.js';
import { enqueue, getBoolSetting, setSetting } from './outbox.js';
import { createTokens, keyboard, scheduleAutoPublish } from './approval.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// ─── Daily Quote ───
const GURU_QUOTES = [
  { text: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "George Soros" },
  { text: "Plan the trade and trade the plan.", author: "Trading proverb" },
  { text: "The market can stay irrational longer than you can stay solvent.", author: "John Maynard Keynes" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "The four most dangerous words in investing are: 'this time it's different.'", author: "John Templeton" },
  { text: "In investing, what is comfortable is rarely profitable.", author: "Robert Arnott" },
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "Bulls make money, bears make money, pigs get slaughtered.", author: "Old Wall Street proverb" },
  { text: "The trend is your friend until the end when it bends.", author: "Ed Seykota" },
  { text: "Losers average losers.", author: "Paul Tudor Jones" },
];

export async function getFxRates() {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD', { signal: AbortSignal.timeout(15000) });
  return res.json();
}

export function pickQuote() {
  return GURU_QUOTES[Math.floor(Math.random() * GURU_QUOTES.length)];
}

export function formatQuotePost(quote, rates) {
  const lines = [
    '💬 Daily wisdom\n',
    `"${quote.text}"`,
    `— ${quote.author}\n`,
  ];
  if (rates?.rates) {
    lines.push('💱 FX (' + rates.date + ' · Frankfurter):');
    for (const [ccy, rate] of Object.entries(rates.rates)) {
      lines.push(`  USD/${ccy}: ${rate}`);
    }
  }
  return lines.join('\n');
}

export async function generateDailyQuote() {
  const rates = await getFxRates().catch(() => null);
  const quote = pickQuote();
  const draftText = formatQuotePost(quote, rates);
  const postId = `daily-quote-${Date.now()}`;

  db.prepare(`INSERT INTO posts (post_id, version, kind, status, requested_by, admin_chat_id, request_text, draft_text, llm_model, metadata)
    VALUES (?, 1, 'daily', 'drafted', 'daily-cron', ?, 'daily content', ?, 'guru-pool', ?)`)
    .run(postId, config.adminChatId, draftText, JSON.stringify({ daily: true }));

  const tokens = createTokens(postId, 1);
  enqueue({
    dedupe_key: `admin:daily:quote:${new Date().toISOString().slice(0, 10)}`,
    destination_type: 'telegram_admin', destination_id: config.adminChatId,
    content_text: draftText, reply_markup: keyboard(tokens),
    post_id: postId, content_version: 1, created_by: 'daily-cron',
  });
  console.log(`[quote] drafted ${postId}`);
}

// ─── Daily Hadith ───
let hadithPool = [];
let hadithPoolLoaded = false;

function normalizeHadithList(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.hadiths) ? data.hadiths : [];
  return list.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function readHadithJson(filePath) {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf8');
  return normalizeHadithList(JSON.parse(raw));
}

function loadHadithPool(forceReload = false) {
  if (hadithPoolLoaded && hadithPool.length && !forceReload) return hadithPool.length;

  hadithPool = [];
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [...new Set([
    resolve(process.cwd(), 'data/sources/hadith-daily-pool.json'),
    resolve(moduleDir, '../data/sources/hadith-daily-pool.json'),
  ])];

  for (const filePath of candidates) {
    try {
      hadithPool = hadithPool.concat(readHadithJson(filePath));
    } catch (err) {
      console.error('[hadith] load failed', filePath, err.message);
    }
  }

  const sourceDirs = [
    resolve(process.cwd(), 'data/sources'),
    resolve(moduleDir, '../data/sources'),
  ];
  for (const dir of sourceDirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        const filePath = resolve(dir, entry.name);
        if (candidates.includes(filePath)) continue;
        hadithPool = hadithPool.concat(readHadithJson(filePath));
      }
    } catch (err) {
      console.error('[hadith] dir scan failed', dir, err.message);
    }
  }

  // Also try loading from the DB's processed_data table as a final fallback.
  if (!hadithPool.length) {
    try {
      const row = db.prepare(`SELECT data FROM processed_data WHERE source = 'hadith-json' LIMIT 1`).get();
      if (row?.data) hadithPool = normalizeHadithList(JSON.parse(row.data));
    } catch (err) {
      console.error('[hadith] db fallback failed', err.message);
    }
  }

  hadithPoolLoaded = true;
  console.log(`[hadith] pool loaded: ${hadithPool.length} entries`);
  return hadithPool.length;
}

export function pickHadith(mode = 'random') {
  if (!hadithPool.length) loadHadithPool();
  if (!hadithPool.length) return null;
  if (mode === 'day') {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return hadithPool[dayOfYear % hadithPool.length];
  }
  return hadithPool[Math.floor(Math.random() * hadithPool.length)];
}

export function formatHadithPost(h) {
  if (!h) return '📿 No hadith available — run /hadith sync to load pool.';
  const lines = ['📿 حديث اليوم'];
  const arabic = h.text || h.text_ar || h.arabic || '';
  const english = h.text_en || h.english || '';
  const book = h.book_ar || h.book || h.source || 'صحيح البخاري';
  const num = h.number ?? h.hadith_number ?? '';
  const url = h.url || h.source_url || '';

  if (arabic) lines.push('', arabic);
  if (english) lines.push('', english);
  lines.push('', `📖 ${book}${num !== '' && num !== null && num !== undefined ? ' · #' + num : ''}`);
  if (url) lines.push('', url.startsWith('http') ? url : `https://sunnah.com/${String(url).replace(/^\/+/, '')}`);
  return lines.join('\n');
}

function searchHadithPool(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const matches = hadithPool.filter((h) => {
    const haystack = [
      h.text,
      h.text_en,
      h.book_ar,
      h.book,
      h.arabic,
      h.english,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
  return matches[0] || null;
}

export function findHadith(query) {
  if (!hadithPool.length) loadHadithPool();
  return searchHadithPool(query);
}

export async function generateDailyHadith() {
  const settings = getDailySettings();
  if (!settings.dailyHadithEnabled) return;

  const hadith = pickHadith(settings.dailyHadithMode);
  const draftText = formatHadithPost(hadith);
  const postId = `daily-hadith-${Date.now()}`;

  db.prepare(`INSERT INTO posts (post_id, version, kind, status, requested_by, admin_chat_id, request_text, draft_text, llm_model, metadata)
    VALUES (?, 1, 'daily', 'drafted', 'daily-cron', ?, 'daily content', ?, 'hadith-pool', ?)`)
    .run(postId, config.adminChatId, draftText, JSON.stringify({ daily: true, hadith: true }));

  const tokens = createTokens(postId, 1);
  enqueue({
    dedupe_key: `admin:daily:hadith:${new Date().toISOString().slice(0, 10)}`,
    destination_type: 'telegram_admin', destination_id: config.adminChatId,
    content_text: draftText, reply_markup: keyboard(tokens),
    post_id: postId, content_version: 1, created_by: 'daily-cron',
  });
  console.log(`[hadith] drafted ${postId}`);
}

export function syncHadithPool() {
  const count = loadHadithPool(true);
  return { ok: true, count };
}

export function getDailySettings() {
  return {
    dailyQuoteEnabled: getBoolSetting('daily_quote_enabled', true),
    dailyHadithEnabled: getBoolSetting('daily_hadith_enabled', false),
    dailyQuoteMode: db.prepare(`SELECT value FROM settings WHERE key = 'daily_quote_mode'`).get()?.value || 'ai',
    dailyHadithMode: db.prepare(`SELECT value FROM settings WHERE key = 'daily_hadith_mode'`).get()?.value || 'random',
    postToWritingOnApprove: getBoolSetting('post_to_writing_on_approve', true),
  };
}
