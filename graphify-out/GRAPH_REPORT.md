# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 50 files · ~25,153 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 415 nodes · 1134 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f915155`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- now
- package.json
- server.ts
- compilerOptions
- GT-like State University: money help resources
- Jordan Rivera
- 2025_tax_return_transcript_PLACEHOLDER.md
- student_id_scan_PLACEHOLDER.md
- verification_worksheet_v1_blank.md
- routes.ts
- setup-openclaw.sh
- rank.ts
- timer.ts
- replies.ts
- spectrum.ts
- docs.ts
- routes.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 44 edges
2. `emit()` - 35 edges
3. `getObligation()` - 30 edges
4. `act()` - 21 edges
5. `newId()` - 19 edges
6. `isFinal()` - 17 edges
7. `startCall()` - 17 edges
8. `db` - 15 edges
9. `sendToUser()` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/aid/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/coordinator/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/credit/AGENTS.md → core/src/clock.ts
- `Rules` --references--> `now()`  [INFERRED]
  openclaw/agents/extractor/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/extractor/AGENTS.md → core/src/clock.ts

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "now"
Cohesion: 0.06
Nodes (36): advance(), hoursUntil(), now(), setTo(), getSettings(), updateSettings(), notifyTop(), resetBudgetOnNewDay() (+28 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

### Community 2 - "server.ts"
Cohesion: 0.06
Nodes (37): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+29 more)

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
Nodes (34): RECOVERY_AFTER_MINUTES, RING_TIMEOUT_MS, callClosingText(), alreadyFinished(), answering, CallResult, checkCalls(), completeMockCall() (+26 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.08
Nodes (51): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+43 more)

### Community 14 - "timer.ts"
Cohesion: 0.12
Nodes (20): CALL_MAX_HOURS_LEFT, CALL_SCORE, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS, NO_REPLY_MINUTES (+12 more)

### Community 15 - "replies.ts"
Cohesion: 0.08
Nodes (60): DEFAULT_SNOOZE_MINUTES, budgetDay(), digest(), followUp(), texts(), wakeSnoozed(), checklistText(), digestText() (+52 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.20
Nodes (13): SEND_GAP_MS, App, connect(), digits(), getUserSpace(), listen(), mask(), paced() (+5 more)

### Community 17 - "docs.ts"
Cohesion: 0.40
Nodes (8): basename(), covers(), docStatus(), keepExisting(), missingDocs(), STOP, files, tokens()

### Community 23 - "routes.ts"
Cohesion: 0.09
Nodes (32): CALL_COOLDOWN_MINUTES, Config, callColumns, clearAll(), DATA_TABLES, db, IdPrefix, Settings (+24 more)

## Knowledge Gaps
- **3 isolated node(s):** `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 164 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `now` to `server.ts`, `routes.ts`, `rank.ts`, `timer.ts`, `replies.ts`, `spectrum.ts`, `routes.ts`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `tsx`, `typescript` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `now` be split into smaller, more focused modules?**
  _Cohesion score 0.059800664451827246 - nodes in this community are weakly interconnected._
- **Why does `emit()` connect `rank.ts` to `now`, `server.ts`, `routes.ts`, `replies.ts`, `spectrum.ts`, `routes.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05893719806763285 - nodes in this community are weakly interconnected._