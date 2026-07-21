const env = (k, d = '') => {
  const v = process.env[k];
  return v === undefined || v === '' ? d : v;
};

const boolEnv = (k, d = 'false') => env(k, d) === 'true';

export default {
  port: Number(env('PORT', '8788')),
  botToken: env('TELEGRAM_BOT_TOKEN'),
  adminChatId: env('TELEGRAM_ADMIN_CHAT_ID'),
  publicChatId: env('TELEGRAM_PUBLIC_CHAT_ID', env('TELEGRAM_ADMIN_CHAT_ID')),
  writingChatId: env('TELEGRAM_WRITING_CHAT_ID'),
  writingChatDisabled: boolEnv('TELEGRAM_WRITING_DISABLED', 'false'),
  allowedUserIds: (env('TELEGRAM_ALLOWED_USER_IDS', env('TELEGRAM_USER_ID'))).split(',').map(s => s.trim()).filter(Boolean),
  autoApprove: boolEnv('AUTO_APPROVE', 'false'),
  autoPublish: boolEnv('AUTO_PUBLISH_TELEGRAM', 'false'),
  autoApproveGraceSeconds: Math.max(15, Number(env('AUTO_APPROVE_GRACE_SECONDS', '90'))),
  preAlertMinutes: Number(env('PRE_ALERT_MINUTES', '30')),
  releaseAlertEnabled: boolEnv('RELEASE_ALERT_ENABLED', 'true'),
  actualAlertEnabled: boolEnv('ACTUAL_ALERT_ENABLED', 'true'),
  actualLookbackMinutes: Math.max(5, Number(env('ACTUAL_LOOKBACK_MINUTES', '120'))),
  actualRefreshMinutes: Math.max(1, Number(env('ACTUAL_REFRESH_MINUTES', '5'))),
  zaiApiKey: env('ZAI_API_KEY'),
  zaiBaseUrl: env('ZAI_BASE_URL', 'https://api.z.ai/api/paas/v4'),
  llmModel: env('LLM_MODEL', 'glm-4.5-flash'),
  apifyToken: env('APIFY_TOKEN'),
  apifyActorId: env('APIFY_ACTOR_ID', 'pintostudio/economic-calendar-data-investing-com'),
  apifyCountries: env('APIFY_MACRO_COUNTRIES', env('APIFY_MACRO_COUNTRY', 'united states')),
  apifyDaysAhead: Number(env('APIFY_MACRO_DAYS_AHEAD', '3')),
  googleSheetId: env('GOOGLE_SHEET_ID'),
  googleSheetUrl: env('GOOGLE_SHEET_URL'),
  googleOAuthTokenPath: env('GOOGLE_OAUTH_TOKEN_PATH'),
  googleOAuthCredentialsPath: env('GOOGLE_OAUTH_CREDENTIALS_PATH'),
  dbPath: env('DB_PATH', './data/forex-bot.db'),
  workerPollMs: Number(env('WORKER_POLL_MS', '1000')),
  senderPollMs: Number(env('SENDER_POLL_MS', '1500')),
  environment: env('NODE_ENV', 'production'),
};
