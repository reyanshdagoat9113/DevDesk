# DevDesk Performance Engine — architecture

**Tech:** TypeScript + SQLite (`better-sqlite3`) + optional Rust scanner  
**Role:** Fast local code intelligence for DevDesk

Desktop integration and path usage: [../../docs/architecture.md](../../docs/architecture.md).

## Principle

**Default to TypeScript. Use Rust only for CPU-heavy work.**

| Layer | Does |
|-------|------|
| TypeScript | Orchestration, SQLite, language detect, ranking, CLI, Git insights |
| Rust subprocess | Recursive walk, Blake3 hashing, heavy regex over many files |
| Avoid in Rust | Docker, settings, fuzzy ranking, DB queries, Electron IPC |

If the Rust binary is missing, TypeScript fallbacks still run (slower).

## Capabilities

Clients (CLI and the desktop app) call the same `Engine` class.

| Capability | Description |
|------------|-------------|
| `indexRepository()` | Scan, hash, detect language, store in SQLite (incremental unless `--full`) |
| `search()` | FTS5 candidates, optional regex refine, TS ranking |
| `getStats()` | File counts and language breakdown |
| `getGitInsights()` | Churn / hotspots from local Git |

Not in the 0.1 engine surface: file-intelligence graph and LLM context assembly (the **app** has its own `llm` bundler).

## Indexing flow

1. Open or create the per-repo SQLite file
2. Walk + hash (Rust when available)
3. For each file: language detect (TS), skip unchanged hashes, upsert content
4. Soft-delete files not seen in this scan (`is_deleted`)
5. Record scan metadata

Ignore: `.gitignore`, default build dirs (`node_modules`, `dist`, …), optional `.devdeskignore`, and the selected **profile** (`source-first` / `source-docs` / `full-text`). Policy: `src/index-policy.ts`.

## Search flow

1. **FTS5** — SQLite full-text with snippets
2. **Regex** — Rust worker when `--regex` / `regex: true`
3. **Rank** — FTS score, recency, language

## Database

Each indexed project has its own SQLite file (in the app: `userData/engine/<projectId>.sqlite`).

Typical tables: `repositories`, `files`, `files_fts` (FTS5 + triggers), `scans`, Git hotspot storage.

Incremental keys: `scan_id`, `is_deleted`, portable `relative_path`.

## Path contract

Engine JSON uses a stable form so Electron IPC does not branch on OS separators.

| Context | Form | Helper |
|---------|------|--------|
| API / stored absolute paths | Absolute, **forward slashes** (`C:/Users/proj`) | `normalizePath()` |
| Search hits through DevDesk IPC | **Project-relative** with `/` | desktop `normalizeSearchResultPaths` |
| Filesystem / Rust I/O | Native separators | `toNativePath()` / Node `path` |

Rules:

1. Do not return Windows backslashes from engine capability results.
2. Callers that open files convert with `toNativePath` (Node `path` accepts `/` on Windows).
3. DevDesk persists `dbPath` from the engine result as-is.

## Layout (`packages/engine`)

```text
src/
  engine.ts              Engine class
  cli.ts                 commander CLI (JSON stdout)
  capabilities/          index, search, stats, git-insights
  workers/client.ts      Rust subprocess
  db/                    SQLite schema + queries
  index-policy.ts        profiles and ignore rules
  git.ts                 Git insights helpers
rust/                    scanner + regex worker (JSON CLI)
```

Packaging copies `dist/` (JS + Rust binary) into the Electron `resources/engine/` tree. See root `package.json` `build.extraResources`.
