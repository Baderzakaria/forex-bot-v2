import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type DatabaseHandle = InstanceType<typeof Database>;

function resolveDbPath() {
  const candidates = [
    process.env.DB_PATH,
    "/data/forex-bot.db",
    path.resolve(process.cwd(), "..", "data", "forex-bot.db"),
  ].filter(Boolean) as string[];

  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }

  if (fs.existsSync("/data")) {
    return "/data/forex-bot.db";
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return path.resolve(candidates[0] || "/data/forex-bot.db");
}

const dbPath = resolveDbPath();
const state = globalThis as typeof globalThis & {
  __forexCmsDb?: {
    readonly?: DatabaseHandle;
    writable?: DatabaseHandle;
  };
};

function createDb(readonly: boolean) {
  return new Database(dbPath, { readonly, fileMustExist: true });
}

export function hasBotDatabase() {
  return fs.existsSync(resolveDbPath());
}

export function getBotDb(readonly = true) {
  if (!state.__forexCmsDb) {
    state.__forexCmsDb = {};
  }

  if (readonly) {
    state.__forexCmsDb.readonly ??= createDb(true);
    return state.__forexCmsDb.readonly;
  }

  state.__forexCmsDb.writable ??= createDb(false);
  return state.__forexCmsDb.writable;
}

export function closeBotDb() {
  state.__forexCmsDb?.readonly?.close();
  state.__forexCmsDb?.writable?.close();
  state.__forexCmsDb = undefined;
}
