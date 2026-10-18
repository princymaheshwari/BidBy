import assert from "node:assert/strict";
import { test } from "node:test";
import { hoursLeft, rankByScore, score } from "./score.js";

const at = new Date("2026-10-18T12:00:00-04:00");
const base = { amount_at_risk_usd: 1000, reversible: false, blocks_other_aid: false, deadline_at: "2026-10-19T12:00:00-04:00" };

test("blocking other aid doubles the score", () => {
  assert.equal(score({ ...base, blocks_other_aid: true }, at), 2 * score(base, at));
});

test("a reversible obligation scores half", () => {
  assert.equal(score({ ...base, reversible: true }, at), 0.5 * score(base, at));
});

test("at equal amount, the closer deadline scores higher", () => {
  const soon = { ...base, deadline_at: "2026-10-18T18:00:00-04:00" };
  const later = { ...base, deadline_at: "2026-10-21T12:00:00-04:00" };
  assert.ok(score(soon, at) > score(later, at));
});

test("formula: 1000 x 24/(24+24) = 500 at 24 hours left", () => {
  assert.equal(score(base, at), 500);
});

test("hours left never goes below zero", () => {
  assert.equal(hoursLeft("2026-10-17T12:00:00-04:00", at), 0);
  assert.equal(score({ ...base, deadline_at: "2026-10-17T12:00:00-04:00" }, at), 1000);
});

test("ties go to the earlier deadline", () => {
  // Both score 500: $1000 with 24 h left, $1250 with 36 h left.
  const a = { ...base, obligation_id: "ob_b", deadline_at: "2026-10-19T12:00:00-04:00" };
  const b = { ...base, obligation_id: "ob_a", amount_at_risk_usd: 1250, deadline_at: "2026-10-20T00:00:00-04:00" };
  assert.equal(score(a, at), score(b, at));
  assert.deepEqual(rankByScore([b, a], at).map((r) => r.item.obligation_id), ["ob_b", "ob_a"]);
});

test("the same bids always give the same order", () => {
  const items = [
    { ...base, obligation_id: "ob_1", amount_at_risk_usd: 3700, blocks_other_aid: true, deadline_at: "2026-10-18T23:59:00-04:00" },
    { ...base, obligation_id: "ob_2", amount_at_risk_usd: 2000, deadline_at: "2026-10-20T17:00:00-04:00" },
    { ...base, obligation_id: "ob_3", amount_at_risk_usd: 50.31, reversible: true, deadline_at: "2026-10-19T23:59:00-04:00" },
  ];
  const runs = [0, 1, 2].map(() => rankByScore([...items].reverse(), at).map((r) => r.item.obligation_id));
  assert.deepEqual(runs[0], ["ob_1", "ob_2", "ob_3"]);
  assert.deepEqual(runs[1], runs[0]);
  assert.deepEqual(runs[2], runs[0]);
});
