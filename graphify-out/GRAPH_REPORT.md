# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 36 files · ~14,210 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 286 nodes · 671 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4316a22`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- now
- package.json
- server.ts
- compilerOptions
- core/package.json
- setup-openclaw.sh
- rank.ts
- timer.ts
- replies.ts
- spectrum.ts
- ledger.ts
- score.test.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 31 edges
2. `emit()` - 23 edges
3. `act()` - 19 edges
4. `getObligation()` - 15 edges
5. `compilerOptions` - 15 edges
6. `newId()` - 13 edges
7. `sendToUser()` - 13 edges
8. `callAgent()` - 11 edges
9. `formatNY()` - 11 edges
10. `ingest()` - 11 edges

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

## Communities (16 total, 4 thin omitted)

### Community 0 - "now"
Cohesion: 0.06
Nodes (32): advance(), hoursUntil(), now(), setTo(), getSettings(), updateSettings(), BidBy Aid, Never (+24 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

### Community 2 - "server.ts"
Cohesion: 0.09
Nodes (25): Config, REPO_ROOT, clearAll(), DATA_TABLES, db, IdPrefix, Settings, BidbyEvent (+17 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "core/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+6 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.11
Nodes (37): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+29 more)

### Community 14 - "timer.ts"
Cohesion: 0.11
Nodes (29): CALL_MAX_HOURS_LEFT, CALL_SCORE, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS, NO_REPLY_MINUTES (+21 more)

### Community 15 - "replies.ts"
Cohesion: 0.14
Nodes (27): DEFAULT_SNOOZE_MINUTES, checklistText(), digestText(), DOMAIN_COPY, due(), followUpText(), interruptText(), Item (+19 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.20
Nodes (13): SEND_GAP_MS, App, connect(), digits(), getUserSpace(), listen(), mask(), paced() (+5 more)

### Community 18 - "ledger.ts"
Cohesion: 0.27
Nodes (16): notifyTop(), wakeSnoozed(), dismiss(), DoneVia, fromRow(), getObligation(), getOpen(), isFinal() (+8 more)

### Community 20 - "score.test.ts"
Cohesion: 0.31
Nodes (5): rankByScore(), score(), ScoreInput, at, base

## Knowledge Gaps
- **4 isolated node(s):** `@elevenlabs/elevenlabs-js`, `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 117 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `now` to `server.ts`, `rank.ts`, `timer.ts`, `replies.ts`, `spectrum.ts`, `ledger.ts`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@elevenlabs/elevenlabs-js`, `@types/node`, `tsx` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `now` be split into smaller, more focused modules?**
  _Cohesion score 0.0620782726045884 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `server.ts` to `core/package.json`, `rank.ts`, `timer.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._