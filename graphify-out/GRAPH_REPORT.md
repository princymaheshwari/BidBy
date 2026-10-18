# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 33 files · ~10,098 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 221 nodes · 403 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `637043dc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- now
- package.json
- config.ts
- compilerOptions
- dependencies
- BidBy Aid
- BidBy Credit
- events.ts
- BidBy Money In
- BidBy Subscriptions
- setup-openclaw.sh
- openclaw.ts
- ingest.ts
- rank.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 24 edges
2. `emit()` - 16 edges
3. `compilerOptions` - 15 edges
4. `ingest()` - 11 edges
5. `rankOnce()` - 10 edges
6. `callAgent()` - 9 edges
7. `newId()` - 9 edges
8. `getObligation()` - 9 edges
9. `markDone()` - 9 edges
10. `formatNY()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/aid/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/credit/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/money_in/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/subs/AGENTS.md → core/src/clock.ts
- `What you receive` --references--> `now()`  [INFERRED]
  openclaw/agents/coordinator/AGENTS.md → core/src/clock.ts

## Import Cycles
- None detected.

## Communities (21 total, 7 thin omitted)

### Community 0 - "now"
Cohesion: 0.11
Nodes (20): advance(), hoursUntil(), now(), setTo(), clearAll(), DATA_TABLES, getSettings(), IdPrefix (+12 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

### Community 2 - "config.ts"
Cohesion: 0.07
Nodes (34): name, private, type, version, nyOffsetMinutes(), nyWallClock(), CALL_MAX_HOURS_LEFT, CALL_SCORE (+26 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod

### Community 5 - "BidBy Aid"
Cohesion: 0.40
Nodes (4): BidBy Aid, Never, Rules, What you receive

### Community 7 - "BidBy Credit"
Cohesion: 0.40
Nodes (4): BidBy Credit, Never, Rules, What you receive

### Community 8 - "events.ts"
Cohesion: 0.33
Nodes (6): db, BidbyEvent, eventsStream(), Listener, listeners, recentEvents()

### Community 9 - "BidBy Money In"
Cohesion: 0.40
Nodes (4): BidBy Money In, Never, Rules, What you receive

### Community 10 - "BidBy Subscriptions"
Cohesion: 0.40
Nodes (4): BidBy Subscriptions, Never, Rules, What you receive

### Community 11 - "setup-openclaw.sh"
Cohesion: 0.42
Nodes (7): die(), gateway_up(), load_workspaces(), read_token(), setup-openclaw.sh script, sync_agent(), workspace_dir()

### Community 12 - "openclaw.ts"
Cohesion: 0.18
Nodes (11): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, explainDecision (+3 more)

### Community 18 - "ingest.ts"
Cohesion: 0.17
Nodes (26): Domain, newId(), emit(), buildPrompt(), Extracted, IncomingMessage, ingest(), IngestResult (+18 more)

### Community 20 - "rank.ts"
Cohesion: 0.15
Nodes (19): formatNY(), Bid, collectBids(), Decision, DOMAINS, explain(), firstSentences(), latestDecision() (+11 more)

## Knowledge Gaps
- **5 isolated node(s):** `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 115 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `now` to `config.ts`, `BidBy Aid`, `BidBy Credit`, `events.ts`, `BidBy Money In`, `BidBy Subscriptions`, `ingest.ts`, `rank.ts`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `now` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `config.ts` to `openclaw.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `config.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._