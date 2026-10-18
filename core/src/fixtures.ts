// Loads fixtures/inbox.json (seeded) and fixtures/held.json (injected live during the demo).
// received_at_offset_hours is relative to demo time, so the demo is time-independent.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
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
