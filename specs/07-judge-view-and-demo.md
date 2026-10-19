# Spec 07 — Judge view, fixtures and demo run

**Time box:** 90 min (split: 45 min fixtures + view before sleeping, 45 min polish + smoke after voice works) · **Depends on:** 02, 03 (view), all (smoke) · **Design refs:** SYSTEM_DESIGN §4 (judge view), §13

## Goal

One page that makes the invisible visible for judges (ledger, bids, live events), demo controls that make the run deterministic, and seeded data that tells the story.

## Fixtures

`fixtures/inbox.json` (~20 messages; `received_at_offset_hours` negative = already received). Use realistic sender names for a fictional school ("GT-like State University"); no real institutions' branding.

| Use case | Messages | Key facts |
|---|---|---|
| Credit card | statement + second reminder 2 days later | balance $412.60, minimum $35, due in 30 h |
| Subscription | Prime-style renewal notice | $14.99/month, renews in 40 h |
| Scholarship (Slack) | post in #opportunities | $2,000 award, due in 44 h, needs resume + 300-word essay |
| Reimbursement | travel office reminder | $640, window closes in 5 days |
| TA timesheet | payroll reminder | $380 pay period, due in 3 days |
| Noise | ~10: newsletters, bank promos ("Pre-approved!"), club emails | no obligations |

`fixtures/held.json`:
- `verification`: aid office email, "selected for verification", $3,700 Pell + state grant on hold, submit IRS tax return transcript + verification worksheet by **tonight 11:59 PM**. Compute the deadline at injection time as 23:59 America/New_York on the current demo day, so "Jump to 9 PM" leaves under 3 hours.
- `phishing` (optional): "FAFSA Account Locked — verify your SSN at fafsa-help-desk.co".
- `verification_confirmed`: "We have received your verification documents."
- `card_paid`: "Payment of $412.60 received."

## Judge view (`core/public/index.html`, no build step)

Use the `frontend-design` sensibility: clean, finance-serious, readable from 2 m away on a projector. Three columns:

1. **Ledger** — header metrics: "$ at risk this week" and "$ protected". Cards per obligation: title, domain chip, amount, countdown to deadline (from `now()`), status. Done items collapse at the bottom.
2. **Bids** — latest round: each domain agent's bid (amount, effort, flags, argument) and its score bar; the rationale on top. Highlight #1.
3. **Live feed** — `events` stream, newest first, human-readable lines ("aid agent bid $3,700 · blocks other aid", "Text sent", "Call: get_obligation_details").

Top bar: demo clock (big), buttons **Inject next** (cycles held fixtures), **Advance 1 h**, **Jump to 9 PM**, **Reset**. Poll `GET /api/obligations` and `/api/decisions/latest` on relevant events instead of building state client-side.

## Smoke script

`npm run smoke` (`scripts/smoke.ts`), runs against a live server with `VOICE_MODE=mock` and texting stubbed (`MESSAGING_MODE=log` env that logs instead of sending):
1. Reset; assert ≥ 5 obligations, 0 from noise.
2. Inject `verification`; assert it ranks #1 and a notify event fires.
3. Simulate reply `1` (call the reply handler directly); assert a draft was "sent".
4. Jump to 9 PM; assert `call.started` with conversation id `conv_mock_<verification obligation id>`. Finish it with `POST /api/demo/calls/:conversationId/complete {"outcome": "completed", "say": "snooze 10pm"}`; assert the item is `snoozed` until 10 PM demo time and the call is `completed`.
5. Inject `verification_confirmed`; assert status `done` and `protectedTotal` increased by 3,700.

## Acceptance checks

- [ ] The full scripted run in SYSTEM_DESIGN §13 works end to end with real texts and a real call, twice in a row.
- [x] `npm run smoke` passes from a cold reset (187 s; scratch server with `VOICE_MODE=mock MESSAGING_MODE=log`, `BIDBY_URL` to point at it).
- [x] The page is readable at 1280×720 (projector) and shows no secrets.
- [x] Every number on the page comes from the API (no hard-coded demo values).

## Decisions made while building

- Escalation: an unanswered item inside the call window is called right away (SYSTEM_DESIGN §10 flow E updated), so "Jump to 9 PM" rings the phone. Items outside the window keep the follow-up texts.
- Local endpoints added for the view and smoke: `GET /api/demo/state`, `POST /api/demo/reply` (SYSTEM_DESIGN §9.1).
- "Inject next" follows the story order (verification → documents accepted → phishing → card paid); a picker chooses any held fixture.
- "Call now" (`POST /api/demo/escalate`) is the safety net if the call doesn't come on its own.

## Out of scope

Auth, multi-user, charts beyond score bars, mobile layout.
