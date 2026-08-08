// File info from Rust scanner
export interface FileInfo {
  path: string;
  filename: string;
  extension: string | null;
  size_bytes: number;
  mtime_ms: number;
  content_hash: string | null;
  is_binary: boolean;
  content?: string; // Only present when scanning with --content flag
}

/** Index scope profile — controls what is stored after scan. */
export type IndexProfile = 'source-first' | 'source-docs' | 'full-text';

export interface IndexSkipReasons {
  binary: number;
  language: number;
  profile: number;
  devdeskignore: number;
  unchanged: number;
}

export interface IndexMetrics {
  /** SUM(files.size_bytes) — logical indexed bytes */
  logicalIndexedBytes: number;
  /** SUM(LENGTH(content)) — searchable content payload */
  searchableContentBytes: number;
  /** On-disk SQLite file size (main db file) */
  physicalDbBytes: number;
}

// Index result
export interface IndexResult {
  ok: boolean;
  repo: string;
  db: string;
  filesIndexed: number;
  filesSkipped: number;
  durationMs: number;
  warnings: string[];
  /** Active profile for this run (when ok or partial). */
  profile?: IndexProfile;
  skipReasons?: IndexSkipReasons;
  metrics?: IndexMetrics;
}

// Search match from Rust
export interface RustMatchInfo {
  line: number;
  column: number;
  text: string;
  before: string[];
  after: string[];
}

// Search result from Rust
export interface RustFileResult {
  path: string;
  matches: RustMatchInfo[];
}

// Search match (final output)
export interface SearchMatch {
  line: number;
  column: number;
  snippet: string;
  contextBefore: string[];
  contextAfter: string[];
}

// File search result (final output)
export interface FileSearchResult {
  path: string;
  language: string | null;
  score: number;
  matches: SearchMatch[];
}

// Search result (final output)
export interface SearchResult {
  ok: boolean;
  query: string;
  results: FileSearchResult[];
  totalMatches: number;
  durationMs: number;
  error?: string;
}

export interface IndexLargestFile {
  path: string;
  sizeBytes: number;
  language: string | null;
}

// Stats result
export interface StatsResult {
  ok: boolean;
  db: string;
  stats: {
    totalFiles: number;
    /** Logical indexed bytes: SUM(size_bytes) */
    totalSizeBytes: number;
    /** Searchable content bytes: SUM(LENGTH(content)) */
    searchableContentBytes: number;
    /** Physical SQLite database file size */
    physicalDbBytes: number;
    byLanguage: Record<string, number>;
    indexedAt: string;
    largestFiles: IndexLargestFile[];
  };
}

export interface RepositoryRecord {
  id: number;
  path: string;
  isGit: boolean;
  branch: string | null;
  totalCommits: number;
  contributors: string[];
  lastIndexedAt: number | null;
}

export interface GitHotspotRecord {
  id: number;
  repositoryPath: string;
  path: string;
  score: number;
  commits: number;
  recency: number;
  risk: 'low' | 'medium' | 'high';
  updatedAt: number;
}

// Error output
export interface ErrorOutput {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// CLI options
export interface IndexOptions {
  repo: string;
  db?: string;
  incremental?: boolean;
  /**
   * Index scope profile. Default: source-first.
   * - source-first: code/config; drops planning HTML, landing, pure docs languages
   * - source-docs: source + documentation; still drops landing/build artifacts
   * - full-text: all indexable text (plus optional .devdeskignore)
   */
  profile?: IndexProfile;
}

export interface SearchOptions {
  db: string;
  query: string;
  regex?: boolean;
  limit?: number;
}

export interface StatsOptions {
  db: string;
}

export interface GitInsightsOptions {
  limit?: number;
}

// Database record
export interface FileRecord {
  id: number;
  path: string;
  filename: string;
  extension: string | null;
  size_bytes: number;
  mtime_ms: number;
  content_hash: string | null;
  language: string | null;
  is_binary: number;
  indexed_at: number;
  content?: string;
}

// Ranked search result with score
export interface RankedFileResult extends FileRecord {
  score: number;
}
