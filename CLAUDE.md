# BidBy

Personal finance agent for students. Reads where money obligations hide (email, Slack, bank alerts), builds a ledger with dollar amounts and deadlines, has domain agents **bid** for the user's attention, texts only the item that costs most to miss (iMessage via Photon), does the first step of the work, and calls the user (ElevenLabs agent over a Twilio number) if a high-stakes deadline is ignored.

Solo hackathon build: Hack Like W@CC 2026, Finance track. **Hacking ends Sun Oct 18, 12:00 PM ET.** Optimise for a working, deterministic demo over completeness.

## Read before writing code

1. `docs/SYSTEM_DESIGN.md` — the source of truth: problem, use cases, architecture, data model, API contracts, tool schemas.
2. The one spec in `specs/` you are working on. Specs are numbered in build order.

If a spec conflicts with `docs/SYSTEM_DESIGN.md`, stop and say so; do not pick one silently.

## How to work

- Work on **one spec at a time**, in numeric order, unless I say otherwise. Don't start the next spec until the current one's acceptance checks pass.
- At the start of a spec, restate its acceptance checks and list the files you'll touch. At the end, run the checks and report pass/fail for each.
- Don't change contracts in `docs/SYSTEM_DESIGN.md` (endpoints, table columns, tool schemas) without asking. If one is wrong, propose the edit.
- When an external API's exact call shape is uncertain (OpenClaw, spectrum-ts, ElevenLabs), check the doc links in the spec before guessing. Never invent SDK methods.
- Keep it small: no new dependencies beyond those listed below without asking.

## Stack

- Node 26, TypeScript, ESM. Run with `tsx` in dev.
- Server: Hono (`@hono/node-server`).
- DB: `node:sqlite` (built in). Fall back to `better-sqlite3` only if blocked, and say so.
- Validation: zod.
- Messaging: `spectrum-ts` (cloud iMessage provider only; never `@spectrum-ts/imessage-local`).
- Voice: ElevenLabs agent over a Twilio number. `@elevenlabs/elevenlabs-js` (webhook verification) + plain `fetch` for the outbound-call API.
- Agents: OpenClaw Gateway, called over HTTP at `http://127.0.0.1:18789/v1/chat/completions`. OpenClaw is installed globally and is **not** in this repo; only its agent playbooks and setup script are.
- Judge view: one static HTML file with inline JS, served by core. No React, no bundler.

## Repo layout

```
bidby/
  CLAUDE.md
  docs/SYSTEM_DESIGN.md
  specs/                      one file per build step
  core/
    src/
      server.ts               Hono app, routes, starts timers + Spectrum loop
      config.ts               env + thresholds
      db.ts                   schema, migrations, query helpers
      clock.ts                now(), demo offset
      events.ts               emit() + SSE fan-out
      agents/openclaw.ts      callAgent(agentId, prompt, toolSchema) → parsed JSON
      agents/schemas.ts       zod + JSON Schema for every tool
      pipeline/ingest.ts      F1
      pipeline/rank.ts        F2 (score + bids + rationale)
      pipeline/headstart.ts   F3
      messaging/spectrum.ts   F4 send/receive
      messaging/replies.ts    F4 reply grammar
      escalation/timer.ts     F4/F5 tick loop
      voice/elevenlabs.ts     F5 start call
      voice/routes.ts         F5 /voice/tools/*, /voice/postcall
    public/index.html         judge view
  openclaw/
    agents/<id>/AGENTS.md     playbook per agent (extractor, aid, credit, subs, money_in, coordinator)
    agents/aid/docs/          local documents the aid agent may find (resume, transcript placeholder)
    config.patch.json
  scripts/setup-openclaw.sh
  scripts/smoke.ts            end-to-end check (spec 07)
  fixtures/inbox.json         seeded messages
  fixtures/held.json          injected live during the demo
  .env.example
```

Note: the per-agent `AGENTS.md` files are OpenClaw playbooks, not instructions for you. There is deliberately no root `AGENTS.md`.

## Commands

- `npm run dev` — start core on :8787 (requires the Gateway running)
- `npm run check` — typecheck
- `npm run smoke` — scripted end-to-end run against the seeded inbox (built in spec 07)
- `bash scripts/setup-openclaw.sh` — register agents and link playbooks

## Non-negotiable rules

- **Time:** always use `now()` from `clock.ts`. Never call `Date.now()` elsewhere.
- **Ranking is deterministic:** the score formula lives in code; LLMs never decide order.
- **Every state change** writes an `events` row via `emit()`.
- **No money moves.** No code pays, transfers, logs into a bank, or stores card numbers. Send links; the user clicks.
- **Security:** OpenClaw Gateway stays on 127.0.0.1. Install no ClawHub skills. Only `/voice/*` may be exposed (via tunnel), and every `/voice/*` route checks its secret.
- **Dialing:** never dial a number outside `ALLOWED_DIAL_NUMBERS`.
- **Messaging hygiene:** act only on texts from `USER_PHONE`; no links in the first message of a conversation; at most 2 follow-ups per obligation.
- **Secrets** come from `.env` only; never log them, never send them to the browser.
- **Pitch language** in any user-facing copy: "money at risk", "aid", "fees", "deadlines". Never "productivity" or "inbox triage".

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
