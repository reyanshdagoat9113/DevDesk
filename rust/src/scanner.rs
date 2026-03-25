use std::fs::{self, File};
use std::io::{self, BufReader, Read, Write};
use std::path::Path;
use std::time::UNIX_EPOCH;

use ignore::WalkBuilder;
use serde::Serialize;

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
        .hidden(!include_hidden)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .follow_links(false);

    if max_depth > 0 {
        builder.max_depth(Some(max_depth));
    }

    for entry in builder.build().filter_map(|e| e.ok()) {
        let file_path = entry.path();

        // Skip directories
        if !file_path.is_file() {
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
