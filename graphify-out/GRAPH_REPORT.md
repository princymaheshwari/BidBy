# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 52 files · ~36,661 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 460 nodes · 1209 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c37635ae`
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
- BidBy
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
  openclaw/agents/subs/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/credit/AGENTS.md → core/src/clock.ts
- `Rules` --references--> `now()`  [INFERRED]
  openclaw/agents/extractor/AGENTS.md → core/src/clock.ts

## Import Cycles
- None detected.

## Communities (22 total, 3 thin omitted)

### Community 0 - "BidBy Aid"
Cohesion: 0.33
Nodes (5): BidBy Aid, Head start (write_head_start), Never, Rules, What you receive

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (22): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+14 more)

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
Nodes (5): Activities, Experience, Princy Maheshwari, Projects, Skills

### Community 9 - "routes.ts"
Cohesion: 0.07
Nodes (66): RECOVERY_AFTER_MINUTES, RING_TIMEOUT_MS, maybeEscalate(), emit(), latestHeadStart(), dismiss(), DoneVia, fromRow() (+58 more)

### Community 10 - "tunnel.ts"
Cohesion: 0.16
Nodes (9): el(), ENV_PATH, rewirePostCall(), rewireTools(), ROOT, setEnv(), ToolConfig, urlFlag (+1 more)

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.08
Nodes (50): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+42 more)

### Community 13 - "BidBy Coordinator"
Cohesion: 0.33
Nodes (5): BidBy Coordinator, Never, Rules, What you must do, What you receive

### Community 14 - "timer.ts"
Cohesion: 0.10
Nodes (33): CALL_COOLDOWN_MINUTES, CALL_MAX_HOURS_LEFT, CALL_SCORE, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS (+25 more)

### Community 15 - "replies.ts"
Cohesion: 0.13
Nodes (29): DEFAULT_SNOOZE_MINUTES, callClosingText(), checklistText(), digestText(), DOMAIN_COPY, due(), followUpText(), headStartChecklistText() (+21 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.13
Nodes (19): SEND_GAP_MS, db, BidbyEvent, eventsStream(), Listener, listeners, recentEvents(), App (+11 more)

### Community 17 - "docs.ts"
Cohesion: 0.40
Nodes (8): basename(), covers(), docStatus(), keepExisting(), missingDocs(), STOP, files, tokens()

### Community 18 - "BidBy"
Cohesion: 0.29
Nodes (6): BidBy, Features, How it's built, The BidBy voice agent (ElevenLabs), The problem, What BidBy does

### Community 20 - "BidBy Subscriptions"
Cohesion: 0.40
Nodes (4): BidBy Subscriptions, Never, Rules, What you receive

### Community 23 - "routes.ts"
Cohesion: 0.06
Nodes (42): advance(), hoursUntil(), now(), setTo(), callColumns, clearAll(), DATA_TABLES, getSettings() (+34 more)

### Community 25 - "smoke.ts"
Cohesion: 0.21
Nodes (15): after(), api(), BidbyEvent, check(), event(), events, followEvents(), main() (+7 more)

## Knowledge Gaps
- **3 isolated node(s):** `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 191 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `routes.ts` to `BidBy Aid`, `server.ts`, `routes.ts`, `rank.ts`, `BidBy Coordinator`, `timer.ts`, `replies.ts`, `spectrum.ts`, `BidBy Subscriptions`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `tsx`, `typescript` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Why does `emit()` connect `routes.ts` to `server.ts`, `rank.ts`, `replies.ts`, `spectrum.ts`, `routes.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._