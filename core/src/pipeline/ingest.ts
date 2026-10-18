// F1: message -> extractor -> new or merged obligations; confirmations close items (SYSTEM_DESIGN §10 flow A).
import { callAgent } from "../agents/openclaw.js";
import { recordObligations, type RecordObligations } from "../agents/schemas.js";
import { formatNY, now } from "../clock.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { getObligation, getOpen, markDone, type Obligation } from "./ledger.js";
import { rankSoon } from "./rank.js";

export interface IncomingMessage {
  source: "email" | "slack" | "bank";
  sender: string;
  subject: string;
  body: string;
  received_at: string;
}

export interface IngestResult {
  raw_message_id: string;
  obligation_ids: string[];
  completed_ids: string[];
}

type Extracted = RecordObligations["obligations"][number];

/**
 * Stores and extracts one message. If the ledger changed, a ranking round starts in the background
 * unless `rank: false` (reset seeds many messages, then ranks once).
 */
export async function ingest(
  msg: IncomingMessage,
  opts: { fixture_id?: string; rank?: boolean } = {},
): Promise<IngestResult> {
  const raw_message_id = newId("msg");
  db.prepare(
    "INSERT INTO raw_messages (id, source, sender, subject, body, received_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(raw_message_id, msg.source, msg.sender, msg.subject, msg.body, msg.received_at);
  emit("message.received", {
    raw_message_id, fixture_id: opts.fixture_id, source: msg.source, sender: msg.sender, subject: msg.subject,
  });

  const result: IngestResult = { raw_message_id, obligation_ids: [], completed_ids: [] };
  const open = getOpen();
  const extracted = await callAgent("extractor", buildPrompt(msg, open), recordObligations);
  if (!extracted) {
    emit("message.unprocessed", { raw_message_id, subject: msg.subject });
    return result;
  }
  if (extracted.is_suspicious) {
    emit("message.flagged", {
      raw_message_id, sender: msg.sender, subject: msg.subject, reason: "looks like phishing; BidBy will not act on it",
    });
    return result;
  }
  if (extracted.is_noise) {
    emit("message.noise", { raw_message_id, subject: msg.subject });
    return result;
  }

  // The extractor may only merge into or complete obligations it was shown.
  const openIds = new Set(open.map((o) => o.id));
  for (const ob of extracted.obligations) {
    const id = ob.merge_with && openIds.has(ob.merge_with)
      ? mergeInto(ob.merge_with, ob, raw_message_id)
      : insertObligation(ob, raw_message_id);
    result.obligation_ids.push(id);
  }
  for (const id of extracted.completes) {
    if (openIds.has(id) && markDone(id, "confirmation")) result.completed_ids.push(id);
  }
  const changed = result.obligation_ids.length > 0 || result.completed_ids.length > 0;
  if (changed && opts.rank !== false) rankSoon();
  return result;
}

function buildPrompt(msg: IncomingMessage, open: Obligation[]): string {
  const t = now();
  const context = {
    message: msg,
    open_obligations: open.map(({ id, domain, title, deadline_at, amount_at_risk_usd }) =>
      ({ id, domain, title, deadline_at, amount_at_risk_usd })),
  };
  return (
    "Task: extract the money obligations from this one incoming message. Call record_obligations.\n" +
    `now: ${t.toISOString()} (${formatNY(t)})\n\n` +
    `Context (JSON):\n${JSON.stringify(context, null, 2)}`
  );
}

function insertObligation(ob: Extracted, rawMessageId: string): string {
  const id = newId("ob");
  const at = now().toISOString();
  db.prepare(
    `INSERT INTO obligations (id, domain, title, amount_at_risk_usd, deadline_at, consequence, required_action,
       required_docs, source_message_ids, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
  ).run(id, ob.domain, ob.title, ob.amount_at_risk_usd, ob.deadline_at, ob.consequence, ob.required_action,
    JSON.stringify(ob.required_docs), JSON.stringify([rawMessageId]), at, at);
  emit("obligation.created", {
    id, domain: ob.domain, title: ob.title, amount_at_risk_usd: ob.amount_at_risk_usd,
    deadline_at: ob.deadline_at, raw_message_id: rawMessageId,
  });
  return id;
}

/** Updates the fields this message changed and records it as a source. */
function mergeInto(id: string, ob: Extracted, rawMessageId: string): string {
  const cur = getObligation(id)!;
  const changed: string[] = [];
  if (ob.title !== cur.title) changed.push("title");
  if (ob.amount_at_risk_usd !== cur.amount_at_risk_usd) changed.push("amount_at_risk_usd");
  if (Date.parse(ob.deadline_at) !== Date.parse(cur.deadline_at)) changed.push("deadline_at");
  if (ob.consequence !== cur.consequence) changed.push("consequence");
  if (ob.required_action !== cur.required_action) changed.push("required_action");
  if (JSON.stringify(ob.required_docs) !== JSON.stringify(cur.required_docs)) changed.push("required_docs");

  const sources = cur.source_message_ids.includes(rawMessageId)
    ? cur.source_message_ids
    : [...cur.source_message_ids, rawMessageId];
  db.prepare(
    `UPDATE obligations SET title = ?, amount_at_risk_usd = ?, deadline_at = ?, consequence = ?, required_action = ?,
       required_docs = ?, source_message_ids = ?, updated_at = ? WHERE id = ?`,
  ).run(ob.title, ob.amount_at_risk_usd, ob.deadline_at, ob.consequence, ob.required_action,
    JSON.stringify(ob.required_docs), JSON.stringify(sources), now().toISOString(), id);
  emit("obligation.updated", { id, title: ob.title, changed, raw_message_id: rawMessageId });
  return id;
}
