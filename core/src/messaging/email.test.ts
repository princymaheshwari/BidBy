import assert from "node:assert/strict";
import { test } from "node:test";
import "../voice/test-env.js";
import { addressOf, parseDraft } from "./email.js";

test("addresses come from 'Name <a@b>' or a bare address", () => {
  assert.equal(addressOf("Office of Financial Aid <FinAid@GTLState.example>"), "finaid@gtlstate.example");
  assert.equal(addressOf("finaid@gtlstate.example"), "finaid@gtlstate.example");
  assert.equal(addressOf("Google Calendar"), null);
});

test("a draft splits into subject and body", () => {
  assert.deepEqual(parseDraft("Subject: FAFSA verification documents\n\nHello,\n\nThanks,\nPrincy"),
    { subject: "FAFSA verification documents", body: "Hello,\n\nThanks,\nPrincy" });
  assert.deepEqual(parseDraft("Just a body"), { subject: "Following up", body: "Just a body" });
});
