import "./test-env.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { advance, now } from "../clock.js";
import { config } from "../config.js";
import { db } from "../db.js";
import { getObligation } from "../pipeline/ledger.js";
import { checkCalls, completeMockCall, finishCall, markAnswering, processCallResult } from "./calls.js";
import { getCall, startCall } from "./elevenlabs.js";
import { addObligation, eventsOf, freshState, stubFetch, textsOf } from "./test-helpers.js";

const transcript = { kind: "transcript" as const, summary: "Student will upload tonight.", transcript: [{ role: "user", message: "ok" }] };

beforeEach(() => {
  freshState();
  config.VOICE_MODE = "browser";
});
afterEach(() => mock.restoreAll());

async function browserCall(conversationId: string | null = null) {
  const obligationId = addObligation();
  const call = (await startCall(obligationId))!;
  if (conversationId) db.prepare("UPDATE calls SET conversation_id = ? WHERE id = ?").run(conversationId, call.id);
  return { obligationId, callId: call.id };
}

test("decline: the call fails once and exactly one closing text goes out", async () => {
  const { obligationId, callId } = await browserCall();
  assert.equal(await finishCall(callId, { kind: "failure", reason: "busy" }, "phone"), true);
  assert.equal(await finishCall(callId, { kind: "failure", reason: "busy" }, "phone"), false);
  assert.equal(getCall(callId)!.status, "failed");
  assert.deepEqual(textsOf("closing"), [{
    body: "Couldn't reach you. FAFSA verification is still due tonight 11:59 PM. Reply 1 for the draft.",
    obligation_id: obligationId,
  }]);
  assert.equal(eventsOf("call.failed")[0]!.failure_reason, "busy");
});

test("webhook and recovery for the same conversation: processed once", async () => {
  const { callId } = await browserCall("conv_a");
  assert.equal(await processCallResult("conv_a", transcript, "webhook"), true);
  assert.equal(await processCallResult("conv_a", { ...transcript, summary: "second" }, "recovery"), false);
  assert.equal(await processCallResult("conv_a", { kind: "failure", reason: "unknown" }, "webhook"), false);
  const call = getCall(callId)!;
  assert.equal(call.status, "completed");
  assert.equal(call.summary, "Student will upload tonight.");
  assert.equal(eventsOf("call.completed").length, 1);
  assert.equal(textsOf("closing").length, 0);
  assert.equal(await processCallResult("conv_unknown", transcript, "webhook"), false);
});

test("recovery poll: after 8 demo minutes with no webhook, the conversation is fetched and stored", async () => {
  const fetch = stubFetch(() => ({ conversation_id: "conv_r", status: "done", analysis: { transcript_summary: "Recovered." },
    transcript: [{ role: "agent", message: "Hi, it's BidBy." }, { role: "user", message: null }] }));
  const { callId } = await browserCall("conv_r");

  await checkCalls(now());
  assert.equal(fetch.mock.callCount(), 0); // too early

  advance(9);
  await checkCalls(now());
  assert.ok(String(fetch.mock.calls[0]!.arguments[0]).endsWith("/v1/convai/conversations/conv_r"));
  const call = getCall(callId)!;
  assert.equal(call.status, "recovered");
  assert.equal(call.summary, "Recovered.");
  assert.deepEqual(JSON.parse(call.transcript!), [{ role: "agent", message: "Hi, it's BidBy." }]);
  assert.equal(eventsOf("call.recovered").length, 1);

  await checkCalls(now());
  assert.equal(fetch.mock.callCount(), 1); // finished calls are not polled again
});

test("recovery poll: in-progress is left for the next tick; failed sends the closing text", async () => {
  let status = "in-progress";
  stubFetch(() => ({ status }));
  const { callId } = await browserCall("conv_p");
  advance(9);
  await checkCalls(now());
  assert.equal(getCall(callId)!.status, "initiated");
  status = "failed";
  await checkCalls(now());
  assert.equal(getCall(callId)!.status, "failed");
  assert.equal(textsOf("closing").length, 1);
});

test("ring timeout: an unanswered browser call becomes no-answer, unless it is being answered", async () => {
  const a = await browserCall();
  advance(1);
  await checkCalls(now());
  assert.equal(getCall(a.callId)!.status, "failed");
  assert.equal(eventsOf("call.failed")[0]!.failure_reason, "no-answer");

  freshState();
  const b = await browserCall();
  markAnswering(b.callId);
  advance(1);
  await checkCalls(now());
  assert.equal(getCall(b.callId)!.status, "initiated");
});

test("mock: completed with 'snooze 10pm' snoozes until 10 PM demo time, via the tool", async () => {
  config.VOICE_MODE = "mock";
  const id = addObligation();
  await startCall(id);
  assert.equal(await completeMockCall(`conv_mock_${id}`, "completed", "snooze 10pm"), "ok");
  const ob = getObligation(id)!;
  assert.equal(ob.status, "snoozed");
  assert.equal(ob.snoozed_until, new Date("2026-10-18T22:00:00-04:00").toISOString());
  assert.equal(eventsOf("voice.tool_called")[0]!.tool, "snooze_obligation");
  assert.equal(eventsOf("call.completed").length, 1);
  assert.equal(await completeMockCall(`conv_mock_${id}`, "completed", "done"), "already_processed");
  assert.equal(await completeMockCall("conv_mock_nope", "completed"), "unknown");
});

test("mock: 'done' marks the item done; declined fails with one closing text", async () => {
  config.VOICE_MODE = "mock";
  const a = addObligation();
  await startCall(a);
  await completeMockCall(`conv_mock_${a}`, "completed", "done");
  assert.equal(getObligation(a)!.status, "done");
  assert.equal(eventsOf("obligation.done")[0]!.via, "call");

  const b = addObligation();
  await startCall(b);
  await completeMockCall(`conv_mock_${b}`, "declined");
  assert.equal(eventsOf("call.failed")[0]!.failure_reason, "busy");
  assert.equal(textsOf("closing").length, 1);
});
