# Spec 01 — OpenClaw setup and agent adapter

**Time box:** 60 min (hard: if no working call by then, use the fallback below) · **Depends on:** 00 · **Design refs:** SYSTEM_DESIGN §6, §7 (agents), §9.2

## Goal

Six OpenClaw agents registered, each with its own playbook, and one function in core that calls any of them and returns validated JSON.

## Prerequisites (the user does these, not Claude Code)

- OpenClaw installed globally and `openclaw onboard` completed with an LLM provider key.
- `openclaw gateway` running.

## Build

1. **`openclaw/config.patch.json`**: enable `gateway.http.endpoints.chatCompletions.enabled: true`; keep the bind on 127.0.0.1; gateway auth mode `token`. Apply with `openclaw config patch` (check the exact command in [Config CLI](https://docs.openclaw.ai/cli/config)) or document the manual edit if patching isn't available.
2. **`scripts/setup-openclaw.sh`** (idempotent):
   - For each id in `extractor aid credit subs money_in coordinator`: `openclaw agents add <id>` if missing (see [Agents CLI](https://docs.openclaw.ai/cli/agents)).
   - Find each agent's workspace path from OpenClaw's own config/CLI output; do **not** hard-code `~/.openclaw/...`.
   - Symlink `openclaw/agents/<id>/AGENTS.md` into that workspace. For `aid`, also symlink `openclaw/agents/aid/docs/`.
   - Print `GET /v1/models` output at the end; it should list `openclaw/<id>` for all six.
3. **Playbooks** `openclaw/agents/<id>/AGENTS.md`. Each one: role in one line; what it receives; the tool it must call; domain rules; "never give investment or loan advice; never claim to pay anything". Domain rules to include:
   - `extractor`: amounts in USD, deadlines as ISO with timezone America/New_York; merge rule (same institution + same obligation → `merge_with`); confirmations ("payment received", "documents accepted", "application submitted") → `completes`; promotions/newsletters → `is_noise`; messages asking for credentials, SSNs, or urging urgent clicks from non-official domains → `is_suspicious`.
   - `aid`: verification holds **all** federal aid disbursement → `blocks_other_aid: true`; missing an aid deadline is not reversible; typical documents (IRS tax return transcript, verification worksheet, ID).
   - `credit`: amount at risk = late fee + interest on statement balance for one cycle; paying late is partly reversible (`reversible: true` only if before the next statement).
   - `subs`: amount at risk = renewal price; cancelling after renewal is usually not refundable.
   - `money_in`: amount at risk = award or reimbursement amount; missed windows are not reversible.
   - `coordinator`: given bids and the computed ranking, explain in ≤ 2 sentences why #1 beats #2. Never reorder.
4. **`core/src/agents/schemas.ts`**: zod schemas + JSON Schema for `record_obligations`, `submit_bids`, `explain_decision`, `write_head_start`, `answer_user`, exactly as in SYSTEM_DESIGN §9.2. Generate JSON Schema from zod (`z.toJSONSchema` in zod v4) so they never drift.
5. **`core/src/agents/openclaw.ts`**: `callAgent<T>(agentId, userContent, tool: {name, zod, jsonSchema}): Promise<T | null>`
   - POST to `/v1/chat/completions` per SYSTEM_DESIGN §9.2 with `tool_choice` pinned to the tool. No `user` field.
   - Parse `choices[0].message.tool_calls[0].function.arguments`; validate; on failure retry once with the validation error appended; then return `null` and `emit("agent.failed", …)`.
   - Emit `agent.called` and `agent.returned` events with agent id and latency (not the full prompt).
   - Timeout 60 s.
6. **Fallback switch:** `AGENT_BACKEND=openclaw|direct` in `.env`. `direct` calls the LLM provider's API with the same messages and tool schema and the playbook text as the system prompt (read from `openclaw/agents/<id>/AGENTS.md`). Same function signature. Only build `direct` if the time box is exceeded.

## Acceptance checks

- [ ] `GET /v1/models` lists all six `openclaw/<id>` targets.
- [ ] A throwaway script calls `callAgent("coordinator", …, explain_decision)` and gets `{rationale: string}`.
- [ ] Editing `openclaw/agents/coordinator/AGENTS.md` in the repo changes the live agent's behavior (symlink works).
- [ ] A forced invalid response (temporarily break the schema) produces one retry, then `null` and an `agent.failed` event.
- [ ] `openclaw security audit` runs; note any findings in the PR description.

## References

[Chat completions](https://docs.openclaw.ai/gateway/openai-http-api.md) · [Multi-agent routing](https://docs.openclaw.ai/concepts/multi-agent) · [Agent workspace](https://docs.openclaw.ai/concepts/agent-workspace) · [Security](https://docs.openclaw.ai/gateway/security)
