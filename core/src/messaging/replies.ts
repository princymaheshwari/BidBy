// F4: reply grammar (SYSTEM_DESIGN §9.3, §10 flow D): dedupe -> parse -> act -> log.
// Replies apply to the current item: the obligation BidBy texted about most recently.
import { callAgent, type AgentId } from "../agents/openclaw.js";
import { answerUser } from "../agents/schemas.js";
import { formatNY, now } from "../clock.js";
import { DEFAULT_SNOOZE_MINUTES, MAX_FOLLOW_UPS } from "../config.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { formatTimeNY } from "../nytime.js";
import { dismiss, getObligation, getOpen, isFinal, markDone, protectedTotal, snooze, type Obligation } from "../pipeline/ledger.js";
import { latestScores } from "../pipeline/rank.js";
import { checklistText, money, parseReply, snoozeUntil, statusText, type Reply } from "./grammar.js";
import { sendToUser } from "./spectrum.js";

// Texts sent before core started (by more than this) are logged, not acted on: no surprise replies on boot.
const STALE_MS = 5 * 60_000;
const MAX_ANSWER_SENTENCES = 3;

export interface InboundText {
  spectrum_message_id: string;
  text: string;
  sent_at?: Date;
}

export async function handleReply(msg: InboundText): Promise<void> {
  const id = newId("rep");
  const inserted = db.prepare(
    "INSERT OR IGNORE INTO inbound_replies (id, spectrum_message_id, text, parsed_action, received_at) VALUES (?, ?, ?, NULL, ?)",
  ).run(id, msg.spectrum_message_id, msg.text, now().toISOString());
  if (inserted.changes === 0) return; // duplicate delivery of a message already handled

  if (msg.sent_at && msg.sent_at.getTime() < performance.timeOrigin - STALE_MS) {
    setParsed(id, "stale", null);
    emit("text.received", { id, text: msg.text, parsed_action: "stale" });
    return;
  }

  const current = currentItem();
  const reply = parseReply(msg.text);
  setParsed(id, reply.action, current?.id ?? null);
  emit("text.received", { id, text: msg.text, parsed_action: reply.action, obligation_id: current?.id ?? null });
  await act(reply, current);
}

/** parsed_action is "<action>:<obligation_id>" so the timer can tell which item a reply was about. */
function setParsed(replyId: string, action: string, obligationId: string | null): void {
  db.prepare("UPDATE inbound_replies SET parsed_action = ? WHERE id = ?")
    .run(obligationId ? `${action}:${obligationId}` : action, replyId);
}

/** The obligation of the latest text BidBy sent about one (digests and status replies have none). */
export function currentItem(): Obligation | undefined {
  const row = db.prepare(
    "SELECT obligation_id FROM outbound_texts WHERE obligation_id IS NOT NULL ORDER BY rowid DESC LIMIT 1",
  ).get() as { obligation_id: string } | undefined;
  return row ? getObligation(row.obligation_id) : undefined;
}

async function act(reply: Reply, item: Obligation | undefined): Promise<void> {
  const at = now();
  if (reply.action === "status") {
    const scores = latestScores();
    const open = getOpen().sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    await sendToUser(statusText(open, at, protectedTotal()), "reply", null);
    return;
  }

  if (!item) {
    await sendToUser("Nothing is waiting on you right now. Reply status to see what's open.", "reply", null);
    return;
  }
  if (isFinal(item) && reply.action !== "ask") {
    await sendToUser(`${item.title} is already closed. Reply status to see what's open.`, "reply", null);
    return;
  }

  switch (reply.action) {
    case "draft": {
      const hs = latestHeadStart(item.id);
      const body = hs?.draft_text
        ? `Draft for ${item.title}:\n\n${hs.draft_text}`
        : `Next step for ${item.title}: ${item.required_action}`; // until spec 05 writes head starts
      await sendToUser(body, "reply", item.id);
      return;
    }
    case "checklist": {
      const steps = latestHeadStart(item.id)?.checklist ?? [];
      const lines = steps.length ? steps : item.required_docs.length ? item.required_docs : [item.required_action];
      await sendToUser(checklistText(item.title, lines), "reply", item.id);
      return;
    }
    case "done": {
      markDone(item.id, "reply");
      await sendToUser(`Marked done. ${money(item.amount_at_risk_usd)} protected.`, "closing", item.id);
      return;
    }
    case "dismiss": {
      dismiss(item.id);
      await sendToUser(`Dismissed ${item.title}. I won't text about it again.`, "closing", item.id);
      return;
    }
    case "snooze": {
      const until = snoozeUntil(reply.when, at, DEFAULT_SNOOZE_MINUTES);
      snooze(item.id, until.toISOString());
      const reminderLeft = followUpsSent(item.id) < MAX_FOLLOW_UPS;
      await sendToUser(
        reminderLeft ? `Okay, I'll text you again at ${formatTimeNY(until)}.` : `Snoozed until ${formatTimeNY(until)}.`,
        "reply", item.id,
      );
      return;
    }
    case "ask":
      await sendToUser(await answer(item, reply.text, at), "reply", item.id);
      return;
  }
}

/** The current item's domain agent answers free text via answer_user (at most 3 sentences). */
async function answer(item: Obligation, text: string, at: Date): Promise<string> {
  const context = {
    obligation: {
      id: item.id, title: item.title, status: item.status, amount_at_risk_usd: item.amount_at_risk_usd,
      deadline_at: item.deadline_at, consequence: item.consequence, required_action: item.required_action,
      required_docs: item.required_docs,
    },
    student_text: text,
  };
  const prompt =
    "Task: the student replied to BidBy's text about the obligation below. Answer them with answer_user " +
    "in at most 3 sentences.\n" +
    `now: ${at.toISOString()} (${formatNY(at)})\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`;
  const result = await callAgent(item.domain as AgentId, prompt, answerUser);
  if (!result) return "I couldn't answer that just now. Reply 1 for the draft, 2 for the checklist, or done.";
  return result.answer.trim().split(/(?<=[.!?])\s+/).slice(0, MAX_ANSWER_SENTENCES).join(" ");
}

function latestHeadStart(obligationId: string): { draft_text: string; checklist: string[] } | undefined {
  const row = db.prepare("SELECT draft_text, checklist FROM head_starts WHERE obligation_id = ? ORDER BY rowid DESC LIMIT 1")
    .get(obligationId) as { draft_text: string; checklist: string } | undefined;
  return row && { draft_text: row.draft_text, checklist: JSON.parse(row.checklist) };
}

export function followUpsSent(obligationId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM outbound_texts WHERE obligation_id = ? AND kind = 'follow_up'")
    .get(obligationId) as { n: number };
  return row.n;
}
