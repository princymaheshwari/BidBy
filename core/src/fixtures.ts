// Loads fixtures/inbox.json (seeded) and fixtures/held.json (injected live during the demo).
// received_at_offset_hours is relative to demo time, so the demo is time-independent.
// Bodies may contain {{day:+N@HH:MM}}: HH:MM New York time, N days after the demo date.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { formatNY, nyWallClock } from "./clock.js";
import { REPO_ROOT } from "./config.js";

export const Fixture = z.object({
  id: z.string(),
  source: z.enum(["email", "slack", "bank"]),
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
  received_at_offset_hours: z.number(),
});
export type Fixture = z.infer<typeof Fixture>;

function load(file: "inbox.json" | "held.json"): Fixture[] {
  const raw = JSON.parse(readFileSync(resolve(REPO_ROOT, "fixtures", file), "utf8"));
  return z.array(Fixture).parse(raw);
}

// Read fresh each call so fixture edits apply without a restart.
export const loadInbox = () => load("inbox.json");
export const loadHeld = () => load("held.json");

export function findFixture(id: string): Fixture | undefined {
  return [...loadHeld(), ...loadInbox()].find((f) => f.id === id);
}

const HOUR_MS = 3_600_000;
const DAY_TOKEN = /\{\{day:([+-]?\d+)@(\d{1,2}):(\d{2})\}\}/g;

/** Turns a fixture into an incoming message anchored at base (demo time). */
export function renderFixture(f: Fixture, base: Date) {
  const render = (text: string) =>
    text.replace(DAY_TOKEN, (_, d: string, h: string, m: string) =>
      formatNY(nyWallClock(base, Number(d), Number(h), Number(m))));
  return {
    source: f.source,
    sender: f.sender,
    subject: render(f.subject),
    body: render(f.body),
    received_at: new Date(base.getTime() + f.received_at_offset_hours * HOUR_MS).toISOString(),
  };
}
