import assert from "node:assert/strict";
import { test } from "node:test";
import { digestText, followUpText, interruptText, money, parseReply, snoozeUntil, statusText } from "./grammar.js";

// Sunday Oct 18 2026, 2:00 PM New York (EDT).
const at = new Date("2026-10-18T14:00:00-04:00");
const verification = {
  title: "FAFSA verification", domain: "aid" as const, amount_at_risk_usd: 3700,
  deadline_at: "2026-10-18T23:59:00-04:00",
};
const ny = (iso: string) => new Date(iso).toISOString();

test("interrupt text matches the spec format, with no links", () => {
  assert.equal(
    interruptText(verification, at),
    "FAFSA verification: $3,700 in aid is on hold.\n" +
      "Due tonight 11:59 PM.\n" +
      "Reply 1 for a drafted email to the aid office, 2 for the document checklist.",
  );
  assert.doesNotMatch(interruptText(verification, at), /https?:|www\./);
});

test("due labels: today, tomorrow, weekday, overdue", () => {
  const morning = { ...verification, deadline_at: "2026-10-18T15:00:00-04:00" };
  assert.match(interruptText(morning, at), /Due today 3:00 PM\./);
  assert.match(followUpText({ ...verification, deadline_at: "2026-10-19T09:00:00-04:00" }, at), /Due tomorrow 9:00 AM\./);
  assert.match(followUpText({ ...verification, deadline_at: "2026-10-21T17:00:00-04:00" }, at), /Due Wed 5:00 PM\./);
  assert.match(followUpText({ ...verification, deadline_at: "2026-10-18T09:00:00-04:00" }, at), /Overdue since today 9:00 AM\./);
});

test("follow-up is shorter than the interrupt", () => {
  assert.ok(followUpText(verification, at).length < interruptText(verification, at).length);
});

test("money formatting", () => {
  assert.equal(money(3700), "$3,700");
  assert.equal(money(14.99), "$14.99");
  assert.equal(money(12.5), "$12.50");
});

test("digest: null when empty, at most 5 lines of items", () => {
  assert.equal(digestText([], at), null);
  const items = Array.from({ length: 7 }, (_, i) => ({ ...verification, title: `Item ${i}` }));
  const lines = digestText(items, at)!.split("\n");
  assert.equal(lines.length, 6); // header + 5
  assert.match(lines[0]!, /5 items with money at risk/);
});

test("status lists the top 3, or says nothing is open", () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ ...verification, title: `Item ${i}` }));
  assert.equal(statusText(items, at, 0).split("\n").length, 3);
  assert.equal(statusText([], at, 3700), "Nothing open. $3,700 protected this month.");
});

test("reply grammar", () => {
  assert.deepEqual(parseReply(" 1 "), { action: "draft" });
  assert.deepEqual(parseReply("2"), { action: "checklist" });
  assert.deepEqual(parseReply("Done!"), { action: "done" });
  assert.deepEqual(parseReply("dismiss"), { action: "dismiss" });
  assert.deepEqual(parseReply("STATUS"), { action: "status" });
  assert.deepEqual(parseReply("later"), { action: "snooze", when: "" });
  assert.deepEqual(parseReply("snooze 9pm"), { action: "snooze", when: "9pm" });
  assert.deepEqual(parseReply("snooze"), { action: "snooze", when: "" });
  assert.deepEqual(parseReply("What documents do I need?"), { action: "ask", text: "What documents do I need?" });
  assert.deepEqual(parseReply("12"), { action: "ask", text: "12" });
});

test("snooze times resolve to the next matching New York time", () => {
  const until = (w: string) => snoozeUntil(w, at, 120).toISOString();
  assert.equal(until(""), ny("2026-10-18T16:00:00-04:00"));            // later: +2 h
  assert.equal(until("gibberish"), ny("2026-10-18T16:00:00-04:00"));   // unparsable: +2 h
  assert.equal(until("9pm"), ny("2026-10-18T21:00:00-04:00"));
  assert.equal(until("9:30 pm"), ny("2026-10-18T21:30:00-04:00"));
  assert.equal(until("at 10"), ny("2026-10-18T22:00:00-04:00"));       // bare 10 at 2 PM -> 10 PM
  assert.equal(until("1"), ny("2026-10-19T01:00:00-04:00"));           // 1 PM passed -> 1 AM
  assert.equal(until("9am"), ny("2026-10-19T09:00:00-04:00"));         // passed today -> tomorrow
  assert.equal(until("21:00"), ny("2026-10-18T21:00:00-04:00"));
  assert.equal(until("in 2 hours"), ny("2026-10-18T16:00:00-04:00"));
  assert.equal(until("in 30 min"), ny("2026-10-18T14:30:00-04:00"));
  assert.equal(until("tonight"), ny("2026-10-18T21:00:00-04:00"));
  assert.equal(until("tomorrow"), ny("2026-10-19T09:00:00-04:00"));
  assert.equal(until("tomorrow 7pm"), ny("2026-10-19T19:00:00-04:00"));
  assert.equal(until("13pm"), ny("2026-10-18T16:00:00-04:00"));        // invalid: +2 h
});
