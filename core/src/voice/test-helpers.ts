// Shared fixtures for the voice tests (after ./test-env.js has set up the scratch database).
import { mock } from "node:test";
import { setTo } from "../clock.js";
import { clearAll, db, newId } from "../db.js";
import type { Obligation } from "../pipeline/ledger.js";

/** Sunday Oct 18 2026, 9:00 PM New York: "Jump to 9 PM" in the demo. */
export const NINE_PM = "2026-10-18T21:00:00-04:00";

export function freshState(at = NINE_PM): void {
  clearAll();
  setTo(at);
}

export function addObligation(fields: Partial<Obligation> = {}): string {
  const id = fields.id ?? newId("ob");
  db.prepare(
    `INSERT INTO obligations (id, domain, title, amount_at_risk_usd, deadline_at, consequence, required_action,
       required_docs, source_message_ids, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
  ).run(
    id, fields.domain ?? "aid", fields.title ?? "FAFSA verification", fields.amount_at_risk_usd ?? 3700,
    fields.deadline_at ?? "2026-10-18T23:59:00-04:00", fields.consequence ?? "Aid stays on hold",
    fields.required_action ?? "Upload your tax transcript to the aid portal",
    JSON.stringify(fields.required_docs ?? ["2025 IRS Tax Return Transcript", "Verification Worksheet (signed)"]),
    fields.status ?? "notified", NINE_PM, NINE_PM,
  );
  return id;
}

export function eventsOf(type: string): Record<string, unknown>[] {
  return (db.prepare("SELECT payload FROM events WHERE type = ? ORDER BY rowid").all(type) as { payload: string }[])
    .map((r) => JSON.parse(r.payload));
}

export function textsOf(kind: string): { body: string; obligation_id: string | null }[] {
  const rows = db.prepare("SELECT body, obligation_id FROM outbound_texts WHERE kind = ? ORDER BY rowid").all(kind) as
    unknown as { body: string; obligation_id: string | null }[];
  return rows.map((r) => ({ body: r.body, obligation_id: r.obligation_id })); // plain objects for deepEqual
}

/** Response JSON, loosely typed for assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const json = async (res: Response): Promise<any> => res.json();

/** Replaces global fetch for one test; returns the mock so calls can be inspected. */
export function stubFetch(respond: (url: string, init?: RequestInit) => unknown) {
  return mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) =>
    new Response(JSON.stringify(respond(String(url), init)), { status: 200, headers: { "content-type": "application/json" } }));
}
