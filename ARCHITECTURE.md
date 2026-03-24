# DevDesk Performance Engine - Architecture

> **Tech:** TypeScript + Rust + SQLite (better-sqlite3)
> **Role:** Fast local code intelligence for DevDesk

---

## Core Abstraction: Engine Capabilities

The Performance Engine exposes **capabilities**, not commands. The CLI is just one client.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                   │
│   │   CLI    │   │  DevDesk │   │   API    │                   │
│   │          │   │   App    │   │  Server  │                   │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘                   │
└────────┼──────────────┼──────────────┼──────────────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Engine API (TypeScript)                      │
│                                                                  │
│   engine.indexRepository(options) → IndexResult                  │
│   engine.search(query, options) → SearchResult                   │
│   engine.getFileIntelligence(path) → FileIntel                   │
│   engine.getStats() → StatsResult                                │
│   engine.getGitHotspots(options) → HotspotResult                 │
│   engine.buildContextBundle(query, budget) → ContextBundle       │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   SQLite FTS5   │   │  Rust Worker    │   │   TS Modules    │
│   (better-      │   │  (subprocess    │   │   (pure TS)     │
│   sqlite3)      │   │   or native)    │   │                 │
│                 │   │                 │   │                 │
│ • Full-text     │   │ • File walking  │   │ • Fuzzy rank    │
│ • Snippets      │   │ • Hashing       │   │ • Language det  │
│ • Metadata      │   │ • Regex search  │   │ • Scoring       │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Capabilities

| Capability | Method | Description |
|------------|--------|-------------|
| **Repository Indexing** | `indexRepository()` | Scan, hash, detect language, store in SQLite |
| **Code Search** | `search()` | FTS5 + optional regex refinement |
| **File Intelligence** | `getFileIntelligence()` | Metadata, language, related files |
| **Repo Analytics** | `getStats()` | File counts, language breakdown |
| **Git Insights** | `getGitHotspots()` | Churn, recent changes, risk areas |
| **Context Bundling** | `buildContextBundle()` | Top-N relevant files for LLM context |

---

## Engine API Design

```typescript
interface Engine {
  // Repository Indexing
  indexRepository(options: IndexOptions): Promise<IndexResult>;

  // Code Search
  search(query: string, options?: SearchOptions): Promise<SearchResult>;

  // File Intelligence
  getFileIntelligence(path: string): Promise<FileIntelligence>;

  // Repo Analytics
  getStats(): StatsResult;

  // Git Insights (v1.1)
  getGitHotspots(options?: GitOptions): Promise<HotspotResult>;

  // Context Bundling (v1.2)
  buildContextBundle(query: string, budget: TokenBudget): Promise<ContextBundle>;
}
```

### Usage Examples

```typescript
// Create engine instance
const engine = new PerformanceEngine({ dbPath: './myapp.sqlite' });

// Index a repository
await engine.indexRepository({
  repoPath: '../my-project',
  incremental: true,
});

// Search
const results = await engine.search('useEffect', {
  mode: 'fts',           // 'fts' | 'regex' | 'hybrid'
  limit: 50,
  includeSnippets: true,
});

// Get file intelligence
const intel = await engine.getFileIntelligence('src/components/UserList.tsx');
// → { language: 'typescript', size: 1234, lastModified: '...', relatedFiles: [...] }

// Build context for LLM
const context = await engine.buildContextBundle('authentication flow', {
  maxTokens: 8000,
  includeGitContext: true,
});
```

---

## Internal Architecture

### Engine Boundary

The Engine class owns all decisions about *how* to execute operations:

```
Engine.indexRepository()
    │
    ├─► Should I use Rust or pure TS?
    │   └─► MVP: always Rust for scanning
    │   └─► v2: native binding if available
    │
    ├─► How do I detect language?
    │   └─► Pure TS (lang.ts)
    │
    └─► How do I store?
        └─► SQLite via better-sqlite3
```

```
Engine.search(query)
    │
    ├─► Is it a simple term?
    │   └─► SQLite FTS5 (with snippets from SQLite)
    │
    ├─► Is it a regex?
    │   └─► FTS5 for candidates → Rust for regex matching
    │
    └─► Need fuzzy ranking?
        └─► TS scoring layer (not Rust)
```

### Rust Worker Evolution Path

| Phase | Model | Trade-off |
|-------|-------|-----------|
| **MVP** | Subprocess + JSON stdout | Simple, debuggable, works everywhere |
| **v1.5** | napi-rs native binding | Faster IPC, no parse overhead, but build complexity |
| **v2** | Optional local daemon | For very hot paths, shared state |

**Decision point:** Move to native bindings only when JSON parsing becomes measurable bottleneck (profile first).

### Search Ownership

| Search Type | Owner | Why |
|-------------|-------|-----|
| Exact term | SQLite FTS5 | Built-in, fast enough |
| Snippets (simple) | SQLite FTS5 | `snippet()` function |
| Regex patterns | Rust | `regex` crate outperforms JS |
| Fuzzy matching | TypeScript | Simple scoring, no perf issue |
| Result ranking | TypeScript | Flexible, domain-specific |

---

## Database Schema

```sql
-- Schema version
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER
);

-- Repositories tracked
CREATE TABLE repositories (
    id INTEGER PRIMARY KEY,
    root_path TEXT NOT NULL UNIQUE,
    last_scan_id TEXT,
    last_scan_at INTEGER,
    scan_version INTEGER DEFAULT 1
);

-- Files
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    repo_id INTEGER NOT NULL,
    repo_root TEXT NOT NULL,
    path TEXT NOT NULL,              -- Absolute path
    relative_path TEXT NOT NULL,     -- Path relative to repo root
    filename TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER,
    mtime_ms INTEGER,
    content_hash TEXT,
    language TEXT,
    is_binary INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,    -- Soft delete for incremental
    scan_id TEXT,                    -- Which scan last saw this file
    indexed_at INTEGER,
    content TEXT,

    FOREIGN KEY (repo_id) REFERENCES repositories(id),
    UNIQUE(repo_id, relative_path)
);

-- Indexes
CREATE INDEX idx_files_repo ON files(repo_id);
CREATE INDEX idx_files_relative ON files(repo_id, relative_path);
CREATE INDEX idx_files_language ON files(language);
CREATE INDEX idx_files_hash ON files(content_hash);
CREATE INDEX idx_files_deleted ON files(is_deleted);

-- FTS5 virtual table (external content mode)
CREATE VIRTUAL TABLE files_fts USING fts5(
    relative_path,
    filename,
    language,
    content,
    content='files',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(rowid, relative_path, filename, language, content)
    VALUES (new.id, new.relative_path, new.filename, new.language, new.content);
END;

CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, relative_path, filename, language, content)
    VALUES ('delete', old.id, old.relative_path, old.filename, old.language, old.content);
END;

CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, relative_path, filename, language, content)
    VALUES ('delete', old.id, old.relative_path, old.filename, old.language, old.content);
    INSERT INTO files_fts(rowid, relative_path, filename, language, content)
    VALUES (new.id, new.relative_path, new.filename, new.language, new.content);
END;

-- Scan history (for incremental indexing)
CREATE TABLE scans (
    id TEXT PRIMARY KEY,             -- UUID
    repo_id INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    files_scanned INTEGER,
    files_added INTEGER,
    files_updated INTEGER,
    files_deleted INTEGER,
    status TEXT,                     -- 'running' | 'completed' | 'failed'

    FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Git hotspots (v1.1)
CREATE TABLE git_hotspots (
    id INTEGER PRIMARY KEY,
    repo_id INTEGER NOT NULL,
    relative_path TEXT NOT NULL,
    commit_count INTEGER,
    recent_commits INTEGER,
    churn_score REAL,
    last_commit_at TEXT,
    contributors TEXT,               -- JSON array of contributor counts

    FOREIGN KEY (repo_id) REFERENCES repositories(id),
    UNIQUE(repo_id, relative_path)
);
```

### Why This Schema

| Column | Purpose |
|--------|---------|
| `repo_root` | Support multiple repos in one DB |
| `relative_path` | Portable, works if repo moves |
| `scan_id` | Track which scan last saw file |
| `is_deleted` | Soft delete, enables "file was removed" detection |
| `scan_version` | Schema migrations without full reindex |

### FTS5 Sync Strategy

The triggers handle INSERT/UPDATE/DELETE automatically. For incremental scans:

1. Mark files as `is_deleted = 1` where `scan_id != current_scan_id`
2. FTS trigger handles the delete from index
3. Hard delete can run in cleanup phase

---

## Data Flows

### Index Flow (Incremental)

```
Engine.indexRepository({ repoPath, incremental: true })
    │
    ├─► Generate scan_id (UUID)
    │
    ├─► Get/Create repository record
    │   └─► SELECT/INSERT FROM repositories
    │
    ├─► Rust: scan directory
    │   └─► devdesk-scan scan --path <repo> --content
    │   └─► Stream: { path, hash, mtime, content, ... }
    │
    ├─► For each file from Rust:
    │   ├─► Detect language (TS: lang.ts)
    │   ├─► Check if exists with same hash
    │   │   └─► Skip if unchanged
    │   ├─► UPSERT with current scan_id
    │   └─► FTS trigger handles index update
    │
    ├─► Mark unseen files as deleted
    │   └─► UPDATE files SET is_deleted=1 WHERE scan_id != <current>
    │
    ├─► Record scan results
    │   └─► INSERT INTO scans (...)
    │
    └─► Return IndexResult
```

### Search Flow (Hybrid)

```
Engine.search(query, { mode: 'hybrid' })
    │
    ├─► Phase 1: FTS5 candidates
    │   └─► SELECT ... FROM files_fts WHERE files_fts MATCH ?
    │   └─► SQLite provides snippets via snippet() function
    │
    ├─► Phase 2: Regex refinement (if regex detected)
    │   └─► Rust: devdesk-scan search --pattern <regex> --files <paths>
    │   └─► Rust returns matches with context
    │
    ├─► Phase 3: Ranking (TS)
    │   └─► Score by: FTS rank, file recency, language relevance
    │   └─► Fuzzy match scoring if requested
    │
    └─► Return SearchResult with ranked matches
```

---

## Project Structure

```
devdesk-engine/
├── src/
│   ├── engine.ts              # Engine class - main API
│   ├── capabilities/          # Capability implementations
│   │   ├── index.ts           # indexRepository()
│   │   ├── search.ts          # search()
│   │   ├── stats.ts           # getStats()
│   │   ├── intelligence.ts    # getFileIntelligence()
│   │   ├── git.ts             # getGitHotspots() (v1.1)
│   │   └── context.ts         # buildContextBundle() (v1.2)
│   ├── workers/               # Worker interfaces
│   │   ├── rust-worker.ts     # Rust subprocess manager
│   │   └── rust-native.ts     # Future: napi-rs binding
│   ├── db/
│   │   ├── connection.ts      # SQLite connection
│   │   ├── schema.ts          # Schema migrations
│   │   └── queries.ts         # Prepared statements
│   ├── scoring/
│   │   ├── ranker.ts          # Result ranking
│   │   └── fuzzy.ts           # Fuzzy matching
│   ├── lang.ts                # Language detection
│   ├── types.ts               # Interfaces
│   └── cli.ts                 # CLI (just calls Engine)
├── rust/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs            # CLI entry
│       ├── scanner.rs         # File walking + hashing
│       └── search.rs          # Regex search
└── tests/
```

---

## JSON Output Formats

### IndexResult

```json
{
  "ok": true,
  "repository": {
    "root": "C:/projects/myapp",
    "id": 1
  },
  "scan": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "durationMs": 2341
  },
  "files": {
    "scanned": 1234,
    "added": 45,
    "updated": 12,
    "deleted": 3,
    "skipped": 1174
  }
}
```

### SearchResult

```json
{
  "ok": true,
  "query": {
    "text": "useEffect",
    "mode": "hybrid"
  },
  "results": [
    {
      "path": "src/components/UserList.tsx",
      "relativePath": "components/UserList.tsx",
      "language": "typescript",
      "score": 0.95,
      "matches": [
        {
          "line": 42,
          "column": 3,
          "snippet": "  useEffect(() => {",
          "contextBefore": ["const UserList = () => {"],
          "contextAfter": ["    fetchUsers();", "  }, []);"]
        }
      ]
    }
  ],
  "pagination": {
    "total": 15,
    "offset": 0,
    "limit": 50
  },
  "durationMs": 23
}
```

### ContextBundle (v1.2)

```json
{
  "ok": true,
  "query": "authentication flow",
  "budget": {
    "maxTokens": 8000,
    "usedTokens": 6234
  },
  "files": [
    {
      "path": "src/auth/login.ts",
      "relevanceScore": 0.92,
      "tokens": 1234,
      "content": "// ... file content ..."
    }
  ],
  "metadata": {
    "includedGitContext": true,
    "hotspotBoost": ["src/auth/", "src/middleware/auth.ts"]
  }
}
```

---

## Dependencies

### TypeScript

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0"
  }
}
```

### Rust

```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
walkdir = "2"
ignore = "0.4"
blake3 = "1"
regex = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
```

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Index 10k files (full) | < 3s | Cold start |
| Index 10k files (incremental) | < 500ms | < 5% changed |
| FTS5 search | < 50ms | Exact term |
| Regex search | < 200ms | Depends on candidates |
| Context bundle | < 100ms | Token-aware selection |
| Database size | ~15-25% | Of repo size |

---

<!--
  ════════════════════════════════════════════════════════════════════════════
  TODO / ROADMAP
  ════════════════════════════════════════════════════════════════════════════
-->

## TODO / Roadmap

### Phase 1: Engine Core

- [ ] **P1-001**: Create Engine class (`engine.ts`)
  - [ ] Define Engine interface
  - [ ] Implement constructor with config
  - [ ] Add connection management

- [ ] **P1-002**: Implement database layer (`db/`)
  - [ ] Connection management
  - [ ] Schema migrations
  - [ ] Repository CRUD
  - [ ] File CRUD with FTS triggers
  - [ ] Scan history tracking

- [ ] **P1-003**: Implement `indexRepository()` capability
  - [ ] Scan ID generation
  - [ ] Rust worker invocation
  - [ ] Language detection integration
  - [ ] Incremental logic (hash compare, mark deleted)
  - [ ] Scan record creation

### Phase 2: Search Capabilities

- [ ] **P2-001**: Implement `search()` capability
  - [ ] FTS5 query builder
  - [ ] Snippet extraction from SQLite
  - [ ] Regex mode (Rust worker)
  - [ ] Hybrid mode orchestration

- [ ] **P2-002**: Implement ranking layer (`scoring/`)
  - [ ] Base ranker (FTS score)
  - [ ] Fuzzy matcher
  - [ ] Recency boost
  - [ ] Language relevance

- [ ] **P2-003**: Implement `getFileIntelligence()`
  - [ ] File metadata lookup
  - [ ] Related files (imports, same directory)
  - [ ] Git context (if available)

### Phase 3: Rust Worker

- [ ] **P3-001**: Rust scanner
  - [ ] Directory walking with ignore
  - [ ] Blake3 hashing
  - [ ] Content reading
  - [ ] JSON streaming

- [ ] **P3-002**: Rust regex search
  - [ ] Pattern compilation
  - [ ] Context extraction
  - [ ] JSON output

- [ ] **P3-003**: TypeScript worker client (`workers/rust-worker.ts`)
  - [ ] Subprocess spawning
  - [ ] Stream parsing
  - [ ] Error handling
  - [ ] Timeout management

### Phase 4: CLI Integration

- [ ] **P4-001**: Refactor CLI to use Engine
  - [ ] CLI just parses args, calls Engine
  - [ ] Consistent JSON output
  - [ ] Error formatting

- [ ] **P4-002**: Add Engine lifecycle to CLI
  - [ ] Initialize on command
  - [ ] Graceful shutdown

### Phase 5: Testing & Polish

- [ ] **P5-001**: Unit tests
  - [ ] Engine methods
  - [ ] Database layer
  - [ ] Scoring functions
  - [ ] Language detection

- [ ] **P5-002**: Integration tests
  - [ ] Full index → search flow
  - [ ] Incremental indexing
  - [ ] Edge cases

- [ ] **P5-003**: Performance validation
  - [ ] Benchmark against targets
  - [ ] Profile hot paths
  - [ ] Memory usage

### Phase 6: Git Insights (v1.1)

- [ ] **P6-001**: Add git2 to Rust
- [ ] **P6-002**: Implement `getGitHotspots()`
- [ ] **P6-003**: Populate git_hotspots table
- [ ] **P6-004**: Integrate hotspots into search ranking

### Phase 7: Context Bundling (v1.2)

- [ ] **P7-001**: Implement `buildContextBundle()`
- [ ] **P7-002**: Token budget management
- [ ] **P7-003**: Relevance + hotspot selection
- [ ] **P7-004**: Output formatting for LLMs

### Phase 8: Native Bindings (v1.5)

- [ ] **P8-001**: Evaluate napi-rs vs neon
- [ ] **P8-002**: Implement native binding for hot paths
- [ ] **P8-003**: Fallback to subprocess if native fails

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Engine API over commands** | CLI is one client; DevDesk app, agents are others |
| **Capabilities, not modules** | `search()` not `search.ts` - the what, not the how |
| **Rust via subprocess (MVP)** | Simple, debuggable, works everywhere |
| **FTS5 for exact search** | SQLite is fast enough, no need for Rust |
| **TS for fuzzy/ranking** | Flexible, no measurable perf difference |
| **Schema for incremental** | `scan_id`, `is_deleted` make incremental clean |
| **FTS triggers** | Automatic sync, no manual index management |
| **Native binding later** | Only when JSON parsing is proven bottleneck |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad |
|--------------|---------|
| Engine methods that know about CLI | Ties engine to one interface |
| Rust for everything | Over-engineering, harder to iterate |
| Manual FTS sync | Bugs, drift, missing deletes |
| No scan tracking | Can't do reliable incremental |
| Fuzzy in Rust | Premature optimization |
| Single repo per DB | Doesn't scale for DevDesk managing many repos |
