# Spec 00 — Foundation

**Time box:** 75 min · **Depends on:** nothing · **Design refs:** SYSTEM_DESIGN §6, §8, §9.1, §11, §12

## Goal

A running bidby-core with the database, demo clock, event stream, fixtures loader and a bare page that shows live events. Every later spec plugs into this.

## Build

1. **Workspace:** root `package.json` (npm, ESM, `"type": "module"`), `core/` package, `tsconfig.json` (strict, `module: NodeNext`). Scripts: `dev` (`tsx watch core/src/server.ts`), `check` (`tsc --noEmit`).
2. **`config.ts`:** load `.env` (use Node's `process.loadEnvFile()`), export typed config. Required at boot: `USER_PHONE`, `OPENCLAW_GATEWAY_TOKEN`. Others optional until their spec. Thresholds: `INTERRUPT_SCORE = 500`, `CALL_SCORE = 1500`, `CALL_MAX_HOURS_LEFT = 12`, `NO_REPLY_MINUTES = 120`, `TICK_DEMO_MINUTES = 15`.
3. **`db.ts`:** `node:sqlite` `DatabaseSync` on `bidby.db`. Create every table in SYSTEM_DESIGN §8 with `CREATE TABLE IF NOT EXISTS`. JSON columns are TEXT. IDs are prefixed strings (`ob_`, `msg_`, `bid_`, `dec_`, `hs_`, `txt_`, `rep_`, `call_`, `evt_`) using a short random suffix. Seed `settings` with one row.
4. **`clock.ts`:** `now(): Date` = real time + `settings.clock_offset_minutes`. `advance(minutes)`, `setTo(iso)`, `hoursUntil(iso)`.
5. **`events.ts`:** `emit(type, payload)` inserts into `events` and pushes to connected SSE clients. `GET /api/events` streams them (send the last 50 on connect, then live).
6. **Fixtures:** `fixtures/inbox.json` and `fixtures/held.json` as arrays of `{id, source, sender, subject, body, received_at_offset_hours}` (offset relative to demo start, so the demo is time-independent). Write the content per spec 07; for now include 3 placeholder messages.
7. **Demo routes:** `POST /api/demo/clock`, `POST /api/demo/reset` (drop all rows except `settings`, reset offset to 0, `interrupts_today` to 0), `POST /api/demo/inject` (looks up a fixture id; until spec 02 exists, just stores it in `raw_messages` and emits `message.received`).
8. **`public/index.html`:** a bare page that connects to `/api/events` and prints events newest first. Served at `GET /`.
9. **Boot check:** on start, `GET http://127.0.0.1:18789/v1/models` with the bearer token. If it fails, log a clear error ("OpenClaw Gateway not reachable — run `openclaw gateway`") but keep the server up so the UI still works.

## Acceptance checks

- [ ] `npm run check` passes.
- [ ] `npm run dev` starts on :8787; `GET /` shows the page.
- [ ] `POST /api/demo/inject {"fixture_id": "<a placeholder id>"}` → a row in `raw_messages` and an event appears on the page within 1 s.
- [ ] `POST /api/demo/clock {"advance_minutes": 120}` → `{now}` is 2 h ahead; a `clock.changed` event appears.
- [ ] `POST /api/demo/reset` empties every table except `settings`.
- [ ] No source file outside `clock.ts` calls `Date.now()` (`grep`).

## Out of scope

Any LLM call, Spectrum, ElevenLabs, ranking.
