import "./test-env.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { now } from "../clock.js";
import { config } from "../config.js";
import { db } from "../db.js";
import { getObligation } from "../pipeline/ledger.js";
import { OUTBOUND_PATHS, dynamicVariables, spokenAmount, spokenDeadline, startCall } from "./elevenlabs.js";
import { addObligation, eventsOf, freshState, stubFetch } from "./test-helpers.js";

const callRows = () => db.prepare("SELECT * FROM calls").all() as Record<string, unknown>[];

beforeEach(() => {
  freshState();
  config.VOICE_MODE = "live";
  config.VOICE_PROVIDER = "twilio";
  config.ALLOWED_DIAL_NUMBERS = ["+14045550100"];
});
afterEach(() => mock.restoreAll());

test("amount and deadline are spelled for speech, relative to demo time", () => {
  assert.equal(spokenAmount(3700), "3,700 dollars");
  assert.equal(spokenAmount(14.99), "14 dollars and 99 cents");
  assert.equal(spokenAmount(1), "1 dollar");
  assert.equal(spokenDeadline("2026-10-18T23:59:00-04:00", now()), "tonight at 11:59 PM");
  assert.equal(spokenDeadline("2026-10-19T09:00:00-04:00", now()), "tomorrow at 9:00 AM");
});

test("dynamic variables: next step falls back to the required action without a head start", () => {
  const id = addObligation();
  assert.deepEqual(dynamicVariables(getObligation(id)!, now()), {
    obligation_id: id,
    title: "FAFSA verification",
    amount: "3,700 dollars",
    deadline: "tonight at 11:59 PM",
    next_step: "Upload your tax transcript to the aid portal",
  });
});

test("live: a number not on the allowlist is refused, with no request and one call.refused", async () => {
  config.ALLOWED_DIAL_NUMBERS = ["+19995550000"];
  const fetch = stubFetch(() => ({ success: true }));
  const id = addObligation();
  assert.equal(await startCall(id), undefined);
  assert.equal(await startCall(id), undefined);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(eventsOf("call.refused").length, 1);
  assert.equal(callRows().length, 0);
  assert.equal(getObligation(id)!.status, "notified");
});

test("live twilio: one request with the §9.4 body; stores callSid; escalates; no second call within 2 h", async () => {
  const fetch = stubFetch(() => ({ success: true, message: "ok", conversation_id: "conv_1", callSid: "CA1" }));
  const id = addObligation();
  const call = await startCall(id);
  assert.ok(call);
  assert.equal(call.provider, "twilio");
  assert.equal(call.conversation_id, "conv_1");
  assert.equal(call.provider_call_id, "CA1");
  assert.equal(call.status, "initiated");
  assert.equal(getObligation(id)!.status, "escalated");

  const [url, init] = fetch.mock.calls[0]!.arguments as [string, RequestInit];
  assert.equal(url, `https://api.elevenlabs.io${OUTBOUND_PATHS.twilio}`);
  const body = JSON.parse(String(init.body));
  assert.equal(body.agent_id, "agent_test");
  assert.equal(body.agent_phone_number_id, "phnum_test");
  assert.equal(body.to_number, "+14045550100");
  assert.equal(body.conversation_initiation_client_data.dynamic_variables.amount, "3,700 dollars");

  assert.equal(await startCall(id), undefined);
  assert.equal(fetch.mock.callCount(), 1);
});

test("live sip: same body, sip path, sip_call_id stored", async () => {
  config.VOICE_PROVIDER = "sip";
  const fetch = stubFetch(() => ({ success: true, conversation_id: "conv_2", sip_call_id: "sip_9" }));
  const call = await startCall(addObligation());
  assert.equal(String(fetch.mock.calls[0]!.arguments[0]), `https://api.elevenlabs.io${OUTBOUND_PATHS.sip}`);
  assert.equal(call!.provider, "sip");
  assert.equal(call!.provider_call_id, "sip_9");
});

test("live: success false emits call.failed and does not retry every tick", async () => {
  const fetch = stubFetch(() => ({ success: false, message: "number not verified" }));
  const id = addObligation();
  assert.equal(await startCall(id), undefined);
  assert.equal(await startCall(id), undefined);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(eventsOf("call.failed")[0]!.message, "number not verified");
  assert.equal(getObligation(id)!.status, "notified");
});

test("browser: rings the phone page, sends no request", async () => {
  config.VOICE_MODE = "browser";
  const fetch = stubFetch(() => ({}));
  const id = addObligation();
  const call = await startCall(id);
  assert.equal(call!.provider, "browser");
  assert.equal(call!.conversation_id, null);
  assert.equal(fetch.mock.callCount(), 0);
  const [ringing] = eventsOf("call.ringing");
  assert.equal(ringing!.obligation_id, id);
  assert.equal(ringing!.amount, "3,700 dollars");
  assert.equal(getObligation(id)!.status, "escalated");
});

test("mock and dashboard modes send nothing", async () => {
  const fetch = stubFetch(() => ({}));
  config.VOICE_MODE = "mock";
  const a = addObligation();
  assert.equal((await startCall(a))!.conversation_id, `conv_mock_${a}`);

  config.VOICE_MODE = "dashboard";
  const b = addObligation();
  assert.equal(await startCall(b), undefined);
  assert.equal((eventsOf("call.manual_needed")[0]!.dynamic_variables as Record<string, string>).obligation_id, b);
  assert.equal(fetch.mock.callCount(), 0);
});

test("done or dismissed items are never called", async () => {
  config.VOICE_MODE = "mock";
  assert.equal(await startCall(addObligation({ status: "done" })), undefined);
  assert.equal(callRows().length, 0);
});
