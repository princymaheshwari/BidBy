// F4/F5 tick loop (SYSTEM_DESIGN §10 flows C, E): every 5 real seconds, check demo time and
// wake snoozes, rank, notify, follow up, send the digest. All state is read from the DB, so a restart
// never resends a text.
import { now } from "../clock.js";
import {
  DIGEST_HOUR, INTERRUPT_SCORE, MAX_FOLLOW_UPS, NO_REPLY_MINUTES, TICK_DEMO_MINUTES,
} from "../config.js";
import { db, getSettings, updateSettings } from "../db.js";
import { digestText, followUpText, interruptText } from "../messaging/grammar.js";
import { followUpsSent } from "../messaging/replies.js";
import { sendToUser } from "../messaging/spectrum.js";
import { nyDateKey, nyWallClock } from "../nytime.js";
import { getObligation, isFinal, listObligations, markNotified, wake, type Obligation } from "../pipeline/ledger.js";
import { rank } from "../pipeline/rank.js";

const TICK_MS = 5_000;
const MINUTE_MS = 60_000;

let ticking = false;
let again = false;
let lastTickAt: Date | null = null;   // demo time of the previous tick (digest boundary check)
let lastBudgetDay: string | null = null;
let lastRankAttempt: Date | null = null;

export function startTimer(): void {
  setInterval(() => void tick(), TICK_MS);
  void tick();
}

/** Runs a tick now (e.g. after the demo clock jumps); folds into the running one if a tick is in progress. */
export async function tick(): Promise<void> {
  if (ticking) {
    again = true;
    return;
  }
  ticking = true;
  try {
    do {
      again = false;
      await tickOnce();
    } while (again);
  } finally {
    ticking = false;
  }
}

async function tickOnce(): Promise<void> {
  const at = now();
  await step("budget", () => resetBudgetOnNewDay(at));
  await step("snooze", () => wakeSnoozed(at));
  await step("rank", () => rankIfDue(at));
  await step("digest", () => digest(at));
  await step("notify", () => notifyTop(now()));
  await step("follow-up", () => followUp(now()));
  lastTickAt = at;
}

// One failing step (e.g. Spectrum down) must not stop the others; repeated identical errors log once.
const lastErrors = new Map<string, string>();
async function step(name: string, fn: () => unknown): Promise<void> {
  try {
    await fn();
    lastErrors.delete(name);
  } catch (err) {
    const message = (err as Error).message;
    if (lastErrors.get(name) !== message) console.error(`[timer] ${name}: ${message}`);
    lastErrors.set(name, message);
  }
}

// --- interrupt budget: interrupts_today counts interrupts sent in the current budget day ---

/** A budget day runs from one digest to the next, so an interrupt held by the budget goes out at
 *  DIGEST_HOUR (right after the digest), never overnight. */
const budgetDay = (at: Date) => nyDateKey(new Date(at.getTime() - DIGEST_HOUR * 60 * MINUTE_MS));

function resetBudgetOnNewDay(at: Date): void {
  const day = budgetDay(at);
  if (day === lastBudgetDay) return;
  lastBudgetDay = day;
  const sent = texts("interrupt").filter((t) => budgetDay(new Date(t.sent_at)) === day).length;
  if (getSettings().interrupts_today !== sent) updateSettings({ interrupts_today: sent });
}

// --- snooze: when it runs out, the item comes back and the user gets the reminder they asked for ---

async function wakeSnoozed(at: Date): Promise<void> {
  for (const ob of listObligations()) {
    if (ob.status !== "snoozed" || !ob.snoozed_until || Date.parse(ob.snoozed_until) > at.getTime()) continue;
    wake(ob.id);
    if (followUpsSent(ob.id) < MAX_FOLLOW_UPS) await sendToUser(followUpText(ob, at), "follow_up", ob.id);
  }
}

// --- rank every TICK_DEMO_MINUTES of demo time ---

async function rankIfDue(at: Date): Promise<void> {
  const row = db.prepare("SELECT created_at FROM decisions ORDER BY rowid DESC LIMIT 1").get() as
    { created_at: string } | undefined;
  const last = Math.max(row ? Date.parse(row.created_at) : -Infinity, lastRankAttempt?.getTime() ?? -Infinity);
  const elapsed = at.getTime() - last;
  if (elapsed >= 0 && elapsed < TICK_DEMO_MINUTES * MINUTE_MS) return; // negative: the clock went back
  lastRankAttempt = at;
  await rank();
}

// --- notify (flow C): only the top item, only above the threshold, only within the daily budget ---

async function notifyTop(at: Date): Promise<void> {
  const row = db.prepare("SELECT ranked_ids, scores FROM decisions ORDER BY rowid DESC LIMIT 1").get() as
    { ranked_ids: string; scores: string } | undefined;
  if (!row) return;
  const scores: Record<string, number> = JSON.parse(row.scores);
  // The top of the latest round, skipping items closed or snoozed since it ran.
  const top = (JSON.parse(row.ranked_ids) as string[])
    .map((id) => getObligation(id))
    .find((o): o is Obligation => !!o && !isFinal(o) && o.status !== "snoozed");
  if (!top || top.status !== "open" || (scores[top.id] ?? 0) < INTERRUPT_SCORE) return;

  const settings = getSettings();
  if (settings.interrupts_today >= settings.interrupt_budget) return; // held until the next budget day

  // F3 head start runs here once spec 05 builds it.
  await sendToUser(interruptText(top, at), "interrupt", top.id);
  markNotified(top.id);
  updateSettings({ interrupts_today: getSettings().interrupts_today + 1 });
}

// --- follow-up: no reply NO_REPLY_MINUTES after BidBy's last text about a notified item ---

async function followUp(at: Date): Promise<void> {
  for (const ob of listObligations()) {
    if (ob.status !== "notified") continue;
    const last = db.prepare("SELECT sent_at FROM outbound_texts WHERE obligation_id = ? ORDER BY rowid DESC LIMIT 1")
      .get(ob.id) as { sent_at: string } | undefined;
    if (!last) continue;
    const replied = db.prepare("SELECT 1 FROM inbound_replies WHERE parsed_action LIKE ? AND received_at > ? LIMIT 1")
      .get(`%:${ob.id}`, last.sent_at);
    if (replied) continue;
    if (at.getTime() - Date.parse(last.sent_at) < NO_REPLY_MINUTES * MINUTE_MS) continue;

    if (followUpsSent(ob.id) < MAX_FOLLOW_UPS) await sendToUser(followUpText(ob, at), "follow_up", ob.id);
    else await maybeEscalate(ob, at);
  }
}

/** Spec 06 hook: call the user when a high-stakes item is still ignored after the follow-ups. */
export async function maybeEscalate(_item: Obligation, _at: Date): Promise<void> {}

// --- digest: once a day at DIGEST_HOUR demo time, the open items below the interrupt threshold ---

async function digest(at: Date): Promise<void> {
  const due = nyWallClock(at, 0, DIGEST_HOUR, 0);
  if (!lastTickAt || lastTickAt.getTime() >= due.getTime() || at.getTime() < due.getTime()) return;
  const today = nyDateKey(at);
  if (texts("digest").some((t) => nyDateKey(new Date(t.sent_at)) === today)) return;

  const row = db.prepare("SELECT scores FROM decisions ORDER BY rowid DESC LIMIT 1").get() as { scores: string } | undefined;
  const scores: Record<string, number> = row ? JSON.parse(row.scores) : {};
  const waiting = listObligations()
    .filter((o) => o.status === "open" && (scores[o.id] ?? 0) < INTERRUPT_SCORE)
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const body = digestText(waiting, at);
  if (body) await sendToUser(body, "digest", null);
}

function texts(kind: "interrupt" | "digest"): { sent_at: string }[] {
  return db.prepare("SELECT sent_at FROM outbound_texts WHERE kind = ?").all(kind) as unknown as { sent_at: string }[];
}
