// F4: reply grammar (SYSTEM_DESIGN §9.3, §10 flow D): dedupe -> parse -> act -> log.
// Replies apply to the current item: the obligation BidBy texted about most recently.
import { callAgent, type AgentId } from "../agents/openclaw.js";
import { answerUser } from "../agents/schemas.js";
import { formatNY, now } from "../clock.js";
import { DEFAULT_SNOOZE_MINUTES, MAX_FOLLOW_UPS, config } from "../config.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { formatTimeNY } from "../nytime.js";
import { docStatus } from "../pipeline/docs.js";
import { headStart, latestHeadStart } from "../pipeline/headstart.js";
import { dismiss, getObligation, getOpen, isFinal, markDone, protectedTotal, snooze, type Obligation } from "../pipeline/ledger.js";
import { latestScores } from "../pipeline/rank.js";
import { canEmail, fromAddress, parseDraft, recipientFor, sendEmail } from "./email.js";
import {
  checklistText, draftFooter, headStartChecklistText, money, parseReply, snoozeUntil, statusText, type Reply,
} from "./grammar.js";
import { sendToUser } from "./spectrum.js";

const DRAFT_PREFIX = "Draft for ";

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
    // The head start is normally written before the interrupt; headStart() reuses it (or writes one now).
    case "draft": {
      const hs = await headStart(item.id);
      if (!hs?.draft_text) {
        await sendToUser(`Next step for ${item.title}: ${item.required_action}`, "reply", item.id);
        return;
      }
      const to = recipientFor(item);
      const footer = draftFooter(to, fromAddress(), !!to && canEmail(to));
      await sendToUser(`${DRAFT_PREFIX}${item.title}:\n\n${hs.draft_text}\n\n${footer}`, "reply", item.id);
      return;
    }
    case "send":
      await sendDraft(item);
      return;
    case "checklist": {
      const hs = await headStart(item.id);
      const body = hs
        ? headStartChecklistText(item.title, docStatus(item.required_docs, hs.found_files), hs.checklist, hs.resources)
        : checklistText(item.title, item.required_docs.length ? item.required_docs : [item.required_action]);
      await sendToUser(body, "reply", item.id);
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

/** Emails the draft the user was shown, after they replied "send". Every outcome is an event and a text. */
async function sendDraft(item: Obligation): Promise<void> {
  const hs = latestHeadStart(item);
  const shown = db.prepare("SELECT 1 FROM outbound_texts WHERE obligation_id = ? AND body LIKE ? LIMIT 1")
    .get(item.id, `${DRAFT_PREFIX}%`);
  if (!hs?.draft_text || !shown) {
    await sendToUser("Reply 1 first so you can read the draft before I send it.", "reply", item.id);
    return;
  }
  const already = db.prepare(
    "SELECT json_extract(payload, '$.to') AS to_addr FROM events WHERE type = 'email.sent' AND json_extract(payload, '$.head_start_id') = ? LIMIT 1",
  ).get(hs.id) as { to_addr: string } | undefined;
  if (already) {
    await sendToUser(`Already sent to ${already.to_addr}.`, "reply", item.id);
    return;
  }

  const to = recipientFor(item);
  if (!to || !canEmail(to)) {
    emit("email.refused", { obligation_id: item.id, to, reason: to ? "not in ALLOWED_EMAIL_RECIPIENTS" : "no recipient" });
    await sendToUser(draftFooter(to, null, false), "reply", item.id);
    return;
  }
  const { subject, body } = parseDraft(hs.draft_text);
  const blank = /\[[^\]]{2,40}\]/.exec(`${subject}\n${body}`);
  if (blank) {
    emit("email.refused", { obligation_id: item.id, to, reason: `draft still has a placeholder ${blank[0]}` });
    await sendToUser(`The draft still has ${blank[0]} in it, so I didn't send it. Send it yourself after filling that in.`, "reply", item.id);
    return;
  }
  try {
    const { message_id } = await sendEmail(to, subject, body);
    emit("email.sent", { obligation_id: item.id, head_start_id: hs.id, to, subject, mode: config.EMAIL_MODE, message_id });
  } catch (err) {
    emit("email.failed", { obligation_id: item.id, to, error: (err as Error).message.slice(0, 200) });
    await sendToUser("I couldn't send the email just now. The draft is above if you want to send it yourself.", "reply", item.id);
    return;
  }
  const next = hs.checklist[0] ? ` Next: ${hs.checklist[0]}` : "";
  await sendToUser(`Sent to ${to}: “${subject}”.${next}`, "reply", item.id);
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

export function followUpsSent(obligationId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM outbound_texts WHERE obligation_id = ? AND kind = 'follow_up'")
    .get(obligationId) as { n: number };
  return row.n;
}
