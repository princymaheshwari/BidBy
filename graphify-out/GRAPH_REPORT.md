# Graph Report - BidBy  (2026-10-18)

## Corpus Check
- 33 files · ~6,072 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 173 nodes · 227 edges · 25 communities (13 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a0785d87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BidBy Extractor
- package.json
- config.ts
- compilerOptions
- core/package.json
- BidBy Aid
- BidBy Coordinator
- BidBy Credit
- db.ts
- BidBy Money In
- BidBy Subscriptions
- setup-openclaw.sh
- openclaw.ts

## God Nodes (most connected - your core abstractions)
1. `now()` - 16 edges
2. `compilerOptions` - 15 edges
3. `emit()` - 7 edges
4. `setup-openclaw.sh script` - 7 edges
5. `zod` - 6 edges
6. `advance()` - 5 edges
7. `newId()` - 5 edges
8. `getSettings()` - 5 edges
9. `updateSettings()` - 5 edges
10. `scripts` - 5 edges

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

## Communities (25 total, 12 thin omitted)

### Community 0 - "BidBy Extractor"
Cohesion: 0.33
Nodes (5): BidBy Extractor, Never, Rules, What you must do, What you receive

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

### Community 2 - "config.ts"
Cohesion: 0.12
Nodes (19): CALL_MAX_HOURS_LEFT, CALL_SCORE, Env, envPath, INTERRUPT_SCORE, NO_REPLY_MINUTES, optional, parsed (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "core/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+6 more)

### Community 5 - "BidBy Aid"
Cohesion: 0.40
Nodes (4): BidBy Aid, Never, Rules, What you receive

### Community 6 - "BidBy Coordinator"
Cohesion: 0.33
Nodes (5): BidBy Coordinator, Never, Rules, What you must do, What you receive

### Community 7 - "BidBy Credit"
Cohesion: 0.40
Nodes (4): BidBy Credit, Never, Rules, What you receive

### Community 8 - "db.ts"
Cohesion: 0.14
Nodes (20): advance(), hoursUntil(), now(), setTo(), REPO_ROOT, clearAll(), DATA_TABLES, db (+12 more)

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
Cohesion: 0.15
Nodes (13): AgentId, callAgent(), ChatCompletion, elapsed(), requestToolCall(), AgentTool, answerUser, Domain (+5 more)

## Knowledge Gaps
- **5 isolated node(s):** `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 107 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `db.ts` to `BidBy Extractor`, `config.ts`, `BidBy Aid`, `BidBy Coordinator`, `BidBy Credit`, `BidBy Money In`, `BidBy Subscriptions`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `now()` (e.g. with `What you receive` and `What you receive`) actually correct?**
  _`now()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `config.ts` to `core/package.json`, `openclaw.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._