// Ledger reads and status changes, shared by ingest (spec 02), replies (spec 04) and voice (spec 06).
// Every status change emits an event.
import type { Domain } from "../agents/schemas.js";
import { now } from "../clock.js";
import { db } from "../db.js";
import { emit } from "../events.js";

export type ObligationStatus = "open" | "notified" | "escalated" | "done" | "snoozed" | "dismissed";
export type DoneVia = "confirmation" | "reply" | "call" | "api";

export interface Obligation {
  id: string;
  domain: Domain;
  title: string;
  amount_at_risk_usd: number;
  deadline_at: string;
  consequence: string;
  required_action: string;
  required_docs: string[];
  source_message_ids: string[];
  status: ObligationStatus;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

type ObligationRow = Omit<Obligation, "required_docs" | "source_message_ids"> & {
  required_docs: string;
  source_message_ids: string;
};

function fromRow(r: ObligationRow): Obligation {
  return { ...r, required_docs: JSON.parse(r.required_docs), source_message_ids: JSON.parse(r.source_message_ids) };
}

export const isFinal = (o: Obligation) => o.status === "done" || o.status === "dismissed";

export function getObligation(id: string): Obligation | undefined {
  const row = db.prepare("SELECT * FROM obligations WHERE id = ?").get(id) as unknown as ObligationRow | undefined;
  return row && fromRow(row);
}

export interface RawMessage {
  id: string;
  source: "email" | "slack" | "bank" | "calendar";
  sender: string;
  subject: string;
  body: string;
  received_at: string;
}

/** The stored messages with these ids, in received order (an obligation's sources). */
export function getMessages(ids: string[]): RawMessage[] {
  if (ids.length === 0) return [];
  return db.prepare(`SELECT * FROM raw_messages WHERE id IN (${ids.map(() => "?").join(", ")}) ORDER BY received_at`)
    .all(...ids) as unknown as RawMessage[];
}

/** Every obligation: unfinished first, each group by deadline. */
export function listObligations(): Obligation[] {
  const rows = db.prepare(
    `SELECT * FROM obligations
     ORDER BY CASE WHEN status IN ('done', 'dismissed') THEN 1 ELSE 0 END, deadline_at`,
  ).all() as unknown as ObligationRow[];
  return rows.map(fromRow);
}

/** Obligations that are not done or dismissed, by deadline. */
export function getOpen(): Obligation[] {
  return listObligations().filter((o) => !isFinal(o));
}

function setStatus(id: string, status: ObligationStatus, snoozedUntil: string | null = null): Obligation {
  db.prepare("UPDATE obligations SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ?")
    .run(status, snoozedUntil, now().toISOString(), id);
  return getObligation(id)!;
}

/** Marks an unfinished obligation done. Returns undefined if it is unknown or already finished. */
export function markDone(id: string, via: DoneVia): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || isFinal(ob)) return undefined;
  const done = setStatus(id, "done");
  emit("obligation.done", {
    id, title: done.title, via, amount_at_risk_usd: done.amount_at_risk_usd, protected_total: protectedTotal(),
  });
  return done;
}

/** BidBy texted the user about this open obligation (spec 04 notify rule). */
export function markNotified(id: string): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || ob.status !== "open") return undefined;
  const notified = setStatus(id, "notified");
  emit("obligation.notified", { id, title: notified.title });
  return notified;
}

/** BidBy is calling the user about this item (spec 06). Escalation stops on done, like notified. */
export function markEscalated(id: string): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || isFinal(ob) || ob.status === "escalated") return undefined;
  const escalated = setStatus(id, "escalated");
  emit("obligation.escalated", { id, title: escalated.title });
  return escalated;
}

/** A snooze ran out: the obligation is back in play as notified (the user already knows about it). */
export function wake(id: string): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || ob.status !== "snoozed") return undefined;
  const woken = setStatus(id, "notified");
  emit("obligation.woke", { id, title: woken.title, snoozed_until: ob.snoozed_until });
  return woken;
}

export function snooze(id: string, untilIso: string): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || isFinal(ob)) return undefined;
  const snoozed = setStatus(id, "snoozed", untilIso);
  emit("obligation.snoozed", { id, title: snoozed.title, until: untilIso });
  return snoozed;
}

export function dismiss(id: string): Obligation | undefined {
  const ob = getObligation(id);
  if (!ob || isFinal(ob)) return undefined;
  const dismissed = setStatus(id, "dismissed");
  emit("obligation.dismissed", { id, title: dismissed.title });
  return dismissed;
}

const monthNY = (at: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).format(at);

/** Dollars protected this month: amount at risk of obligations marked done this (New York) month. */
export function protectedTotal(): number {
  const month = monthNY(now());
  const rows = db.prepare("SELECT amount_at_risk_usd, updated_at FROM obligations WHERE status = 'done'")
    .all() as unknown as { amount_at_risk_usd: number; updated_at: string }[];
  const total = rows
    .filter((r) => monthNY(new Date(r.updated_at)) === month)
    .reduce((sum, r) => sum + r.amount_at_risk_usd, 0);
  return Math.round(total * 100) / 100;
}
