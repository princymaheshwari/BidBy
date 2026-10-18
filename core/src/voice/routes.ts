// F5 routes under /voice/* — the only paths the tunnel may reach, and every one checks a secret:
//   /voice/tools/*   ElevenLabs webhook tools        Authorization: Bearer BIDBY_TOOL_SECRET
//   /voice/postcall  ElevenLabs post-call webhook    ElevenLabs-Signature (HMAC, ELEVENLABS_WEBHOOK_SECRET)
//   /voice/phone*    the phone page (browser mode)   ?k= or X-BidBy-Key: BIDBY_PHONE_KEY
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { now } from "../clock.js";
import { config } from "../config.js";
import { db } from "../db.js";
import { emit } from "../events.js";
import { money } from "../messaging/grammar.js";
import { getObligation } from "../pipeline/ledger.js";
import { failureReason, finishCall, markAnswering, markHungUp, processCallResult, resultFromConversation } from "./calls.js";
import { conversationToken, dynamicVariables, getCall, type Call } from "./elevenlabs.js";
import { markObligationDone, obligationDetails, snoozeObligation } from "./tools.js";

const PHONE_HTML = resolve(import.meta.dirname, "../../public/phone.html");

export const voice = new Hono();

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Mounted first on the whole app: a request that came through the Cloudflare tunnel (Cloudflare adds
 * CF-Connecting-IP / CF-Ray) may reach /voice/* only. The judge view and /api/* stay local.
 */
export const tunnelGuard: MiddlewareHandler = async (c, next) => {
  const viaTunnel = c.req.header("cf-connecting-ip") !== undefined || c.req.header("cf-ray") !== undefined;
  if (viaTunnel && !c.req.path.startsWith("/voice/")) return c.text("Not found", 404);
  await next();
};

// --- webhook tools ---

/** The token in an Authorization header: "Bearer <t>", tolerating case, extra spaces, a doubled or missing "Bearer". */
export function bearerToken(header: string | undefined): string {
  let t = (header ?? "").trim();
  for (let i = 0; i < 2 && /^bearer\s+/i.test(t); i++) t = t.replace(/^bearer\s+/i, "").trim();
  return t;
}

/** What was wrong with a rejected header, for the log. Lengths and shape only, never the value. */
function describeAuth(header: string | undefined, secret: string): string {
  if (!header) return "no Authorization header";
  const token = bearerToken(header);
  const bearers = (header.match(/bearer\s+/gi) ?? []).length;
  return `Authorization: ${header.length} chars, "Bearer" x${bearers}, token ${token.length} chars (expected ${secret.length})`;
}

voice.use("/tools/*", async (c, next) => {
  const secret = config.BIDBY_TOOL_SECRET;
  const header = c.req.header("authorization");
  if (!secret || !safeEqual(bearerToken(header), secret)) {
    console.warn(`[voice] tool ${c.req.path} rejected: ${secret ? describeAuth(header, secret) : "BIDBY_TOOL_SECRET not set"}`);
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

const ToolBody = z.object({ obligation_id: z.string().min(1) });
const SnoozeBody = ToolBody.extend({ remind_at_iso: z.string().default("") });

voice.post("/tools/details", async (c) => {
  const body = ToolBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {obligation_id}" }, 400);
  const details = obligationDetails(body.data.obligation_id);
  return details ? c.json(details) : c.json({ error: "unknown obligation" }, 404);
});

voice.post("/tools/snooze", async (c) => {
  const body = SnoozeBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {obligation_id, remind_at_iso}" }, 400);
  return c.json(snoozeObligation(body.data.obligation_id, body.data.remind_at_iso));
});

voice.post("/tools/done", async (c) => {
  const body = ToolBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {obligation_id}" }, 400);
  return c.json(markObligationDone(body.data.obligation_id));
});

// --- post-call webhook ---

let webhookClient: ElevenLabsClient | undefined;

voice.post("/postcall", async (c) => {
  const raw = await c.req.text();
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    webhookClient ??= new ElevenLabsClient({ apiKey: config.ELEVENLABS_API_KEY ?? "unused" });
    event = await webhookClient.webhooks.constructEvent(
      raw, c.req.header("elevenlabs-signature") ?? "", config.ELEVENLABS_WEBHOOK_SECRET ?? "",
    );
  } catch {
    return c.json({ error: "bad signature" }, 401);
  }
  // Acknowledge first; process after the response (ElevenLabs retries slow webhooks).
  setImmediate(() => void handlePostCall(event).catch((err) => console.error(`[voice] postcall: ${(err as Error).message}`)));
  return c.json({ ok: true });
});

export async function handlePostCall(event: { type?: string; data?: Record<string, unknown> }): Promise<void> {
  const conversationId = typeof event.data?.conversation_id === "string" ? event.data.conversation_id : "";
  if (!conversationId) return;
  if (event.type === "post_call_transcription") {
    const result = resultFromConversation({ ...event.data, status: "done" });
    if (result) await processCallResult(conversationId, result, "webhook");
  } else if (event.type === "call_initiation_failure") {
    await processCallResult(conversationId, { kind: "failure", reason: failureReason(event.data?.failure_reason) }, "webhook");
  } // post_call_audio and anything else: acknowledged, ignored
}

// --- phone page (VOICE_MODE=browser) ---

const phoneKey: MiddlewareHandler = async (c, next) => {
  const key = config.BIDBY_PHONE_KEY;
  const given = c.req.header("x-bidby-key") ?? c.req.query("k") ?? "";
  if (!key || !safeEqual(given, key)) return c.text("unauthorized", 401);
  await next();
};
voice.use("/phone", phoneKey);
voice.use("/phone/*", phoneKey);

// Read on each request so edits to the page show up without a restart.
voice.get("/phone", (c) => c.html(readFileSync(PHONE_HTML, "utf8")));

/** The browser call that is ringing or in progress, if any. Polled by the page (robust through the tunnel). */
function activeBrowserCall(): Call | undefined {
  return db.prepare("SELECT * FROM calls WHERE provider = 'browser' AND status = 'initiated' ORDER BY rowid DESC LIMIT 1")
    .get() as unknown as Call | undefined;
}

voice.get("/phone/state", (c) => {
  const call = activeBrowserCall();
  const ob = call && getObligation(call.obligation_id);
  if (!call || !ob) return c.json({ call: null });
  return c.json({
    call: {
      id: call.id,
      phase: call.conversation_id ? "in_call" : "ringing",
      title: ob.title,
      amount: money(ob.amount_at_risk_usd),
      deadline: dynamicVariables(ob, now()).deadline,
    },
  });
});

const CallBody = z.object({ call_id: z.string() });

/** A ringing browser call, or an error response for the page. */
function ringing(callId: string): Call | string {
  const call = getCall(callId);
  if (!call || call.provider !== "browser") return "unknown call";
  if (call.status !== "initiated") return "call already ended";
  if (call.conversation_id) return "call already answered";
  return call;
}

voice.post("/phone/answer", async (c) => {
  const body = CallBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {call_id}" }, 400);
  const call = ringing(body.data.call_id);
  if (typeof call === "string") return c.json({ error: call }, 409);
  const ob = getObligation(call.obligation_id);
  if (!ob) return c.json({ error: "unknown obligation" }, 409);

  markAnswering(call.id);
  try {
    const token = await conversationToken();
    return c.json({ token, dynamic_variables: dynamicVariables(ob, now()) });
  } catch (err) {
    console.error(`[voice] ${(err as Error).message}`);
    return c.json({ error: "couldn't start the call" }, 502);
  }
});

const AttachBody = CallBody.extend({ conversation_id: z.string().min(1) });

voice.post("/phone/attach", async (c) => {
  const body = AttachBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {call_id, conversation_id}" }, 400);
  const changed = db.prepare(
    "UPDATE calls SET conversation_id = ? WHERE id = ? AND provider = 'browser' AND status = 'initiated' AND conversation_id IS NULL",
  ).run(body.data.conversation_id, body.data.call_id).changes;
  if (changed === 0) return c.json({ error: "call already answered or ended" }, 409);
  const call = getCall(body.data.call_id)!;
  emit("call.answered", { call_id: call.id, obligation_id: call.obligation_id, conversation_id: call.conversation_id });
  return c.json({ ok: true });
});

// The page hung up (either side): fetch the result now instead of waiting for the post-call webhook.
voice.post("/phone/ended", async (c) => {
  const body = CallBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {call_id}" }, 400);
  const call = getCall(body.data.call_id);
  if (!call || call.provider !== "browser") return c.json({ error: "unknown call" }, 404);
  markHungUp(call.id);
  return c.json({ ok: true });
});

const DeclineBody = CallBody.extend({ reason: z.enum(["busy", "no-answer"]).default("busy") });

voice.post("/phone/decline", async (c) => {
  const body = DeclineBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'body must be {call_id, reason?: "busy" | "no-answer"}' }, 400);
  const call = ringing(body.data.call_id);
  if (typeof call === "string") return c.json({ ok: true, already_processed: true });
  await finishCall(call.id, { kind: "failure", reason: body.data.reason }, "phone");
  return c.json({ ok: true });
});
