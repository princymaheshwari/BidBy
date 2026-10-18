# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 51 files · ~30,023 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 447 nodes · 1193 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `77f94312`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BidBy Aid
- package.json
- server.ts
- compilerOptions
- GT-like State University: money help resources
- Jordan Rivera
- 2025_tax_return_transcript_PLACEHOLDER.md
- student_id_scan_PLACEHOLDER.md
- verification_worksheet_v1_blank.md
- routes.ts
- tunnel.ts
- setup-openclaw.sh
- rank.ts
- BidBy Coordinator
- timer.ts
- replies.ts
- spectrum.ts
- docs.ts
- BidBy Credit
- BidBy Money In
- BidBy Subscriptions
- routes.ts
- smoke.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 44 edges
2. `emit()` - 35 edges
3. `getObligation()` - 31 edges
4. `act()` - 21 edges
5. `newId()` - 20 edges
6. `isFinal()` - 17 edges
7. `startCall()` - 17 edges
8. `db` - 16 edges
9. `sendToUser()` - 15 edges
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

## Communities (23 total, 3 thin omitted)

### Community 0 - "BidBy Aid"
Cohesion: 0.33
Nodes (5): BidBy Aid, Head start (write_head_start), Never, Rules, What you receive

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (22): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+14 more)

### Community 2 - "server.ts"
Cohesion: 0.07
Nodes (33): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+25 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "GT-like State University: money help resources"
Cohesion: 0.29
Nodes (6): Emergency grant, Financial aid appeal (special circumstances), GT-like State University: money help resources, Office of Financial Aid, Short-term tuition loan, Tuition payment plan

### Community 5 - "Jordan Rivera"
Cohesion: 0.33
Nodes (5): Activities, Experience, Jordan Rivera, Projects, Skills

### Community 9 - "routes.ts"
Cohesion: 0.09
Nodes (33): RECOVERY_AFTER_MINUTES, RING_TIMEOUT_MS, alreadyFinished(), answering, CallResult, checkCalls(), completeMockCall(), failureReason (+25 more)

### Community 10 - "tunnel.ts"
Cohesion: 0.16
Nodes (9): el(), ENV_PATH, rewirePostCall(), rewireTools(), ROOT, setEnv(), ToolConfig, urlFlag (+1 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.07
Nodes (60): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+52 more)

### Community 13 - "BidBy Coordinator"
Cohesion: 0.33
Nodes (5): BidBy Coordinator, Never, Rules, What you must do, What you receive

### Community 14 - "timer.ts"
Cohesion: 0.11
Nodes (29): CALL_MAX_HOURS_LEFT, CALL_SCORE, DEFAULT_SNOOZE_MINUTES, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS (+21 more)

### Community 15 - "replies.ts"
Cohesion: 0.09
Nodes (55): followUp(), maybeEscalate(), notifyTop(), wakeSnoozed(), callClosingText(), checklistText(), digestText(), DOMAIN_COPY (+47 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.20
Nodes (13): SEND_GAP_MS, App, connect(), digits(), getUserSpace(), listen(), mask(), paced() (+5 more)

### Community 17 - "docs.ts"
Cohesion: 0.40
Nodes (8): basename(), covers(), docStatus(), keepExisting(), missingDocs(), STOP, files, tokens()

### Community 18 - "BidBy Credit"
Cohesion: 0.40
Nodes (4): BidBy Credit, Never, Rules, What you receive

### Community 19 - "BidBy Money In"
Cohesion: 0.40
Nodes (4): BidBy Money In, Never, Rules, What you receive

### Community 20 - "BidBy Subscriptions"
Cohesion: 0.40
Nodes (4): BidBy Subscriptions, Never, Rules, What you receive

### Community 23 - "routes.ts"
Cohesion: 0.08
Nodes (39): advance(), hoursUntil(), setTo(), CALL_COOLDOWN_MINUTES, Config, callColumns, clearAll(), DATA_TABLES (+31 more)

### Community 25 - "smoke.ts"
Cohesion: 0.21
Nodes (15): after(), api(), BidbyEvent, check(), event(), events, followEvents(), main() (+7 more)

## Knowledge Gaps
- **3 isolated node(s):** `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 181 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `rank.ts` to `BidBy Aid`, `server.ts`, `routes.ts`, `BidBy Coordinator`, `timer.ts`, `replies.ts`, `spectrum.ts`, `BidBy Credit`, `BidBy Money In`, `BidBy Subscriptions`, `routes.ts`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `tsx`, `typescript` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Why does `emit()` connect `rank.ts` to `server.ts`, `routes.ts`, `replies.ts`, `spectrum.ts`, `routes.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06585365853658537 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._