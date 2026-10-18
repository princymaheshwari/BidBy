// F5: start a call (SYSTEM_DESIGN §9.4). One entry point for every VOICE_MODE:
//   live      ElevenLabs dials USER_PHONE through the imported Twilio number (or a SIP trunk), allowlist first
//   browser   no dialing: the phone page (GET /voice/phone) rings and starts a WebRTC session with the same agent
//   mock      no request; finished by hand with POST /api/demo/calls/:conversationId/complete
//   dashboard no request; the dynamic variables are shown so the call can be started from the ElevenLabs dashboard
import { now } from "../clock.js";
import { CALL_COOLDOWN_MINUTES, config } from "../config.js";
import { db, getSettings, newId } from "../db.js";
import { emit } from "../events.js";
import { formatWhenNY } from "../nytime.js";
import { latestHeadStart } from "../pipeline/headstart.js";
import { getObligation, isFinal, markEscalated, type Obligation } from "../pipeline/ledger.js";

const API = "https://api.elevenlabs.io";
const MINUTE_MS = 60_000;

/** The telephony switch: same request body for both (VOICE_PROVIDER). */
export const OUTBOUND_PATHS = {
  twilio: "/v1/convai/twilio/outbound-call",
  sip: "/v1/convai/sip-trunk/outbound-call",
} as const;

export type CallProvider = "twilio" | "sip" | "mock" | "browser";
export type CallStatus = "initiated" | "completed" | "recovered" | "failed";

export interface Call {
  id: string;
  obligation_id: string;
  provider: CallProvider;
  conversation_id: string | null;
  provider_call_id: string | null;
  status: CallStatus;
  summary: string | null;
  transcript: string | null;
  created_at: string;
}

export function getCall(id: string): Call | undefined {
  return db.prepare("SELECT * FROM calls WHERE id = ?").get(id) as unknown as Call | undefined;
}

export function callByConversation(conversationId: string): Call | undefined {
  return db.prepare("SELECT * FROM calls WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1")
    .get(conversationId) as unknown as Call | undefined;
}

export function initiatedCalls(): Call[] {
  return db.prepare("SELECT * FROM calls WHERE status = 'initiated' ORDER BY rowid").all() as unknown as Call[];
}

// --- dynamic variables (read aloud by the agent) ---

/** "3,700 dollars", "14 dollars and 99 cents" */
export function spokenAmount(usd: number): string {
  const dollars = Math.floor(usd);
  const cents = Math.round((usd - dollars) * 100);
  const d = `${dollars.toLocaleString("en-US")} ${dollars === 1 ? "dollar" : "dollars"}`;
  return cents ? `${d} and ${cents} cents` : d;
}

/** "tonight at 11:59 PM", "tomorrow at 9:00 AM" (relative to demo time) */
export function spokenDeadline(deadlineAt: string, at: Date): string {
  return formatWhenNY(new Date(deadlineAt), at).replace(/ (\d)/, " at $1");
}

export function dynamicVariables(ob: Obligation, at: Date): Record<string, string> {
  return {
    obligation_id: ob.id,
    title: ob.title,
    amount: spokenAmount(ob.amount_at_risk_usd),
    deadline: spokenDeadline(ob.deadline_at, at),
    next_step: latestHeadStart(ob)?.checklist[0] ?? ob.required_action,
  };
}

// --- start a call ---

/** Never two calls about the same item within CALL_COOLDOWN_MINUTES of demo time (any outcome counts). */
function calledRecently(obligationId: string, at: Date): boolean {
  const row = db.prepare("SELECT created_at FROM calls WHERE obligation_id = ? ORDER BY rowid DESC LIMIT 1")
    .get(obligationId) as { created_at: string } | undefined;
  if (!row) return false;
  const age = at.getTime() - Date.parse(row.created_at);
  return age >= 0 && age < CALL_COOLDOWN_MINUTES * MINUTE_MS;
}

function insertCall(ob: Obligation, provider: CallProvider, conversationId: string | null,
  providerCallId: string | null, status: CallStatus): Call {
  const id = newId("call");
  db.prepare(
    `INSERT INTO calls (id, obligation_id, provider, conversation_id, provider_call_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, ob.id, provider, conversationId, providerCallId, status, now().toISOString());
  return getCall(id)!;
}

function begin(ob: Obligation, provider: CallProvider, conversationId: string | null, providerCallId: string | null): Call {
  const call = insertCall(ob, provider, conversationId, providerCallId, "initiated");
  markEscalated(ob.id);
  emit("call.started", { call_id: call.id, obligation_id: ob.id, provider, conversation_id: conversationId });
  return call;
}

/** Calls the user about an obligation. `force` skips the cooldown (local demo route only). */
export async function startCall(obligationId: string, opts: { force?: boolean } = {}): Promise<Call | undefined> {
  const ob = getObligation(obligationId);
  if (!ob || isFinal(ob)) return undefined;
  const at = now();
  if (!opts.force && calledRecently(ob.id, at)) return undefined;
  const vars = dynamicVariables(ob, at);

  switch (config.VOICE_MODE) {
    case "dashboard":
      markEscalated(ob.id);
      emit("call.manual_needed", { obligation_id: ob.id, dynamic_variables: vars });
      return undefined;
    case "mock":
      return begin(ob, "mock", `conv_mock_${ob.id}`, null);
    case "browser": {
      const call = begin(ob, "browser", null, null);
      emit("call.ringing", { call_id: call.id, obligation_id: ob.id, title: ob.title, amount: vars.amount, deadline: vars.deadline });
      return call;
    }
    case "live":
      return dial(ob, vars);
  }
}

async function dial(ob: Obligation, vars: Record<string, string>): Promise<Call | undefined> {
  const to = getSettings().user_phone;
  if (!config.ALLOWED_DIAL_NUMBERS.includes(to)) {
    const refused = db.prepare(
      "SELECT 1 FROM events WHERE type = 'call.refused' AND json_extract(payload, '$.obligation_id') = ? LIMIT 1",
    ).get(ob.id);
    if (!refused) emit("call.refused", { obligation_id: ob.id, reason: "not_allowlisted" });
    return undefined;
  }

  type OutboundResponse = {
    success?: boolean; message?: string; conversation_id?: string | null; callSid?: string | null; sip_call_id?: string | null;
  };
  let body: OutboundResponse = {};
  let status = 0;
  try {
    const res = await fetch(`${API}${OUTBOUND_PATHS[config.VOICE_PROVIDER]}`, {
      method: "POST",
      headers: { "xi-api-key": config.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: config.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: config.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: to,
        conversation_initiation_client_data: { dynamic_variables: vars },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    body = (await res.json().catch(() => ({}))) as OutboundResponse;
  } catch (err) {
    body = { success: false, message: (err as Error).message };
  }

  if (!body.success || !body.conversation_id) {
    // A failed row keeps the cooldown, so the tick doesn't retry every 5 seconds.
    insertCall(ob, config.VOICE_PROVIDER, null, null, "failed");
    emit("call.failed", { obligation_id: ob.id, message: body.message ?? `HTTP ${status}` });
    return undefined;
  }
  return begin(ob, config.VOICE_PROVIDER, body.conversation_id, body.callSid ?? body.sip_call_id ?? null);
}

// --- ElevenLabs reads ---

/** A short-lived WebRTC conversation token for the phone page; the API key never leaves core. */
export async function conversationToken(): Promise<string> {
  const res = await fetch(
    `${API}/v1/convai/conversation/token?agent_id=${encodeURIComponent(config.ELEVENLABS_AGENT_ID ?? "")}`,
    { headers: { "xi-api-key": config.ELEVENLABS_API_KEY ?? "" }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`conversation token: HTTP ${res.status}`);
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error("conversation token: empty response");
  return token;
}

export interface ConversationData {
  conversation_id?: string;
  status?: string;
  transcript?: { role?: string; message?: string | null; time_in_call_secs?: number }[];
  analysis?: { transcript_summary?: string | null } | null;
}

/** GET /v1/convai/conversations/:id (recovery poll); same shape as the post-call webhook's data. */
export async function getConversation(conversationId: string): Promise<ConversationData> {
  const res = await fetch(`${API}/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": config.ELEVENLABS_API_KEY ?? "" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`get conversation: HTTP ${res.status}`);
  return (await res.json()) as ConversationData;
}
