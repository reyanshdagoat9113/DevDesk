# Test review ledger

Durable evidence for the test-suite modernization initiative. Dispositions evolve as replacements land.

**Coverage policy:** V8 reports via `npm run test:coverage*`. Per-suite thresholds are active and non-decreasing (see vitest configs). Lowering a threshold requires an explicit planning decision.

**Recorded threshold decisions**

| Suite | Change | Reason |
| --- | --- | --- |
| renderer | lines/statements 8 → 30, branches 40 → 55, functions 20 → 12 | `App.bootstrap.test.tsx` now mounts `App`, so V8 instruments the whole shell dependency tree instead of a handful of leaf components. Statements and branches ratchet up sharply; the function *denominator* grows because many real, still-uncovered handlers become visible. The functions figure is a measurement-scope correction (more honest), not a coverage regression. |

**Runtime:** Node `>=22.12.0 <25`; default pin `.nvmrc` = **22.23.1**. CI compatibility lanes track Node 22 and 24 lines. Single `better-sqlite3` v12 across root + engine.

## Pre-existing automated tests

| File | Suite | Disposition | Notes / replacement owner |
| --- | --- | --- | --- |
| `apps/desktop/commands/variableDetector.test.ts` | desktop | retain | Variable detection contract |
| `apps/desktop/commands/variableResolver.test.ts` | desktop | retain | Resolver behavior |
| `apps/desktop/data/store/bugs.test.ts` | desktop | strengthen | Add real-SQLite attachment compensation (T3); keep unit paths |
| `apps/desktop/data/store/health.test.ts` | desktop | retain | Health store |
| `apps/desktop/data/store/migration.test.ts` | desktop | retain | Migration compatibility |
| `apps/desktop/data/store/normalize.test.ts` | desktop | retain | Normalization helpers |
| `apps/desktop/data/store/shared.test.ts` | desktop | retain | Shared store helpers |
| `apps/desktop/engine/engine-ipc.integration.test.ts` | engine-ipc | retain | Process/IPC boundary |
| `apps/desktop/engine/engineService.test.ts` | desktop | retain | Service orchestration |
| `apps/desktop/engine/runtime.test.ts` | desktop | retain | Engine runtime helpers |
| `apps/desktop/files/fileService.test.ts` | desktop | strengthen | Confinement paths covered; expand symlink/junction in later passes |
| `apps/desktop/git/runtime.test.ts` | desktop | retain | Git runtime |
| `apps/desktop/git/service.test.ts` | desktop | retain | Git service (real CLI) |
| `apps/desktop/health/runtimeChecks.test.ts` | desktop | retain | Runtime health checks |
| `apps/desktop/health/systemChecks.test.ts` | desktop | consolidate | Drop temporary skipped placeholders when unimplemented checks stay out of product |
| `apps/desktop/native/nativeModules.test.ts` | desktop | retain | Functional SQLite; PTY presence/ABI note |
| `apps/desktop/projectIntelligence/healthInspector.test.ts` | desktop | retain | Project health inspector |
| `apps/desktop/projects/detectProjectType.test.ts` | desktop | retain | Project type detection |
| `apps/desktop/system/runner.test.ts` | desktop | retain | Command runner (primary lifecycle owner) |
| `apps/desktop/terminal/terminalManager.test.ts` | desktop | retain | Terminal manager unit paths |
| `apps/renderer/app/components/LlmContextExporter.test.tsx` | renderer | retain | LLM export UI |
| `apps/renderer/app/components/MarkdownPreview.test.tsx` | renderer | retain | Markdown preview |
| `apps/renderer/app/components/ProjectDetailTabs.test.tsx` | renderer | consolidate | Repetitive tab/copy assertions → keep high-signal cases; rest covered by section flows |
| `apps/renderer/app/components/ProjectEnginePanel.test.tsx` | renderer | replace | Prefer IPC-contract tests over mocked child labels; panel keeps prop-driven checks |
| `apps/renderer/app/components/ProjectGitSummary.test.tsx` | renderer | retain | Git summary |
| `apps/renderer/app/components/RunnableBlock.test.tsx` | renderer | strengthen | Wiring suite added (`RunnableBlock.wiring.test.tsx`) |
| `apps/renderer/app/lib/markdownUtils.test.tsx` | renderer | retain | Markdown utils / fence parsing |
| `apps/renderer/app/sections/AutomationSection.test.tsx` | renderer | retain | Automation section |
| `packages/engine/src/cli.test.ts` | engine | retain | CLI entry |
| `packages/engine/src/git.test.ts` | engine | retain | Git helpers |
| `packages/engine/src/index.test.ts` | engine | retain | Engine package surface |
| `packages/engine/src/utils.test.ts` | engine | retain | Utils |
| `packages/engine/rust` (`cargo test --locked`) | rust | strengthen | Semantic asserts preferred over success-only; existing tests already assert many outcomes |

## New tests added this initiative

| File | Suite | Owner ticket |
| --- | --- | --- |
| `apps/desktop/bugs/attachmentService.test.ts` | desktop | T3 confinement |
| `apps/desktop/data/store/export.import.test.ts` | desktop | T3 atomic import |
| `apps/desktop/ipc/ipc-contracts.test.ts` | desktop | T2 channel authority |
| `apps/desktop/ipc/trustedIpc.test.ts` | desktop | T2/T3 trusted sender |
| `apps/desktop/engine/binary.process.test.ts` | desktop | T4 process boundary |
| `apps/desktop/terminal/terminalManager.lifecycle.test.ts` | desktop | T5 lifecycle (output coalescing, exit cleanup, closeAll) |
| `packages/engine/src/index-identity.test.ts` | engine | T4 index identity |
| `packages/engine/src/search-regex.test.ts` | engine | T4 regex + argv bounding |
| `apps/renderer/app/lib/electronApiFake.test.ts` | renderer | T2 harness |
| `apps/renderer/app/App.bootstrap.test.tsx` | renderer | T6 bootstrap/events (mounts `App`) |
| `apps/renderer/app/components/RunnableBlock.wiring.test.tsx` | renderer | T6 runnable wiring |

## Meaningful production surfaces

Risk tiers: **critical** / **high** / **medium** / **low**.

| Surface | Path / owner | Risk | Coverage owner |
| --- | --- | --- | --- |
| IPC channel authority | `packages/ipc-contracts` | critical | `ipc-contracts.test.ts` |
| Trusted sender + openExternal | `trustedIpc.ts`, `registerIpc` shell handler | critical | `trustedIpc.test.ts`, URL unit via contracts |
| Window navigation lockdown | `createWindow.ts` | critical | code review + createWindow guards |
| SQLite store core + schema | `data/store/*` | critical | migration + domain tests + import tests |
| Export / import replace-merge | `export.ts` | critical | `export.import.test.ts` |
| Bug attachments confinement | `attachmentService.ts` | critical | `attachmentService.test.ts` |
| File service confinement | `fileService.ts` | critical | `fileService.test.ts` |
| Command runner / chains / triggers | `runner.ts`, automation store, IPC | critical | `runner.test.ts` |
| Terminal lifecycle | `terminalManager.ts` | critical | terminal unit + lifecycle dispose |
| Docker containers + log streams | `registerIpc` docker | high | package/manual; unit gaps remain |
| Git service | `git/*` | high | service + runtime tests |
| Engine service + child process | `engine/binary.ts` | critical | process test + engine-ipc integration |
| Engine index identity | `index-repository.ts` | critical | `index-identity.test.ts` |
| Engine regex search | `search.ts` + rust | critical | `search-regex.test.ts` + rust tests |
| Engine Rust scanner/search | `packages/engine/rust` | high | `cargo test --locked` |
| Native modules | better-sqlite3 / node-pty | critical | nativeModules + package verify functional sqlite |
| Tray / bootstrap / shutdown | `index.ts`, tray | medium | quit path closes terminals |
| LLM bundler privacy | `llm/bundler.ts` | high | renderer export tests |
| Renderer App orchestration | `App.tsx` | high | bootstrap contract tests (partial) |
| Commands / history / automation UI | sections | high | AutomationSection + fake harness |
| Terminal UI | `components/Terminal/*` | high | higher-level / manual residual |
| Containers UI | `ContainersSection.tsx` | medium | residual risk → manual/package |
| Projects UI | sections + panels | high | partial component tests |
| Import/export / bugs UI | dialogs | high | residual |
| Command palette | `CommandPalette*` | medium | residual |
| Markdown runnable fences | RunnableBlock, markdownUtils | high | unit + wiring |
| shadcn/ui primitives | `components/ui/*` | low | excluded from coverage; consumer-covered |
| Packaged app | verify-package | critical | actual-package smoke (engine + sqlite) |

## Critical defects

| Defect | Failing regression | Fix | Verification |
| --- | --- | --- | --- |
| Attachment path traversal on delete/resolve | `attachmentService.test.ts` | resolve under attachments root; reject `..`/absolute | `npm run test:run` |
| openExternal unsafe schemes | `ipc-contracts` URL tests | allowlist https + localhost http | unit + handler |
| Import replace partial success | `export.import.test.ts` | row/FK errors abort transaction | `npm run test:run` |
| Incremental index drop on rename/dup content | `index-identity.test.ts` | path-primary skip | `npm run test:engine` |
| Regex depends on FTS prefilter / silent invalid | `search-regex.test.ts` | all paths + TS validate | `npm run test:engine` |
| Engine hang / malformed JSON | `binary.process.test.ts` + `runEngineCommand` bounds | timeout, kill, parse guard | desktop tests |
| Regex path list overflows argv (E2BIG / Windows 32 KiB) | `search-regex.test.ts` argv bounding | batch `--files` per platform budget in `workers/client.ts` | `npm run test:engine` |

## Known follow-ups (recorded, not in this initiative)

| Item | Risk | Note |
| --- | --- | --- |
| `handleTrusted` wrapper not yet adopted by `registerIpc.ts` | high | Only `shell:open-external` asserts the trusted sender; migrating ~all channels is a separate pass. `getRegisteredIpcChannels()` therefore reports nothing in production. |
| `ipc-contracts.test.ts` is one-directional | medium | Asserts source ⊆ authority. Stale/extra authority entries cannot fail the suite yet. |
| `scanRepository` buffers stdout instead of streaming NDJSON | medium | Bounded at 32 MB; very large `--content` scans could now fail where streaming previously succeeded. |
| `scripts/gen-ipc-channels.mjs` derives contracts from `preload.ts`/`registerIpc.ts` | low | Bootstrap tool only; the contract package is now the hand-maintained authority. Re-running it would overwrite `isSafeExternalUrl`. |

## CI topology

| Lane | Matrix | Purpose |
| --- | --- | --- |
| Static and coverage | Ubuntu, Node 22 | typecheck, lint, architecture, V8 coverage + thresholds |
| Native and integration | Win+Ubuntu × Node 22+24 | desktop/renderer/engine/engine-ipc |
| Rust | Win+Ubuntu | `cargo test --locked` + `cargo build --release --locked` |
| Package verification | Win+Ubuntu, Node 22 | engine smoke + unpacked verify (sqlite functional) |
