import "./test-env.js";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Hono } from "hono";
import { config } from "../config.js";
import { getObligation } from "../pipeline/ledger.js";
import { getCall, startCall } from "./elevenlabs.js";
import { tunnelGuard, voice } from "./routes.js";
import { addObligation, eventsOf, freshState, json, stubFetch, textsOf } from "./test-helpers.js";

const app = new Hono();
app.use("*", tunnelGuard);
app.route("/voice", voice);
app.get("/api/obligations", (c) => c.json([]));

const TOOL = { authorization: "Bearer tool-secret", "content-type": "application/json" };
const PHONE = { "x-bidby-key": "phone-key", "content-type": "application/json" };
const post = (path: string, body: unknown, headers: Record<string, string>) =>
  app.request(path, { method: "POST", headers, body: JSON.stringify(body) });

beforeEach(() => {
  freshState();
  config.VOICE_MODE = "browser";
});
afterEach(() => mock.restoreAll());

test("tools: 401 without or with the wrong bearer secret", async () => {
  const id = addObligation();
  assert.equal((await post("/voice/tools/details", { obligation_id: id }, { "content-type": "application/json" })).status, 401);
  assert.equal((await post("/voice/tools/details", { obligation_id: id }, { ...TOOL, authorization: "Bearer nope" })).status, 401);
  assert.equal(eventsOf("voice.tool_called").length, 0);
});

test("details: short strings to read aloud; unknown obligation 404", async () => {
  const id = addObligation();
  const res = await post("/voice/tools/details", { obligation_id: id }, TOOL);
  assert.equal(res.status, 200);
  const body = await json(res);
  assert.equal(body.title, "FAFSA verification");
  assert.equal(body.amount, "$3,700");
  assert.equal(body.deadline, "tonight at 11:59 PM");
  assert.deepEqual(body.missing_docs, ["2025 IRS Tax Return Transcript", "Verification Worksheet (signed)"]);
  assert.equal(eventsOf("voice.tool_called")[0]!.tool, "get_obligation_details");
  assert.equal((await post("/voice/tools/details", { obligation_id: "ob_nope" }, TOOL)).status, 404);
});

test("snooze: the student's words are parsed in demo time; an ISO time works too", async () => {
  const id = addObligation();
  const body = await json(await post("/voice/tools/snooze", { obligation_id: id, remind_at_iso: "at 10" }, TOOL));
  assert.equal(body.ok, true);
  assert.equal(body.remind_at_spoken, "tonight 10:00 PM");
  assert.equal(getObligation(id)!.snoozed_until, new Date("2026-10-18T22:00:00-04:00").toISOString());

  const b = addObligation();
  await post("/voice/tools/snooze", { obligation_id: b, remind_at_iso: "2026-10-18T22:30:00-04:00" }, TOOL);
  assert.equal(getObligation(b)!.snoozed_until, new Date("2026-10-18T22:30:00-04:00").toISOString());
});

test("done: marks the item done via call", async () => {
  const id = addObligation();
  assert.deepEqual(await (await post("/voice/tools/done", { obligation_id: id }, TOOL)).json(), { ok: true });
  assert.equal(getObligation(id)!.status, "done");
  assert.equal(eventsOf("obligation.done")[0]!.via, "call");
});

// Real wall-clock seconds: the SDK checks the signature timestamp against them (not demo time).
const unixNow = () => Math.floor((performance.timeOrigin + performance.now()) / 1000);
const sign = (raw: string, secret = "wsec_test", t = unixNow()) =>
  `t=${t},v0=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;
const settle = () => new Promise((r) => setTimeout(r, 50));

test("postcall: bad or missing signature 401; a signed transcription completes the call once", async () => {
  const id = addObligation();
  const call = (await startCall(id))!;
  const { db } = await import("../db.js");
  db.prepare("UPDATE calls SET conversation_id = 'conv_w' WHERE id = ?").run(call.id);

  const raw = JSON.stringify({
    type: "post_call_transcription", event_timestamp: 1,
    data: { conversation_id: "conv_w", status: "done", analysis: { transcript_summary: "Snoozed to 10 PM." },
      transcript: [{ role: "agent", message: "Hi, it's BidBy." }] },
  });
  const hook = (sig?: string) => app.request("/voice/postcall", {
    method: "POST", body: raw, headers: { "content-type": "application/json", ...(sig ? { "elevenlabs-signature": sig } : {}) },
  });

  assert.equal((await hook()).status, 401);
  assert.equal((await hook(sign(raw, "wrong"))).status, 401);
  assert.equal((await hook(sign(raw.replace("10 PM", "11 PM")))).status, 401);

  assert.equal((await hook(sign(raw))).status, 200);
  assert.equal((await hook(sign(raw))).status, 200); // duplicate delivery: acknowledged, ignored
  await settle();
  assert.equal(getCall(call.id)!.status, "completed");
  assert.equal(getCall(call.id)!.summary, "Snoozed to 10 PM.");
  assert.equal(eventsOf("call.completed").length, 1);
});

test("postcall: call_initiation_failure fails the call with one closing text", async () => {
  const call = (await startCall(addObligation()))!;
  const { db } = await import("../db.js");
  db.prepare("UPDATE calls SET conversation_id = 'conv_f' WHERE id = ?").run(call.id);
  const raw = JSON.stringify({ type: "call_initiation_failure", data: { conversation_id: "conv_f", failure_reason: "no-answer" } });
  for (let i = 0; i < 2; i++) {
    await app.request("/voice/postcall", { method: "POST", body: raw, headers: { "elevenlabs-signature": sign(raw) } });
  }
  await settle();
  assert.equal(getCall(call.id)!.status, "failed");
  assert.equal(textsOf("closing").length, 1);
});

test("phone page: 401 without the key; page, state, answer, attach, decline", async () => {
  assert.equal((await app.request("/voice/phone")).status, 401);
  assert.equal((await app.request("/voice/phone?k=wrong")).status, 401);
  assert.equal((await app.request("/voice/phone/state")).status, 401);
  const page = await app.request("/voice/phone?k=phone-key");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /@elevenlabs\/client@1\.26\.0/);

  const state = async () => (await json(await app.request("/voice/phone/state", { headers: PHONE }))).call;
  assert.equal(await state(), null);

  const id = addObligation();
  const call = (await startCall(id))!;
  assert.deepEqual(await state(), {
    id: call.id, phase: "ringing", title: "FAFSA verification", amount: "$3,700", deadline: "tonight at 11:59 PM",
  });

  const fetch = stubFetch(() => ({ token: "tok_123" }));
  const answer = await json(await post("/voice/phone/answer", { call_id: call.id }, PHONE));
  assert.equal(answer.token, "tok_123");
  assert.equal(answer.dynamic_variables.obligation_id, id);
  assert.match(String(fetch.mock.calls[0]!.arguments[0]), /\/v1\/convai\/conversation\/token\?agent_id=agent_test$/);
  assert.equal(JSON.stringify(answer).includes("test-xi-key"), false); // the API key never reaches the page

  assert.equal((await post("/voice/phone/attach", { call_id: call.id, conversation_id: "conv_p" }, PHONE)).status, 200);
  assert.equal((await post("/voice/phone/attach", { call_id: call.id, conversation_id: "conv_q" }, PHONE)).status, 409);
  assert.equal((await state()).phase, "in_call");
  assert.equal(eventsOf("call.answered").length, 1);
  assert.equal((await post("/voice/phone/answer", { call_id: call.id }, PHONE)).status, 409);

  const other = (await startCall(addObligation()))!;
  assert.deepEqual(await (await post("/voice/phone/decline", { call_id: other.id }, PHONE)).json(), { ok: true });
  assert.equal(getCall(other.id)!.status, "failed");
  assert.equal(textsOf("closing").length, 1);
});

test("tunnel guard: through the tunnel only /voice/* answers", async () => {
  const cf = { "cf-connecting-ip": "203.0.113.7" };
  assert.equal((await app.request("/api/obligations")).status, 200);
  assert.equal((await app.request("/api/obligations", { headers: cf })).status, 404);
  assert.equal((await app.request("/api/obligations", { headers: { "cf-ray": "abc-IAD" } })).status, 404);
  assert.equal((await app.request("/", { headers: cf })).status, 404);
  assert.equal((await app.request("/voice/phone?k=phone-key", { headers: cf })).status, 200);
  assert.equal((await post("/voice/tools/details", { obligation_id: "x" }, { ...cf })).status, 401);
});
