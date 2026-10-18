# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 43 files · ~16,646 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 327 nodes · 771 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec2230c2`
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
- setup-openclaw.sh
- rank.ts
- timer.ts
- replies.ts
- spectrum.ts
- headstart.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 33 edges
2. `emit()` - 25 edges
3. `act()` - 21 edges
4. `getObligation()` - 17 edges
5. `newId()` - 15 edges
6. `compilerOptions` - 15 edges
7. `build()` - 14 edges
8. `callAgent()` - 13 edges
9. `sendToUser()` - 13 edges
10. `formatNY()` - 13 edges

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

## Communities (18 total, 6 thin omitted)

### Community 0 - "now"
Cohesion: 0.06
Nodes (33): advance(), hoursUntil(), now(), setTo(), getSettings(), updateSettings(), BidBy Aid, Head start (write_head_start) (+25 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

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

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "rank.ts"
Cohesion: 0.10
Nodes (28): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, explainDecision (+20 more)

### Community 14 - "timer.ts"
Cohesion: 0.10
Nodes (35): CALL_MAX_HOURS_LEFT, CALL_SCORE, DEFAULT_SNOOZE_MINUTES, DIGEST_HOUR, Env, envPath, INTERRUPT_SCORE, MAX_FOLLOW_UPS (+27 more)

### Community 15 - "replies.ts"
Cohesion: 0.11
Nodes (41): Domain, notifyTop(), checklistText(), digestText(), DOMAIN_COPY, due(), followUpText(), headStartChecklistText() (+33 more)

### Community 16 - "spectrum.ts"
Cohesion: 0.11
Nodes (29): SEND_GAP_MS, db, newId(), BidbyEvent, emit(), eventsStream(), Listener, listeners (+21 more)

### Community 17 - "headstart.ts"
Cohesion: 0.18
Nodes (19): basename(), covers(), docStatus(), keepExisting(), missingDocs(), STOP, files, tokens() (+11 more)

## Knowledge Gaps
- **4 isolated node(s):** `@elevenlabs/elevenlabs-js`, `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 137 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `now` to `server.ts`, `rank.ts`, `timer.ts`, `replies.ts`, `spectrum.ts`, `headstart.ts`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@elevenlabs/elevenlabs-js`, `@types/node`, `tsx` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `now` be split into smaller, more focused modules?**
  _Cohesion score 0.06025641025641026 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `server.ts` to `rank.ts`, `timer.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06620209059233449 - nodes in this community are weakly interconnected._