# Graph Report - BidBy  (2026-10-17)

## Corpus Check
- 33 files · ~2,640 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 3, .example 1)

## Summary
- 133 nodes · 162 edges · 26 communities (5 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02467977`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.ts
- package.json
- config.ts
- compilerOptions
- core/package.json
- aid/AGENTS.md
- coordinator/AGENTS.md
- credit/AGENTS.md
- extractor/AGENTS.md
- money_in/AGENTS.md
- subs/AGENTS.md
- setup-openclaw.sh

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `now()` - 9 edges
3. `advance()` - 5 edges
4. `newId()` - 5 edges
5. `getSettings()` - 5 edges
6. `updateSettings()` - 5 edges
7. `emit()` - 5 edges
8. `scripts` - 5 edges
9. `zod` - 4 edges
10. `setTo()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `now()` --calls--> `getSettings()`  [EXTRACTED]
  core/src/clock.ts → core/src/db.ts
- `emit()` --calls--> `now()`  [EXTRACTED]
  core/src/events.ts → core/src/clock.ts
- `storeRawMessage()` --calls--> `now()`  [EXTRACTED]
  core/src/server.ts → core/src/clock.ts
- `advance()` --calls--> `getSettings()`  [EXTRACTED]
  core/src/clock.ts → core/src/db.ts
- `advance()` --calls--> `updateSettings()`  [EXTRACTED]
  core/src/clock.ts → core/src/db.ts

## Import Cycles
- None detected.

## Communities (26 total, 21 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.13
Nodes (25): advance(), hoursUntil(), now(), setTo(), Config, clearAll(), DATA_TABLES, db (+17 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (21): description, devDependencies, tsx, @types/node, typescript, engines, node, license (+13 more)

### Community 2 - "config.ts"
Cohesion: 0.15
Nodes (15): CALL_MAX_HOURS_LEFT, CALL_SCORE, Env, envPath, INTERRUPT_SCORE, NO_REPLY_MINUTES, optional, parsed (+7 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 4 - "core/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @elevenlabs/elevenlabs-js, hono, @hono/node-server, spectrum-ts, zod, name, private (+6 more)

## Knowledge Gaps
- **5 isolated node(s):** `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node`, `tsx`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 94 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `zod` connect `config.ts` to `server.ts`, `core/package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `@elevenlabs/elevenlabs-js`, `spectrum-ts`, `@types/node` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12701612903225806 - nodes in this community are weakly interconnected._
- **Why does `hono` connect `core/package.json` to `server.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `core/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._