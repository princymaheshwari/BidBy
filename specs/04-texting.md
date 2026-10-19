# Spec 04 — F4: Action-first texting that closes loops

**Time box:** 60 min for the loop, plus 45 min before it to get one text working (do that first, even before spec 00 if Photon is the riskiest unknown) · **Depends on:** 03 · **Design refs:** SYSTEM_DESIGN §9.3, §10 flows C, D, F, §11

## Goal

BidBy texts rarely, every text ends in a one-reply action, replies change the ledger, and confirmations stop the reminders.

## Prerequisites (user)

- Spectrum project ID and secret in `.env`. The project owns an iMessage line.
- The user has texted the line once from `USER_PHONE` (inbound-first for deliverability).

## Build

1. **`messaging/spectrum.ts`**
   - `startSpectrum()`: `await Spectrum({ providers: [imessage.config()] })` (credentials from env). Start the `for await (const [space, message] of app.messages)` loop in the background; never let one bad message kill it (try/catch per message).
   - Keep the user's `space` in memory once seen. `sendToUser(text)`: use the stored space; if none, rebuild the DM from `USER_PHONE` per [webhook events doc](https://photon.codes/docs/webhooks/events.md) (`imessage(app).space(await im.user(phone))`) — verify against the [Spaces and Users](https://photon.codes/docs/spectrum-ts/spaces-and-users.md) page before writing it.
   - Every send inserts `outbound_texts` and emits `text.sent`. Pace sends at ≥ 2 s apart.
   - Inbound: ignore senders ≠ `USER_PHONE`; dedupe on `message.id` (unique index on `inbound_replies.spectrum_message_id`); only `text` content handled; emit `text.received`.
2. **`messaging/replies.ts`** — grammar, applied to the **current item** (the most recent obligation BidBy texted about):
   - `1` → send `head_starts.draft_text` (spec 05; until then send the required action).
   - `2` → send the checklist as numbered lines.
   - `done` → `markDone(current, "reply")`, reply "Marked done. $X protected."
   - `snooze <time>` / `later` → parse simple times ("9pm", "in 2 hours", "tomorrow"); default +2 h demo time; `snooze()`.
   - `dismiss` → `dismiss()`.
   - `status` → one-line summary of the top 3 open items.
   - Anything else → `callAgent(<domain of current>, …, answer_user)` and send `answer` (≤ 3 sentences).
3. **`escalation/timer.ts`** — the tick loop (real 5 s interval; each tick checks demo time):
   - Every `TICK_DEMO_MINUTES` of demo time → `rank()`.
   - **Notify rule:** top item `open`, score ≥ `INTERRUPT_SCORE`, `interrupts_today < interrupt_budget` → run head start (spec 05; skip if not built) → send interrupt text → status `notified`, `interrupts_today++`.
   - **Interrupt text format** (no links):
     ```
     FAFSA verification: $3,700 in aid is on hold.
     Due tonight 11:59 PM.
     Reply 1 for a drafted email to the aid office, 2 for the document checklist.
     ```
   - **Follow-up rule:** `notified`, no reply for `NO_REPLY_MINUTES` demo minutes, follow-ups < 2 → one shorter follow-up. Escalation to a call is spec 06; leave a hook `maybeEscalate(item)`.
   - **Digest:** at 8:00 AM demo time, one text listing open items below the interrupt threshold (max 5 lines). Skip if none.
4. **Close the loop:** `markDone` (from reply, confirmation ingest, or voice) cancels pending follow-ups for that item and emits `obligation.done` with the new `protectedTotal()`.
5. **Route** `POST /api/demo/clock` now triggers an immediate tick so "Jump to 9 PM" has visible effects.

## Acceptance checks

- [ ] A real text arrives on the user's phone when the verification item crosses the threshold.
- [ ] Replying `1` and `2` returns the expected content within 10 s.
- [ ] Replying `done` marks the item done and no further follow-up is sent after advancing the clock 4 h.
- [ ] A text from a different number is ignored (logged, no reply).
- [ ] With `interrupt_budget = 2`, a third high-score item waits for the digest.
- [ ] Killing and restarting core does not resend texts already sent (state is in the DB).

## Out of scope

Group chats, attachments, effects/tapbacks, multiple users.
