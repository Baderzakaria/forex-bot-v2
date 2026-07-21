import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

let loaded = false;

export function loadRootEnv() {
  if (loaded) return;

  const rootEnvPath = path.join(process.cwd(), "..", ".env");
  const fallbackEnvPath = path.join(process.cwd(), "..", ".env.example");

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  } else if (fs.existsSync(fallbackEnvPath)) {
    dotenv.config({ path: fallbackEnvPath });
  }

  loaded = true;
}

export function getEnv(name: string, fallback = "") {
  loadRootEnv();
  return process.env[name] ?? fallback;
}
