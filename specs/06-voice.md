# Spec 06 — F5: Voice escalation (ElevenLabs agent, phone page)

**Time box:** 90 min · **Depends on:** 04, 05 · **Design refs:** SYSTEM_DESIGN §6 (Voice, demo voice path), §7, §8 (`calls`), §9.4, §9.5, §10 flow E, §11, §12, §14

## Goal

When a high-stakes item is about to be missed and the user hasn't replied, BidBy calls them. The call rings on the **BidBy phone page**, open in Safari on the user's iPhone, and looks like an iPhone call: "BidBy", "mobile", Remind Me / Message, Decline / Accept. Nothing about the item is shown on screen; the agent says it when the user answers. The call is a two-way conversation with the ElevenLabs agent **BidBy Voice** over WebRTC: the user can ask what to do, snooze, or mark it done, and the ledger updates live. BidBy texts and calls you.

This is a browser call, not a cellular call: Safari must be open with the screen on (the page keeps it awake after one "Stand by" tap). A web page cannot ring a locked phone.

## ElevenLabs agent (configured and published)

| Setting | Value |
|---|---|
| Name | BidBy Voice |
| Voice | Hope (upbeat, clear) |
| Language | English |
| LLM | GLM (`glm-52`) |
| Max call duration | 240 s (free plan: 15 agent minutes in total, so keep test calls short) |
| Authentication | Off (the page gets a short-lived conversation token from core either way) |
| First message | `Hi, it's BidBy. {{title}} is due {{deadline}}, and {{amount}} is at stake. Do you have two minutes?` |
| Dynamic variables | `obligation_id`, `title`, `amount`, `deadline`, `next_step` (sent by the phone page at session start, built by core) |

**System prompt (summary):** a proactive financial deadline assistant for students. Speak calmly and naturally in short replies (1–2 sentences), one question at a time. Explain what is due, the deadline, the amount at stake and the next step (`{{next_step}}`). Use `get_obligation_details` to answer questions about the item, `snooze_obligation` when the student asks for another time, `mark_obligation_done` only after the student explicitly confirms it is done. Confirm a tool action only after the tool succeeds. Never invent financial information; never ask for passwords, card numbers or bank credentials; never start a transaction. Keep the call to about three minutes. Reminder times follow BidBy's demo clock, not the agent's real-world clock (the snooze tool takes the student's words and core parses them).

**Webhook tools** (all `POST`, JSON body, header `Authorization` from the ElevenLabs secret `BidBy_Tool_Auth`, whose value is `Bearer <BIDBY_TOOL_SECRET>`; `obligation_id` comes from the dynamic variable, never from the LLM):

| Tool | URL | Body |
|---|---|---|
| `get_obligation_details` | `<TUNNEL>/voice/tools/details` | `obligation_id` (dynamic variable) |
| `snooze_obligation` | `<TUNNEL>/voice/tools/snooze` | `obligation_id` (dynamic variable); `remind_at_iso` (LLM): "The time the student requested, in their own words, such as "10pm", "tomorrow morning", or "in 2 hours". Do not convert to a timestamp." |
| `mark_obligation_done` | `<TUNNEL>/voice/tools/done` | `obligation_id` (dynamic variable) |

**Post-call webhook** (workspace level, selected for the workspace): "BidBy Post Call" → `<TUNNEL>/voice/postcall`, HMAC (secret in `ELEVENLABS_WEBHOOK_SECRET`), transcript on, audio off, call-initiation failures off (the phone page reports declines itself).

**Tunnel:** a Cloudflare quick tunnel, `cloudflared tunnel --url http://localhost:8787`. Its hostname changes when cloudflared restarts; then update the 3 tool URLs and the post-call webhook URL. Current: `joins-recommends-tide-powell.trycloudflare.com`.

**`.env`:** `VOICE_MODE=browser`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `BIDBY_TOOL_SECRET`, `BIDBY_PHONE_KEY`.

## Build (done: commits `4ca5266`, `8f91515`)

1. **Config:** `VOICE_MODE=browser|mock|dashboard|live`. Core refuses to boot when the mode's variables are missing (names only, never values). `browser` needs the ElevenLabs key and agent id, `BIDBY_TOOL_SECRET`, `BIDBY_PHONE_KEY`.
2. **`voice/elevenlabs.ts` — `startCall(obligationId)`:**
   - `browser`: no request. Insert `calls` (`provider = browser`, status `initiated`, no `conversation_id`), set the obligation `escalated`, emit `call.started` and `call.ringing`.
   - `mock`: no request; `conversation_id = conv_mock_<obligation_id>`; finished with the mock completion route.
   - `dashboard`: no request; `call.manual_needed` with the dynamic variables.
   - `live` (phone-number path, kept in code, not used): an ElevenLabs outbound phone call to `USER_PHONE`, only if it is in `ALLOWED_DIAL_NUMBERS` (else no request and one `call.refused`).
   - Dynamic variables: `amount` spelled for speech ("3,700 dollars"), `deadline` relative to demo time ("tonight at 11:59 PM"), `next_step` = first head-start checklist step, else the required action.
   - Never two calls about the same item within 2 h demo time (any outcome counts).
3. **`maybeEscalate(item)`** (spec 04 hook): `notified`, score ≥ `CALL_SCORE`, 0 < hours left < `CALL_MAX_HOURS_LEFT` → `startCall`. Spec 04 calls it only after `MAX_FOLLOW_UPS` (2) follow-ups; see "Known gap".
4. **`voice/calls.ts`:** `finishCall` / `processCallResult` — one shared path for the webhook, the recovery poll, the phone page and mock completion. Acts only while the call is `initiated` (dedupe). Transcript → `completed` (`recovered` via the poll), summary + transcript stored. Failure (busy / no-answer / unknown) → `failed` and exactly one closing text: "Couldn't reach you. FAFSA verification is still due tonight 11:59 PM. Reply 1 for the draft."
5. **`voice/routes.ts`** (only `/voice/*` is reachable through the tunnel; a request carrying `CF-Connecting-IP` / `CF-Ray` to any other path gets 404):
   - `/voice/tools/*`: bearer check (401). `details` → `{title, amount, deadline, status, consequence, required_docs, missing_docs, next_step, checklist}`; `snooze` → parses `remind_at_iso` as the student's words against demo time (an ISO time also works) → `{ok, remind_at, remind_at_spoken}`; `done` → `markDone(id, "call")`. Each emits `voice.tool_called`.
   - `/voice/postcall`: raw body, `ElevenLabsClient().webhooks.constructEvent` (bad signature → 401), 200 immediately, then `post_call_transcription` / `call_initiation_failure` → `processCallResult`.
   - `/voice/phone*` (key `BIDBY_PHONE_KEY` as `?k=` or `X-BidBy-Key`, else 401): `GET /voice/phone` (the page), `GET /voice/phone/state` (polled every 1.5 s), `POST /voice/phone/answer` → `{token, dynamic_variables}` (a WebRTC conversation token from `GET /v1/convai/conversation/token`; the API key never reaches the page), `POST /voice/phone/attach` (stores `conversation_id`, first answer wins), `POST /voice/phone/decline`.
6. **Tick:** unanswered for 45 s → no-answer. Recovery poll: a call still `initiated` 8 demo minutes after it started, with a `conversation_id` and no webhook → `GET /v1/convai/conversations/:id` → process it (`recovered`).
7. **`public/phone.html`:** iPhone-style incoming and in-call screens (speaker / FaceTime / mute, more / end / keypad; mute and end work), ringtone from Web Audio, `@elevenlabs/client@1.26.0` from jsdelivr, `Conversation.startSession({conversationToken, connectionType: "webrtc", dynamicVariables})`. Remind Me and Message decline, as on an iPhone.
8. **Local demo routes** (never through the tunnel): `POST /api/demo/escalate {obligation_id?}` calls now (skips the follow-up wait and cooldown); `POST /api/demo/calls/:conversationId/complete` finishes a mock call.

## Acceptance checks

- [x] Phone page rings on `call.ringing`; Decline → `failed` + exactly one closing text; 45 s unanswered → no-answer + one closing text (scratch server, headless browser).
- [x] `/voice/tools/*` without the secret → 401; post-call with a bad signature → 401; `/voice/phone*` without the key → 401; through the tunnel, anything outside `/voice/*` → 404 (tests).
- [x] Mock complete with `say: "snooze 10pm"` → snoozed until 10 PM demo time, `voice.tool_called` emitted (tests + HTTP).
- [x] Recovery after 8 demo minutes (`recovered`, summary stored); duplicate webhook + recovery processed once (tests).
- [x] Live mode: a number not on the allowlist is refused with no request; live with an empty allowlist refuses to boot (tests).
- [x] **Live, on the iPhone:** `POST /api/demo/escalate` rings the phone page; Accept → the agent's first sentence has the right title, amount and deadline.
- [x] "What do I need to do?" → `get_obligation_details`; judge view shows `voice.tool_called` within 2 s.
- [x] "Remind me at 10 PM" → item `snoozed` until 10 PM demo time; "I've already completed it" → `done`, follow-ups stop.
- [x] After hanging up, the post-call webhook stores the summary (`call.completed`).
- [x] Live decline and timeout each send exactly one closing text.

## Known gap

Natural escalation needs 2 follow-ups 2 h apart before a call, so with "Jump to 9 PM" the 11:59 PM deadline passes first. SYSTEM_DESIGN §10 flow E says one follow-up, then the call. Until that is decided, use `POST /api/demo/escalate`.

## References

[JavaScript SDK (startSession, conversation token)](https://elevenlabs.io/docs/eleven-agents/libraries/java-script) · [Get conversation](https://elevenlabs.io/docs/api-reference/conversations/get) · [Webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools.md) · [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables.md) · [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks.md)
