# Spec 03 — F2: Domain agents bid, coordinator explains

**Time box:** 90 min · **Depends on:** 02 · **Design refs:** SYSTEM_DESIGN §7 (agents), §8 (score), §9.2 (`submit_bids`, `explain_decision`), §10 flow B

## Goal

Every open obligation gets a bid from its domain agent; the backend ranks them with the fixed formula; the coordinator writes a short rationale. The judge can see who bid what and why #1 won.

## Build

1. **`pipeline/rank.ts`** — `rank(): Decision`
   - New `round_id`. Group open (and `notified`, non-snoozed) obligations by `domain`.
   - Call each domain agent **in parallel** (`Promise.all`) with its obligations and `now()`, using the `submit_bids` tool: one call per agent returns one bid per obligation it owns. Drop bids whose `obligation_id` isn't in that agent's input.
   - Insert `bids`; `emit("bid.submitted")` per bid.
   - Score in code with the formula in SYSTEM_DESIGN §8 (`score.ts`, pure function, unit-tested). Use the bid's `amount_at_risk_usd`, `reversible`, `blocks_other_aid`; `hours_left` from the obligation's `deadline_at` and `now()`.
   - Sort descending; ties broken by earlier deadline.
   - `callAgent("coordinator", {bids, ranked}, explain_decision)`; if it fails, use a template rationale ("X ranks first: $A at risk, due in H hours").
   - Insert `decisions`; `emit("decision.made", {ranked_ids, top_score})`.
2. **Triggers:** after every ingest, and from the tick loop every `TICK_DEMO_MINUTES` of demo time (the tick loop itself is built in spec 04; expose `rank()` for it).
3. **Debounce:** if a rank is already running, mark "rerun needed" and run once more after it finishes; never run two in parallel.
4. **Routes:** `POST /api/rank`, `GET /api/decisions/latest` (bids joined with obligation titles, scores, rationale).
5. **Unit test** `score.test.ts` (Node's built-in `node:test`): blocking aid doubles; reversible halves; closer deadline scores higher at equal amount.

## Acceptance checks

- [ ] With the seeded inbox plus the injected verification email, verification ranks #1.
- [ ] `GET /api/decisions/latest` shows one bid per open obligation, each with an argument.
- [ ] Rationale is ≤ 2 sentences and names the top item.
- [ ] Advancing the clock 24 h with no other change can reorder items (urgency term works).
- [ ] Ranking is identical across 3 runs given identical bids (scorer is pure).
- [ ] `node --test` passes.

## Out of scope

Agents talking to each other freely. The "negotiation" is structured bids → deterministic score → explanation. Do not add an LLM-decided ranking.
