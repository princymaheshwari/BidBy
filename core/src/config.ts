// Loads .env (process.loadEnvFile) and exports typed config + thresholds.
// Secrets live here only; never log config values.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const REPO_ROOT = resolve(import.meta.dirname, "../..");

const envPath = resolve(REPO_ROOT, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
else console.warn("[config] no .env found at repo root; using process environment only");

// Empty strings in .env (e.g. `SPECTRUM_PROJECT_ID=`) count as unset.
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const Env = z.object({
  USER_PHONE: z.string().regex(/^\+[1-9]\d{6,14}$/, "must be E.164, e.g. +14045551234"),
  OPENCLAW_GATEWAY_URL: z.string().url().default("http://127.0.0.1:18789"),
  OPENCLAW_GATEWAY_TOKEN: z.string().min(1, "required"),
  AGENT_BACKEND: z.enum(["openclaw", "direct"]).default("openclaw"),

  SPECTRUM_PROJECT_ID: optional,
  SPECTRUM_PROJECT_SECRET: optional,
  MESSAGING_MODE: z.enum(["imessage", "log"]).default("imessage"),

  ELEVENLABS_API_KEY: optional,
  ELEVENLABS_AGENT_ID: optional,
  ELEVENLABS_PHONE_NUMBER_ID: optional,
  ELEVENLABS_WEBHOOK_SECRET: optional,
  BIDBY_TOOL_SECRET: optional,
  VOICE_MODE: z.enum(["live", "mock", "dashboard"]).default("live"),

  PORT: z.coerce.number().int().positive().default(8787),
  DB_PATH: z.string().default("bidby.db"), // relative to the repo root; tests point this at a scratch file
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // Report variable names and rules only, never the values.
  const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  throw new Error(`[config] invalid environment (see .env.example):\n${lines.join("\n")}`);
}

export const config = parsed.data;
export type Config = typeof config;

// Thresholds (SYSTEM_DESIGN §8). Starting values: tune on the seeded inbox, then freeze.
export const INTERRUPT_SCORE = 500;
export const CALL_SCORE = 1500;
export const CALL_MAX_HOURS_LEFT = 12;
export const NO_REPLY_MINUTES = 120;
export const TICK_DEMO_MINUTES = 15;

// Texting (spec 04, SYSTEM_DESIGN §9.3).
export const MAX_FOLLOW_UPS = 2;          // Photon deliverability: at most 2 follow-ups per obligation
export const SEND_GAP_MS = 2_000;         // real time between outbound texts (no bursts)
export const DIGEST_HOUR = 8;             // New York demo-time hour of the daily digest
export const DEFAULT_SNOOZE_MINUTES = 120;
