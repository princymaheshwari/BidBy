# Spec 02 — F1: Obligation extractor and ledger

**Time box:** 60 min · **Depends on:** 00, 01 · **Design refs:** SYSTEM_DESIGN §8, §9.1, §9.2 (`record_obligations`), §10 flow A

## Goal

Any message becomes zero or more structured obligations; duplicates merge into one row; confirmations mark items done; noise and phishing write nothing actionable.

## Build

1. **`pipeline/ingest.ts`** — `ingest(msg): {raw_message_id, obligation_ids, completed_ids}`
   - Insert into `raw_messages`; `emit("message.received")`.
   - Build the extractor prompt: the message, `now()` as ISO, and the list of open obligations as `{id, domain, title, deadline_at, amount_at_risk_usd}`.
   - `callAgent("extractor", …, record_obligations)`.
   - `is_suspicious` → `emit("message.flagged", {reason})`, stop.
   - `is_noise` → `emit("message.noise")`, stop.
   - For each obligation: if `merge_with` is an existing open id, update fields that changed and append the message id to `source_message_ids`, `emit("obligation.updated")`; else insert with status `open`, `emit("obligation.created")`.
   - For each id in `completes`: call `markDone(id, "confirmation")` (shared helper in `pipeline/ledger.ts`; also used by specs 04 and 06).
   - After ingest, call `rank()` if spec 03 exists (guard with a no-op until then).
2. **`pipeline/ledger.ts`** — `markDone`, `snooze(id, untilIso)`, `dismiss`, `getOpen()`, `protectedTotal()` (sum of `amount_at_risk_usd` for `done` this month). Each emits an event.
3. **Routes:** `POST /api/ingest`, upgrade `POST /api/demo/inject` to call `ingest`, `GET /api/obligations`, `POST /api/obligations/:id/action`.
4. **Ingest the seeded inbox on reset:** `POST /api/demo/reset` ingests every message in `fixtures/inbox.json` in received order, with the clock set so each message's `received_at` is in the past.

## Acceptance checks

- [ ] Reset with the seeded inbox → the ledger contains one obligation per real use-case message and none for the noise emails.
- [ ] The card statement and its second reminder produce **one** obligation whose `source_message_ids` has two entries.
- [ ] Injecting the phishing fixture creates no obligation and emits `message.flagged`.
- [ ] Injecting a "payment received" message for the card marks that obligation `done`.
- [ ] Every obligation has a non-null amount, ISO deadline and required action.
- [ ] Re-running reset twice gives the same obligation count (determinism check; note any drift).

## Out of scope

Ranking, texting. Do not add a "category" UI or spending analytics.
