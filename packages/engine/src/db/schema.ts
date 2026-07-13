export const SCHEMA_VERSION = 2;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER,
    mtime_ms INTEGER,
    content_hash TEXT,
    language TEXT,
    is_binary INTEGER DEFAULT 0,
    indexed_at INTEGER,
    content TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    path,
    filename,
    language,
    content,
    content='files',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(rowid, path, filename, language, content)
    VALUES (new.id, new.path, new.filename, new.language, new.content);
END;

CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, path, filename, language, content)
    VALUES ('delete', old.id, old.path, old.filename, old.language, old.content);
END;

CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, path, filename, language, content)
    VALUES ('delete', old.id, old.path, old.filename, old.language, old.content);
    INSERT INTO files_fts(rowid, path, filename, language, content)
    VALUES (new.id, new.path, new.filename, new.language, new.content);
END;

CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    is_git INTEGER DEFAULT 0,
    branch TEXT,
    total_commits INTEGER DEFAULT 0,
    contributors_json TEXT,
    last_indexed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_repositories_path ON repositories(path);

CREATE TABLE IF NOT EXISTS git_hotspots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_path TEXT NOT NULL,
    path TEXT NOT NULL,
    score REAL NOT NULL,
    commits INTEGER NOT NULL,
    recency INTEGER NOT NULL,
    risk TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(repository_path, path)
);

CREATE INDEX IF NOT EXISTS idx_git_hotspots_repo_path ON git_hotspots(repository_path, path);
CREATE INDEX IF NOT EXISTS idx_git_hotspots_score ON git_hotspots(score);

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
`;
