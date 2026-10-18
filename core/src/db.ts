// node:sqlite schema, migrations and query helpers (SYSTEM_DESIGN §8).
// JSON columns are TEXT; booleans are INTEGER 0/1; timestamps are ISO 8601 TEXT.
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { REPO_ROOT, config } from "./config.js";

export const db = new DatabaseSync(resolve(REPO_ROOT, "bidby.db"));
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS raw_messages (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('email', 'slack', 'bank')),
  sender      TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obligations (
  id                 TEXT PRIMARY KEY,
  domain             TEXT NOT NULL CHECK (domain IN ('aid', 'credit', 'subs', 'money_in')),
  title              TEXT NOT NULL,
  amount_at_risk_usd REAL NOT NULL,
  deadline_at        TEXT NOT NULL,
  consequence        TEXT NOT NULL,
  required_action    TEXT NOT NULL,
  required_docs      TEXT NOT NULL DEFAULT '[]',
  source_message_ids TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'notified', 'escalated', 'done', 'snoozed', 'dismissed')),
  snoozed_until      TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id                 TEXT PRIMARY KEY,
  round_id           TEXT NOT NULL,
  obligation_id      TEXT NOT NULL,
  agent_id           TEXT NOT NULL,
  amount_at_risk_usd REAL NOT NULL,
  effort_minutes     REAL NOT NULL,
  reversible         INTEGER NOT NULL,
  blocks_other_aid   INTEGER NOT NULL,
  argument           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL,
  ranked_ids TEXT NOT NULL,
  scores     TEXT NOT NULL,
  rationale  TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS head_starts (
  id            TEXT PRIMARY KEY,
  obligation_id TEXT NOT NULL,
  checklist     TEXT NOT NULL DEFAULT '[]',
  found_files   TEXT NOT NULL DEFAULT '[]',
  draft_text    TEXT NOT NULL,
  resources     TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS outbound_texts (
  id            TEXT PRIMARY KEY,
  obligation_id TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('interrupt', 'digest', 'follow_up', 'closing')),
  body          TEXT NOT NULL,
  sent_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbound_replies (
  id                  TEXT PRIMARY KEY,
  spectrum_message_id TEXT NOT NULL UNIQUE,
  text                TEXT NOT NULL,
  parsed_action       TEXT,
  received_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  id              TEXT PRIMARY KEY,
  obligation_id   TEXT NOT NULL,
  conversation_id TEXT,
  status          TEXT NOT NULL,
  summary         TEXT,
  transcript      TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id      TEXT PRIMARY KEY,
  type    TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  clock_offset_minutes REAL    NOT NULL DEFAULT 0,
  interrupts_today     INTEGER NOT NULL DEFAULT 0,
  interrupt_budget     INTEGER NOT NULL DEFAULT 2,
  user_phone           TEXT    NOT NULL
);
`);

// settings is a single row. Seed it once; .env stays the source of truth for the phone.
db.prepare(
  "INSERT INTO settings (user_phone) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM settings)",
).run(config.USER_PHONE);
db.prepare("UPDATE settings SET user_phone = ?").run(config.USER_PHONE);

// --- ids ---

export type IdPrefix = "ob" | "msg" | "bid" | "dec" | "hs" | "txt" | "rep" | "call" | "evt" | "round";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomBytes(5).toString("hex")}`;
}

// --- settings ---

export interface Settings {
  clock_offset_minutes: number;
  interrupts_today: number;
  interrupt_budget: number;
  user_phone: string;
}

export function getSettings(): Settings {
  return db.prepare("SELECT * FROM settings LIMIT 1").get() as unknown as Settings;
}

export function updateSettings(patch: Partial<Omit<Settings, "user_phone">>): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE settings SET ${sets}`).run(...keys.map((k) => patch[k] ?? null));
}

// --- reset ---

const DATA_TABLES = [
  "raw_messages", "obligations", "bids", "decisions", "head_starts",
  "outbound_texts", "inbound_replies", "calls", "events",
] as const;

/** Deletes every row except settings, and resets the demo clock and interrupt count. */
export function clearAll(): void {
  db.exec("BEGIN");
  try {
    for (const t of DATA_TABLES) db.exec(`DELETE FROM ${t}`);
    updateSettings({ clock_offset_minutes: 0, interrupts_today: 0 });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
