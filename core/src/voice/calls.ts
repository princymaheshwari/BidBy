// F5: finishing a call (SYSTEM_DESIGN §9.5). One shared path for the post-call webhook, the recovery poll,
// the phone page (decline) and mock completion, so every path has the same effects. Dedupe: a call is
// finished only while it is still `initiated`, whichever path gets there first.
import { now } from "../clock.js";
import { RECOVERY_AFTER_MINUTES, RING_TIMEOUT_MS } from "../config.js";
import { db } from "../db.js";
import { emit } from "../events.js";
import { callClosingText } from "../messaging/grammar.js";
import { sendToUser } from "../messaging/spectrum.js";
import { getObligation, isFinal } from "../pipeline/ledger.js";
import { callByConversation, getCall, getConversation, initiatedCalls, type Call, type ConversationData } from "./elevenlabs.js";
import { markObligationDone, snoozeObligation } from "./tools.js";

const MINUTE_MS = 60_000;

export type FailureReason = "busy" | "no-answer" | "unknown";
export type CallResult =
  | { kind: "transcript"; summary: string; transcript: { role: string; message: string }[] }
  | { kind: "failure"; reason: FailureReason };
export type FinishVia = "webhook" | "recovery" | "phone" | "timeout" | "mock";

/** A transcription result from post-call data or GET conversation; null while the call is still going. */
export function resultFromConversation(data: ConversationData): CallResult | null {
  if (data.status === "failed") return { kind: "failure", reason: "unknown" };
  if (data.status !== "done") return null;
  return {
    kind: "transcript",
    summary: data.analysis?.transcript_summary ?? "",
    transcript: (data.transcript ?? [])
      .filter((t) => t.message)
      .map((t) => ({ role: t.role ?? "unknown", message: t.message! })),
  };
}

export const failureReason = (r: unknown): FailureReason => (r === "busy" || r === "no-answer" ? r : "unknown");

/** Applies a result once. Returns false if the call is unknown or was already finished. */
export async function finishCall(callId: string, result: CallResult, via: FinishVia): Promise<boolean> {
  const call = getCall(callId);
  if (!call) return false;

  if (result.kind === "transcript") {
    const status = via === "recovery" ? "recovered" : "completed";
    const changed = db.prepare("UPDATE calls SET status = ?, summary = ?, transcript = ? WHERE id = ? AND status = 'initiated'")
      .run(status, result.summary, JSON.stringify(result.transcript), callId).changes;
    if (changed === 0) return alreadyFinished(call, via);
    if (via === "recovery") emit("call.recovered", { call_id: callId, obligation_id: call.obligation_id });
    emit("call.completed", { call_id: callId, obligation_id: call.obligation_id, status, via, summary: result.summary });
    return true;
  }

  const changed = db.prepare("UPDATE calls SET status = 'failed', summary = ? WHERE id = ? AND status = 'initiated'")
    .run(`Not connected: ${result.reason}`, callId).changes;
  if (changed === 0) return alreadyFinished(call, via);
  emit("call.failed", { call_id: callId, obligation_id: call.obligation_id, failure_reason: result.reason, via });

  const ob = getObligation(call.obligation_id);
  if (ob && !isFinal(ob)) await sendToUser(callClosingText(ob, now()), "closing", ob.id);
  return true;
}

function alreadyFinished(call: Call, via: FinishVia): false {
  console.log(`[voice] ${call.id} already ${call.status}; ignoring ${via} result`);
  return false;
}

/** For results keyed by ElevenLabs conversation_id (webhook, recovery). Unknown ids are logged and ignored. */
export async function processCallResult(conversationId: string, result: CallResult, via: FinishVia): Promise<boolean> {
  const call = callByConversation(conversationId);
  if (!call) {
    console.log(`[voice] no call for conversation ${conversationId}; ignoring ${via} result`);
    return false;
  }
  return finishCall(call.id, result, via);
}

// --- tick step: ring timeout (browser) and recovery poll (live, browser) ---

/** Calls being answered on the phone page right now: the ring timeout must not end them. */
const answering = new Map<string, number>();
export const markAnswering = (callId: string) => answering.set(callId, performance.now());

export async function checkCalls(at: Date): Promise<void> {
  for (const call of initiatedCalls()) {
    const age = at.getTime() - Date.parse(call.created_at);
    if (call.provider === "browser" && !call.conversation_id) {
      const since = answering.get(call.id);
      if (since !== undefined && performance.now() - since < 30_000) continue;
      if (age >= RING_TIMEOUT_MS) await finishCall(call.id, { kind: "failure", reason: "no-answer" }, "timeout");
      continue;
    }
    if (call.provider === "mock" || !call.conversation_id || age < RECOVERY_AFTER_MINUTES * MINUTE_MS) continue;
    try {
      const result = resultFromConversation(await getConversation(call.conversation_id));
      if (result) await finishCall(call.id, result, "recovery");
    } catch (err) {
      console.error(`[voice] recovery ${call.id}: ${(err as Error).message}`);
    }
  }
}

// --- mock completion (POST /api/demo/calls/:conversationId/complete) ---

export type MockOutcome = "completed" | "no_answer" | "declined";

export async function completeMockCall(conversationId: string, outcome: MockOutcome, say?: string):
  Promise<"unknown" | "already_processed" | "ok"> {
  const call = callByConversation(conversationId);
  if (!call || call.provider !== "mock") return "unknown";
  if (call.status !== "initiated") return "already_processed";

  if (outcome !== "completed") {
    await finishCall(call.id, { kind: "failure", reason: outcome === "declined" ? "busy" : "no-answer" }, "mock");
    return "ok";
  }

  const said = say?.trim().toLowerCase() ?? "";
  let summary = "The student listened and ended the call.";
  if (said.startsWith("snooze")) {
    const r = snoozeObligation(call.obligation_id, said.slice("snooze".length).trim());
    summary = r.ok ? `The student asked to be reminded ${r.remind_at_spoken}.` : summary;
  } else if (said === "done") {
    markObligationDone(call.obligation_id);
    summary = "The student said it is done.";
  }
  await finishCall(call.id, { kind: "transcript", summary, transcript: say ? [{ role: "user", message: say }] : [] }, "mock");
  return "ok";
}
