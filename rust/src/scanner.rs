use std::fs::{self, File};
use std::io::{self, BufReader, Read, Write};
use std::path::{Component, Path};
use std::time::UNIX_EPOCH;

use ignore::WalkBuilder;
use serde::Serialize;

const DEFAULT_EXCLUDED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "bower_components",
    "vendor",
    "dist",
    "build",
    "target",
    "coverage",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".yarn",
    ".pnpm-store",
];

#[derive(Serialize)]
pub struct FileInfo {
    pub path: String,
    pub filename: String,
    pub extension: Option<String>,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    pub content_hash: Option<String>,
    pub is_binary: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

/// Scan a directory and stream file info as JSON
pub fn scan(
    root_path: &str,
    include_hidden: bool,
    max_depth: usize,
    include_content: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new(root_path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path).into());
    }

    let stdout = io::stdout();
    let mut out = stdout.lock();

    // Build walker with .gitignore support
    let mut builder = WalkBuilder::new(path);
    builder
        .hidden(false)
        .git_ignore(false)
        .git_global(false)
        .git_exclude(false)
        .follow_links(false);

    if max_depth > 0 {
        builder.max_depth(Some(max_depth));
    }

    for entry in builder.build().filter_map(|e| e.ok()) {
        let file_path = entry.path();

        if should_skip_path(path, file_path, include_hidden) {
            continue;
        }

        match process_file(file_path, include_content) {
            Ok(info) => {
                // Output as JSON line
                writeln!(out, "{}", serde_json::to_string(&info)?)?;
            }
            Err(e) => {
                // Skip files we can't read, but continue
                eprintln!("Skip {}: {}", file_path.display(), e);
            }
        }
    }

    Ok(())
}

fn should_skip_path(root: &Path, candidate: &Path, include_hidden: bool) -> bool {
    if !candidate.is_file() {
        return true;
    }

    let relative = match candidate.strip_prefix(root) {
        Ok(relative) => relative,
        Err(_) => candidate,
    };

    for component in relative.components() {
        let Component::Normal(name) = component else {
            continue;
        };

        let name = name.to_string_lossy();

        if DEFAULT_EXCLUDED_DIRS.contains(&name.as_ref()) {
            return true;
        }

        if !include_hidden && name.starts_with('.') {
            return true;
        }
    }

    false
}

/// Process a single file
fn process_file(path: &Path, include_content: bool) -> Result<FileInfo, Box<dyn std::error::Error>> {
    let metadata = fs::metadata(path)?;
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase());

    let mtime_ms = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let size_bytes = metadata.len();

    // Check if binary (quick check on first 8KB)
    let is_binary = is_binary_file(path)?;

    // Skip hashing/content for binary files or very large files
    let (content_hash, content) = if is_binary || size_bytes > 5_000_000 {
        (None, None)
    } else {
        let bytes = fs::read(path)?;
        let hash = Some(blake3::hash(&bytes).to_hex().to_string());

        let content = if include_content {
            // Try to decode as UTF-8
            String::from_utf8(bytes).ok()
        } else {
            None
        };

        (hash, content)
    };

    Ok(FileInfo {
        path: path.to_string_lossy().to_string(),
        filename,
        extension,
        size_bytes,
        mtime_ms,
        content_hash,
        is_binary,
        content,
    })
}

/// Quick binary detection (check first 8KB for null bytes)
fn is_binary_file(path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
    // Fast path: check extension
    let binary_extensions = [
        "exe", "dll", "so", "dylib", "a", "o",
        "png", "jpg", "jpeg", "gif", "ico", "webp", "bmp",
        "mp3", "mp4", "wav", "avi", "mkv", "mov",
        "zip", "tar", "gz", "rar", "7z",
        "pdf", "doc", "docx", "xls", "xlsx",
        "sqlite", "db", "parquet",
    ];

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if binary_extensions.contains(&ext.to_lowercase().as_str()) {
            return Ok(true);
        }
    }

    // Check first 8KB for null bytes
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(8192, file);
    let mut buffer = [0u8; 8192];

    let n = reader.read(&mut buffer)?;
    if n == 0 {
        return Ok(false);
    }

    // Check for null bytes
    Ok(buffer[..n].contains(&0))
}

/// Check if a file is binary based on extension and content
pub fn check_is_binary(path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
    is_binary_file(path)
}

/// Hash a single file
pub fn hash_file(file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path).into());
    }

    let bytes = fs::read(path)?;
    let hash = blake3::hash(&bytes).to_hex().to_string();

    println!(
        "{}",
        serde_json::json!({
            "ok": true,
            "path": file_path,
            "hash": hash,
            "size": bytes.len()
        })
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &TempDir, name: &str, content: &[u8]) -> std::path::PathBuf {
        let path = dir.path().join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        let mut file = File::create(&path).unwrap();
        file.write_all(content).unwrap();
        path
    }

    #[test]
    fn test_detect_binary_by_extension() {
        let dir = TempDir::new().unwrap();

        // Create fake binary files with text content (extension-based detection)
        create_test_file(&dir, "test.exe", b"not really binary");
        create_test_file(&dir, "test.png", b"PNG fake");
        create_test_file(&dir, "test.zip", b"PK fake");

        assert!(check_is_binary(&dir.path().join("test.exe")).unwrap());
        assert!(check_is_binary(&dir.path().join("test.png")).unwrap());
        assert!(check_is_binary(&dir.path().join("test.zip")).unwrap());
    }

    #[test]
    fn test_detect_binary_by_content() {
        let dir = TempDir::new().unwrap();

        // Create file with null bytes (binary content)
        create_test_file(&dir, "test.bin", b"hello\x00world");

        // Create text file
        create_test_file(&dir, "test.txt", b"hello world");

        assert!(check_is_binary(&dir.path().join("test.bin")).unwrap());
        assert!(!check_is_binary(&dir.path().join("test.txt")).unwrap());
    }

    #[test]
    fn test_process_text_file() {
        let dir = TempDir::new().unwrap();
        let path = create_test_file(&dir, "test.ts", b"const x = 1;");

        let info = process_file(&path, true).unwrap();

        assert_eq!(info.filename, "test.ts");
        assert_eq!(info.extension, Some("ts".to_string()));
        assert!(!info.is_binary);
        assert!(info.content_hash.is_some());
        assert_eq!(info.content, Some("const x = 1;".to_string()));
    }

    #[test]
    fn test_process_file_without_content() {
        let dir = TempDir::new().unwrap();
        let path = create_test_file(&dir, "test.rs", b"fn main() {}");

        let info = process_file(&path, false).unwrap();

        assert_eq!(info.extension, Some("rs".to_string()));
        assert!(info.content_hash.is_some());
        assert!(info.content.is_none()); // Not included when include_content=false
    }

    #[test]
    fn test_scan_directory() {
        let dir = TempDir::new().unwrap();

        create_test_file(&dir, "src/main.rs", b"fn main() {}");
        create_test_file(&dir, "src/lib.rs", b"pub fn lib() {}");
        create_test_file(&dir, "README.md", b"# Test Project");

        // We can't easily test the stdout output, but we can verify no errors
        let result = scan(dir.path().to_str().unwrap(), false, 0, false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_should_skip_known_dependency_dirs() {
        let dir = TempDir::new().unwrap();
        let dep_file = create_test_file(&dir, "node_modules/pkg/index.js", b"export {}");
        let src_file = create_test_file(&dir, "src/index.ts", b"export const ok = true");

        assert!(should_skip_path(dir.path(), &dep_file, true));
        assert!(!should_skip_path(dir.path(), &src_file, true));
    }

    #[test]
    fn test_should_include_hidden_files_when_requested() {
        let dir = TempDir::new().unwrap();
        let hidden_file = create_test_file(&dir, ".env", b"TEST=true");
        let git_file = create_test_file(&dir, ".git/config", b"[core]");

        assert!(!should_skip_path(dir.path(), &hidden_file, true));
        assert!(should_skip_path(dir.path(), &git_file, true));
    }

    #[test]
    fn test_scan_nonexistent_path() {
        let result = scan("/nonexistent/path/12345", false, 0, false);
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_file() {
        let dir = TempDir::new().unwrap();
        let path = create_test_file(&dir, "hashme.txt", b"hello world");

        // hash_file prints to stdout, we just verify no error
        let path_str = path.to_str().unwrap();
        let result = hash_file(path_str);
        assert!(result.is_ok());
    }

    #[test]
    fn test_extension_extraction() {
        let dir = TempDir::new().unwrap();

        create_test_file(&dir, "code.ts", b"");
        create_test_file(&dir, "config.json", b"");
        create_test_file(&dir, "noext", b"");

        let info_ts = process_file(&dir.path().join("code.ts"), false).unwrap();
        let info_json = process_file(&dir.path().join("config.json"), false).unwrap();
        let info_noext = process_file(&dir.path().join("noext"), false).unwrap();

        assert_eq!(info_ts.extension, Some("ts".to_string()));
        assert_eq!(info_json.extension, Some("json".to_string()));
        assert_eq!(info_noext.extension, None);
    }
}
