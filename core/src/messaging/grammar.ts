// F4 text formats and reply parsing (SYSTEM_DESIGN §9.3). Pure: no DB, no clock, no sends, so it is unit-tested.
// No text built here contains a link (the interrupt is the first message of a conversation).
import type { Domain } from "../agents/schemas.js";
import { formatWhenNY, nyWallClock } from "../nytime.js";
import type { Obligation } from "../pipeline/ledger.js";

type Item = Pick<Obligation, "title" | "domain" | "amount_at_risk_usd" | "deadline_at">;

const MINUTE_MS = 60_000;

/** "$3,700" or "$12.50" */
export function money(usd: number): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(usd) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// What the money is, and what replies 1 and 2 return, per domain.
const DOMAIN_COPY: Record<Domain, { risk: string; draft: string; checklist: string }> = {
  aid: { risk: "in aid is on hold", draft: "a drafted email to the aid office", checklist: "the document checklist" },
  credit: { risk: "is at risk in fees", draft: "a drafted message to the card issuer", checklist: "the payment checklist" },
  subs: { risk: "is about to be charged", draft: "a drafted cancellation message", checklist: "the steps to cancel" },
  money_in: { risk: "is waiting to be claimed", draft: "a drafted claim message", checklist: "the claim checklist" },
};

function due(item: Item, at: Date): string {
  const deadline = new Date(item.deadline_at);
  const when = formatWhenNY(deadline, at);
  return deadline.getTime() < at.getTime() ? `Overdue since ${when}` : `Due ${when}`;
}

/**
 * FAFSA verification: $3,700 in aid is on hold.
 * Due tonight 11:59 PM.
 * Reply 1 for a drafted email to the aid office, 2 for the document checklist.
 */
export function interruptText(item: Item, at: Date): string {
  const copy = DOMAIN_COPY[item.domain];
  return [
    `${item.title}: ${money(item.amount_at_risk_usd)} ${copy.risk}.`,
    `${due(item, at)}.`,
    `Reply 1 for ${copy.draft}, 2 for ${copy.checklist}.`,
  ].join("\n");
}

/** Shorter than the interrupt; also the reminder when a snooze runs out. */
export function followUpText(item: Item, at: Date): string {
  return `Still open: ${item.title}, ${money(item.amount_at_risk_usd)}. ${due(item, at)}. Reply 1, 2, or done.`;
}

/** One line per item, at most 5. Null when there is nothing to send. */
export function digestText(items: Item[], at: Date): string | null {
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  const noun = shown.length === 1 ? "item" : "items";
  return [
    `Morning digest: ${shown.length} ${noun} with money at risk.`,
    ...shown.map((i) => `- ${i.title}: ${money(i.amount_at_risk_usd)}, due ${formatWhenNY(new Date(i.deadline_at), at)}`),
  ].join("\n");
}

/** Top 3 unfinished items, highest score first. */
export function statusText(items: Item[], at: Date, protectedUsd: number): string {
  if (items.length === 0) return `Nothing open. ${money(protectedUsd)} protected this month.`;
  return items.slice(0, 3)
    .map((i, n) => `${n + 1}. ${i.title}: ${money(i.amount_at_risk_usd)}, due ${formatWhenNY(new Date(i.deadline_at), at)}`)
    .join("\n");
}

export function checklistText(title: string, steps: string[]): string {
  return [`${title} checklist:`, ...steps.map((s, n) => `${n + 1}. ${s}`)].join("\n");
}

// --- reply grammar ---

export type Reply =
  | { action: "draft" }
  | { action: "checklist" }
  | { action: "done" }
  | { action: "dismiss" }
  | { action: "status" }
  | { action: "snooze"; when: string }
  | { action: "ask"; text: string };

export function parseReply(raw: string): Reply {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  if (t === "1") return { action: "draft" };
  if (t === "2") return { action: "checklist" };
  if (t === "done") return { action: "done" };
  if (t === "dismiss") return { action: "dismiss" };
  if (t === "status") return { action: "status" };
  if (t === "later") return { action: "snooze", when: "" };
  const snooze = /^snooze\b ?(.*)$/.exec(t);
  if (snooze) return { action: "snooze", when: snooze[1] ?? "" };
  return { action: "ask", text: raw.trim() };
}

const UNIT_MINUTES: Record<string, number> = { m: 1, min: 1, mins: 1, minute: 1, minutes: 1, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60 };

/**
 * When a snooze ends. Understands "9pm", "9:30 pm", "at 10", "21:00", "in 2 hours", "in 30 min",
 * "tonight", "tomorrow", "tomorrow 9am". Anything else (including "" from "later") is `defaultMinutes` from now.
 */
export function snoozeUntil(when: string, at: Date, defaultMinutes: number): Date {
  const fallback = new Date(at.getTime() + defaultMinutes * MINUTE_MS);
  let t = when.trim().toLowerCase().replace(/^(until|till|at)\s+/, "");

  const rel = /^in (\d+(?:\.\d+)?) ?([a-z]+)$/.exec(t);
  if (rel) {
    const unit = UNIT_MINUTES[rel[2]!];
    return unit ? new Date(at.getTime() + Number(rel[1]) * unit * MINUTE_MS) : fallback;
  }

  let dayOffset = 0;
  if (t.startsWith("tomorrow")) {
    dayOffset = 1;
    t = t.slice("tomorrow".length).trim().replace(/^at\s+/, "");
    if (t === "") return nyWallClock(at, 1, 9, 0);
  }
  if (t === "tonight") t = "9pm";

  const clock = /^(\d{1,2})(?::(\d{2}))? ?(am|pm)?$/.exec(t);
  if (!clock) return fallback;
  const h = Number(clock[1]);
  const m = Number(clock[2] ?? 0);
  const ampm = clock[3];
  if (m > 59 || h > 23 || (ampm && (h < 1 || h > 12))) return fallback;

  // Candidate hours in 24h time: explicit am/pm or 13-23 is exact; a bare 1-12 could be either.
  const hours = ampm ? [(h % 12) + (ampm === "pm" ? 12 : 0)] : h === 0 || h > 12 ? [h] : [h % 12, (h % 12) + 12];
  for (let d = dayOffset; d <= dayOffset + 1; d++) {
    for (const hour of hours) {
      const candidate = nyWallClock(at, d, hour, m);
      if (candidate.getTime() > at.getTime()) return candidate;
    }
  }
  return fallback;
}
