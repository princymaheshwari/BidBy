import assert from "node:assert/strict";
import { test } from "node:test";
import {
  digestText, draftFooter, followUpText, headStartChecklistText, interruptText, money, parseReply, snoozeUntil, statusText,
} from "./grammar.js";

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

test("head start checklist: ✓ found, ✗ missing, steps, at most 2 resources, no links", () => {
  const text = headStartChecklistText(
    "FAFSA verification",
    [
      { doc: "2025 IRS Tax Return Transcript", file: "docs/2025_tax_return_transcript_PLACEHOLDER.md" },
      { doc: "2026-27 Verification Worksheet (signed)", file: null },
    ],
    ["Upload the transcript", "Fill in and sign the worksheet"],
    [
      { name: "Financial aid appeal", how_to_use: "Ask for Form SC-1." },
      { name: "Emergency grant", how_to_use: "Apply via the Dean of Students form." },
      { name: "Payment plan", how_to_use: "Enroll in the Bursar portal." },
    ],
  );
  assert.equal(text, [
    "FAFSA verification checklist:",
    "✓ 2025 IRS Tax Return Transcript (found: 2025_tax_return_transcript_PLACEHOLDER.md)",
    "✗ 2026-27 Verification Worksheet (signed) (missing)",
    "1. Upload the transcript",
    "2. Fill in and sign the worksheet",
    "Help available:",
    "- Financial aid appeal: Ask for Form SC-1.",
    "- Emergency grant: Apply via the Dean of Students form.",
  ].join("\n"));
  assert.doesNotMatch(text, /https?:\/\//);
});

test("aid interrupt says where the documents are and which are missing", () => {
  const folder = "C:\Users\p\Documents\Financial Aid\FAFSA 2026-27";
  const text = interruptText(verification, at, {
    folder,
    docs: [
      { doc: "2025 IRS Tax Return Transcript", file: "docs/2025 IRS Tax Return Transcript.pdf", blank: null },
      { doc: "2026-27 Verification Worksheet (signed)", file: null, blank: "2026-27 Verification Worksheet (blank).pdf" },
      { doc: "Photo ID", file: null, blank: null },
    ],
  });
  assert.equal(
    text,
    "FAFSA verification: $3,700 in aid is on hold.\n" +
      "Due tonight 11:59 PM.\n" +
      `Your documents are in ${folder}\n` +
      "✓ 2025 IRS Tax Return Transcript (2025 IRS Tax Return Transcript.pdf)\n" +
      "✗ 2026-27 Verification Worksheet (signed): only the blank form is there (2026-27 Verification Worksheet (blank).pdf). Fill it in and sign it.\n" +
      "✗ Photo ID: not in that folder yet.\n" +
      "Reply 1 for a drafted email to the aid office, 2 for the document checklist.",
  );
  assert.doesNotMatch(text, /https?:|www\./);
});

test("send, yes and send it mean send; the draft footer offers it only for an allowed recipient", () => {
  for (const t of ["send", "Send it", "yes", "Yes, send", "y"]) assert.deepEqual(parseReply(t), { action: "send" }, t);
  assert.deepEqual(parseReply("yes please explain"), { action: "ask", text: "yes please explain" });
  assert.equal(draftFooter("aid@x.edu", "me@gmail.com", true), "Reply send and I'll email it to aid@x.edu from me@gmail.com.");
  assert.equal(draftFooter("aid@x.edu", null, false), "I'm not set up to email aid@x.edu. Copy it into your email to send it.");
});

test("a tuition balance reads as money owed with the class-cancellation risk, not aid on hold", () => {
  const tuition = { title: "Fall 2026 tuition balance", domain: "aid" as const, amount_at_risk_usd: 4800, deadline_at: "2026-10-18T23:59:00-04:00" };
  assert.equal(
    interruptText(tuition, at),
    "Fall 2026 tuition balance: $4,800 is due, or your classes may be canceled.\n" +
      "Due tonight 11:59 PM.\n" +
      "Reply 1 for a drafted email to Student Financial Services, 2 for your payment options.",
  );
});
