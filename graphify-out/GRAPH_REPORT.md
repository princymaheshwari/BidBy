# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 54 files · ~40,051 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 490 nodes · 1307 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `152374a2`
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
- tunnel.ts
- timer.ts
- replies.ts
- spectrum.ts
- headstart.ts
- BidBy
- BidBy Coordinator
- BidBy Subscriptions
- BidBy Money In
- routes.ts
- smoke.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 44 edges
2. `emit()` - 36 edges
3. `getObligation()` - 31 edges
4. `act()` - 26 edges
5. `newId()` - 20 edges
6. `sendToUser()` - 17 edges
7. `isFinal()` - 17 edges
8. `startCall()` - 17 edges
9. `db` - 16 edges
10. `finishCall()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/aid/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/coordinator/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/money_in/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/subs/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/credit/AGENTS.md → core/src/clock.ts

## Import Cycles
- None detected.

## Communities (24 total, 3 thin omitted)

### Community 0 - "BidBy Aid"
Cohesion: 0.33
Nodes (5): BidBy Aid, Head start (write_head_start), Never, Rules, What you receive

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, nodemailer, description, devDependencies, tsx, @types/node, @types/nodemailer, typescript (+19 more)

### Community 2 - "server.ts"
Cohesion: 0.09
Nodes (23): REPO_ROOT, findFixture(), Fixture, load(), loadHeld(), loadInbox(), renderFixture(), latestDecision() (+15 more)

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
Cohesion: 0.06
Nodes (49): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+41 more)

### Community 10 - "ledger.ts"
Cohesion: 0.16
Nodes (28): DEFAULT_SNOOZE_MINUTES, notifyTop(), currentItem(), latestHeadStart(), dismiss(), DoneVia, fromRow(), getObligation() (+20 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.07
Nodes (52): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, explainDecision (+44 more)

### Community 13 - "tunnel.ts"
Cohesion: 0.16
Nodes (9): el(), ENV_PATH, rewirePostCall(), rewireTools(), ROOT, setEnv(), ToolConfig, urlFlag (+1 more)

### Community 14 - "timer.ts"
Cohesion: 0.10
Nodes (30): CALL_COOLDOWN_MINUTES, CALL_MAX_HOURS_LEFT, CALL_SCORE, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS (+22 more)

### Community 15 - "replies.ts"
Cohesion: 0.10
Nodes (40): Domain, followUp(), maybeEscalate(), wakeSnoozed(), addressOf(), canEmail(), fromAddress(), parseDraft() (+32 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.20
Nodes (14): SEND_GAP_MS, App, connect(), digits(), getUserSpace(), listen(), mask(), paced() (+6 more)

### Community 17 - "headstart.ts"
Cohesion: 0.12
Nodes (29): docsReport(), basename(), blankFor(), covers(), docStatus(), keepExisting(), missingDocs(), STOP (+21 more)

### Community 18 - "BidBy"
Cohesion: 0.29
Nodes (6): BidBy, Features, How it's built, The BidBy voice agent (ElevenLabs), The problem, What BidBy does

### Community 19 - "BidBy Coordinator"
Cohesion: 0.33
Nodes (5): BidBy Coordinator, Never, Rules, What you must do, What you receive

### Community 20 - "BidBy Subscriptions"
Cohesion: 0.40
Nodes (4): BidBy Subscriptions, Never, Rules, What you receive

### Community 21 - "BidBy Money In"
Cohesion: 0.40
Nodes (4): BidBy Money In, Never, Rules, What you receive

### Community 23 - "routes.ts"
Cohesion: 0.09
Nodes (38): advance(), hoursUntil(), setTo(), Config, callColumns, clearAll(), DATA_TABLES, db (+30 more)

### Community 25 - "smoke.ts"
Cohesion: 0.21
Nodes (15): after(), api(), BidbyEvent, check(), event(), events, followEvents(), main() (+7 more)

## Knowledge Gaps
- **4 isolated node(s):** `@types/node`, `@types/nodemailer`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `rank.ts` to `BidBy Aid`, `server.ts`, `routes.ts`, `ledger.ts`, `timer.ts`, `replies.ts`, `spectrum.ts`, `headstart.ts`, `BidBy Coordinator`, `BidBy Subscriptions`, `BidBy Money In`, `routes.ts`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/nodemailer`, `tsx` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `nodemailer` connect `package.json` to `replies.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09425287356321839 - nodes in this community are weakly interconnected._
- **Why does `emit()` connect `rank.ts` to `server.ts`, `routes.ts`, `ledger.ts`, `replies.ts`, `spectrum.ts`, `headstart.ts`, `routes.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._