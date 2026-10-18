# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 54 files · ~39,399 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 485 nodes · 1290 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `82e4a9ed`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BidBy Aid
- package.json
- server.ts
- compilerOptions
- Georgia State University: money help resources
- Jordan Rivera
- 2025_tax_return_transcript_PLACEHOLDER.md
- student_id_scan_PLACEHOLDER.md
- verification_worksheet_v1_blank.md
- routes.ts
- ledger.ts
- setup-openclaw.sh
- rank.ts
- timer.ts
- replies.ts
- spectrum.ts
- headstart.ts
- BidBy
- BidBy Subscriptions
- routes.ts
- smoke.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 44 edges
2. `emit()` - 36 edges
3. `getObligation()` - 31 edges
4. `act()` - 26 edges
5. `newId()` - 20 edges
6. `isFinal()` - 17 edges
7. `startCall()` - 17 edges
8. `db` - 16 edges
9. `sendToUser()` - 16 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/aid/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/coordinator/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/credit/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/money_in/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/subs/AGENTS.md → core/src/clock.ts

## Import Cycles
- None detected.

## Communities (21 total, 3 thin omitted)

### Community 0 - "BidBy Aid"
Cohesion: 0.08
Nodes (18): BidBy Aid, Head start (write_head_start), Never, Rules, What you receive, BidBy Coordinator, Never, Rules (+10 more)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, nodemailer, description, devDependencies, tsx, @types/node, @types/nodemailer, typescript (+19 more)

### Community 2 - "server.ts"
Cohesion: 0.06
Nodes (42): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+34 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "Georgia State University: money help resources"
Cohesion: 0.29
Nodes (6): Emergency grant (demo), Financial aid appeal, special circumstances (demo), Georgia State Payment Plan, Georgia State University: money help resources, Office of Financial Aid (demo), Paying your balance (Student Financial Services)

### Community 5 - "Jordan Rivera"
Cohesion: 0.33
Nodes (5): Activities, Experience, Princy Maheshwari, Projects, Skills

### Community 9 - "routes.ts"
Cohesion: 0.08
Nodes (36): RECOVERY_AFTER_MINUTES, RING_TIMEOUT_MS, callClosingText(), alreadyFinished(), answering, CallResult, checkCalls(), completeMockCall() (+28 more)

### Community 10 - "ledger.ts"
Cohesion: 0.20
Nodes (26): notifyTop(), emit(), dismiss(), DoneVia, fromRow(), getObligation(), getOpen(), isFinal() (+18 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.09
Nodes (39): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+31 more)

### Community 14 - "timer.ts"
Cohesion: 0.11
Nodes (24): CALL_MAX_HOURS_LEFT, CALL_SCORE, DEFAULT_SNOOZE_MINUTES, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS (+16 more)

### Community 15 - "replies.ts"
Cohesion: 0.09
Nodes (48): digest(), followUp(), maybeEscalate(), wakeSnoozed(), addressOf(), canEmail(), fromAddress(), parseDraft() (+40 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.20
Nodes (12): SEND_GAP_MS, App, connect(), digits(), getUserSpace(), listen(), mask(), paced() (+4 more)

### Community 17 - "headstart.ts"
Cohesion: 0.16
Nodes (24): docsReport(), basename(), blankFor(), covers(), docStatus(), keepExisting(), missingDocs(), STOP (+16 more)

### Community 18 - "BidBy"
Cohesion: 0.29
Nodes (6): BidBy, Features, How it's built, The BidBy voice agent (ElevenLabs), The problem, What BidBy does

### Community 20 - "BidBy Subscriptions"
Cohesion: 0.40
Nodes (4): BidBy Subscriptions, Never, Rules, What you receive

### Community 23 - "routes.ts"
Cohesion: 0.08
Nodes (42): advance(), hoursUntil(), now(), setTo(), CALL_COOLDOWN_MINUTES, Config, callColumns, clearAll() (+34 more)

### Community 25 - "smoke.ts"
Cohesion: 0.08
Nodes (25): dir, after(), api(), BidbyEvent, check(), event(), events, followEvents() (+17 more)

## Knowledge Gaps
- **4 isolated node(s):** `@types/node`, `@types/nodemailer`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 197 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `routes.ts` to `BidBy Aid`, `server.ts`, `routes.ts`, `ledger.ts`, `rank.ts`, `timer.ts`, `replies.ts`, `spectrum.ts`, `headstart.ts`, `BidBy Subscriptions`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/nodemailer`, `tsx` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BidBy Aid` be split into smaller, more focused modules?**
  _Cohesion score 0.07792207792207792 - nodes in this community are weakly interconnected._
- **Why does `nodemailer` connect `package.json` to `replies.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `emit()` connect `ledger.ts` to `server.ts`, `routes.ts`, `rank.ts`, `replies.ts`, `spectrum.ts`, `headstart.ts`, `routes.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._