# DevDesk Performance Engine - Architecture

> **Tech:** TypeScript + Rust + SQLite (better-sqlite3)
> **Role:** Fast local code intelligence for DevDesk

---

## Core Principle

**Default to TypeScript. Move to Rust only for CPU-heavy operations.**

TypeScript handles orchestration, business logic, and most operations. Rust is reserved exclusively for: directory scanning, file hashing, heavy regex search, and parsing large files.

---

## What Goes Where

**TypeScript (default):** App logic, database calls, filesystem operations, CLI spawning, API boundaries, config, fuzzy matching, result ranking.

**Rust (CPU-heavy only):** Recursive directory walks, Blake3 hashing, regex search on many files, watching large workspaces.

**Avoid using Rust for:** Docker commands, settings, general orchestration, fuzzy matching, result ranking, API boundaries, database queries.

---

## Engine Capabilities

The Engine exposes capabilities (not commands). All clients—CLI, DevDesk app, API server—call the same TypeScript Engine, which decides how to execute each request.

| Capability | Description |
|------------|-------------|
| `indexRepository()` | Scan, hash, detect language, store in SQLite |
| `search()` | FTS5 text search with optional regex refinement |
| `getFileIntelligence()` | Metadata, language, related files (deferred for the first public release) |
| `getStats()` | File counts, language breakdown |
| `getGitHotspots()` | Churn analysis, recent changes (v1.1) |
| `buildContextBundle()` | Top-N relevant files for LLM context (deferred for the first public release) |

---

## How Operations Flow

### Indexing

1. Generate scan ID (UUID)
2. Get or create repository record in SQLite
3. Call Rust scanner for directory walk + hashing
4. For each file: detect language (TS), check hash for changes, upsert to SQLite
5. Mark unseen files as deleted (soft delete via `is_deleted` flag)
6. Record scan results

### Search

1. **FTS5 phase:** SQLite full-text search for candidates with snippets
2. **Regex phase (if needed):** Rust worker refines with pattern matching
3. **Ranking phase:** TS scores by FTS rank, recency, language relevance

---

## Database Design

SQLite stores repositories, files, scan history, and git hotspots. FTS5 provides full-text search via a virtual table synced through triggers.

**Key tables:**
- `repositories` — tracked repos with scan metadata
- `files` — file records with path, hash, language, content, soft-delete flag
- `files_fts` — FTS5 virtual table for search
- `scans` — scan history for incremental indexing
- `git_hotspots` — churn data per file (v1.1)

**Incremental indexing keys:**
- `scan_id` — tracks which scan last saw a file
- `is_deleted` — soft delete for detecting removed files
- `relative_path` — portable paths that work if repo moves

---

## CLI Commands

```bash
# Index
engine index ./my-project              # Incremental index
engine index ./my-project --full       # Force full reindex

# Search
engine search "useEffect" ./my-project
engine search "TODO|FIXME" ./my-project --regex

# Stats
engine stats ./my-project
```

---

## Project Structure

```
devdesk-engine/
├── src/
│   ├── engine.ts              # Main Engine class
│   ├── capabilities/          # Capability implementations
│   │   ├── index.ts           # Capability registry
│   │   ├── index-repository.ts
│   │   ├── search.ts
│   │   ├── file-intelligence.ts
│   │   ├── stats.ts
│   │   ├── git-hotspots.ts
│   │   └── context-bundle.ts
│   ├── workers/               # Rust subprocess manager
│   │   ├── client.ts          # Spawns and talks to Rust
│   │   └── fallback.ts        # Pure TS fallbacks
│   ├── db/                    # SQLite connection, schema, queries
│   │   ├── schema.sql         # DDL for all tables
│   │   ├── migrations/        # Schema version migrations
│   │   └── queries.ts         # Prepared statements
│   ├── scoring/               # Ranking and fuzzy matching
│   │   ├── ranker.ts          # Result scoring
│   │   └── fuzzy.ts           # Fuzzy matching utilities
│   └── cli.ts                 # CLI entry point
├── rust/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs            # JSON CLI entry point
│       ├── scanner.rs         # File walking + hashing
│       └── search.rs          # Regex search
└── tests/
    ├── unit/                  # Unit tests per module
    └── integration/           # End-to-end capability tests
```

---

## Rust Worker Integration

**MVP:** Rust runs as a subprocess, communicates via JSON stdout. Simple, debuggable, works everywhere.

**Future (v1.5):** napi-rs native bindings if JSON parsing becomes a bottleneck. Profile first.

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| Index 10k files (full) | < 3s |
| Index 10k files (incremental) | < 500ms |
| FTS5 search | < 50ms |
| Regex search | < 200ms |
| Context bundle | < 100ms |
| Database size | 15-25% of repo |

---

## Key Design Decisions

- **TypeScript-first** — Rust only for proven CPU-heavy paths
- **Engine API** — CLI is just one client; the app is another
- **Capabilities, not modules** — expose what, not how
- **SQLite FTS5** — fast enough for text search, no external deps
- **Subprocess Rust (MVP)** — simple, debuggable, portable
- **FTS triggers** — automatic sync, no manual index management
- **Incremental-first schema** — `scan_id` and `is_deleted` enable clean incremental updates

---

## Roadmap

### v1.0 — Core Engine

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| **1. Engine Core** | Foundation | Engine class, SQLite schema, `indexRepository()` capability, language detection |
| **2. Search** | Querying | `search()` with FTS5, ranking layer, `getFileIntelligence()`, `getStats()` |
| **3. Rust Worker** | Performance | Scanner binary (walk + hash), regex search worker, TS client with JSON IPC |
| **4. CLI** | Interface | Refactor CLI to use Engine, all commands working, `--json` output |
| **5. Testing** | Quality | Unit tests (>80% coverage), integration tests, performance benchmarks |

### v1.1 — Git Insights

| Deliverable | Description |
|-------------|-------------|
| `getGitHotspots()` | Parse git log, identify high-churn files |
| Churn scoring | Integrate hotspot data into search ranking |
| `engine hotspots` | CLI command to display churn analysis |

### v1.2 — Context Bundling

Deferred for the first public release.

| Deliverable | Description |
|-------------|-------------|
| `buildContextBundle()` | Select top-N relevant files for LLM context |
| Token budgeting | Fit output within configurable token limits |
| Smart selection | Use search ranking + hotspots for relevance |
| `engine context` | CLI command to generate context bundles |

### v1.5 — Native Bindings (Optional)

| Deliverable | Description |
|-------------|-------------|
| napi-rs integration | Replace JSON subprocess with native bindings |
| Performance profile | Measure improvement, justify complexity |
| Fallback support | Keep subprocess path for debugging |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Index 10k files (cold) | < 3 seconds |
| Index 10k files (warm) | < 500ms |
| FTS5 search latency | < 50ms p99 |
| Regex search latency | < 200ms p99 |
| Memory footprint | < 100MB idle |
| Test coverage | > 80% |
| CLI startup | < 50ms |
