// F5: what the voice agent's three webhook tools do (SYSTEM_DESIGN §9.5). Shared by the real tool routes
// and mock completion, so both have the same ledger effects. Each emits voice.tool_called for the judge view.
import { now } from "../clock.js";
import { DEFAULT_SNOOZE_MINUTES } from "../config.js";
import { emit } from "../events.js";
import { money, snoozeUntil } from "../messaging/grammar.js";
import { formatWhenNY } from "../nytime.js";
import { missingDocs } from "../pipeline/docs.js";
import { latestHeadStart } from "../pipeline/headstart.js";
import { getObligation, isFinal, markDone, snooze } from "../pipeline/ledger.js";
import { spokenDeadline } from "./elevenlabs.js";

export type ToolName = "get_obligation_details" | "snooze_obligation" | "mark_obligation_done";

function called(tool: ToolName, args: Record<string, unknown>): void {
  emit("voice.tool_called", { tool, ...args });
}

/** Short strings: the agent reads this aloud. Null for an unknown obligation. */
export function obligationDetails(obligationId: string) {
  called("get_obligation_details", { obligation_id: obligationId });
  const ob = getObligation(obligationId);
  if (!ob) return null;
  const hs = latestHeadStart(ob);
  const missing = missingDocs(ob.required_docs, hs?.found_files ?? []);
  return {
    title: ob.title,
    amount: money(ob.amount_at_risk_usd),
    deadline: spokenDeadline(ob.deadline_at, now()),
    status: ob.status,
    consequence: ob.consequence,
    required_docs: ob.required_docs,
    missing_docs: missing,
    next_step: hs?.checklist[0] ?? ob.required_action,
    checklist: hs?.checklist.slice(0, 4) ?? [],
    // What the school offers (e.g. pay in full or the payment plan), from the head start's resources.
    options: hs?.resources.map((r) => `${r.name}: ${r.how_to_use}`) ?? [],
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * When to remind: an ISO time, or the student's words ("10pm", "at 10", "in 2 hours"), parsed against
 * demo time with the same parser as the "snooze <time>" text reply. Words are safer than an ISO time made
 * by the LLM, which only knows real time, not the demo clock.
 */
export function remindAt(when: string, at: Date): Date {
  const t = Date.parse(when);
  if (ISO.test(when.trim()) && Number.isFinite(t) && t > at.getTime()) return new Date(t);
  return snoozeUntil(when, at, DEFAULT_SNOOZE_MINUTES);
}

export function snoozeObligation(obligationId: string, when: string) {
  called("snooze_obligation", { obligation_id: obligationId, remind_at_iso: when });
  const ob = getObligation(obligationId);
  if (!ob || isFinal(ob)) return { ok: false as const, reason: ob ? "already closed" : "unknown obligation" };
  const at = now();
  const until = remindAt(when, at);
  snooze(ob.id, until.toISOString());
  return { ok: true as const, remind_at: until.toISOString(), remind_at_spoken: formatWhenNY(until, at) };
}

export function markObligationDone(obligationId: string) {
  called("mark_obligation_done", { obligation_id: obligationId });
  const ob = getObligation(obligationId);
  if (!ob) return { ok: false as const, reason: "unknown obligation" };
  if (isFinal(ob)) return { ok: true as const, already_done: true };
  markDone(ob.id, "call");
  return { ok: true as const };
}
