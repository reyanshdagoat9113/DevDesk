use std::fs;
use std::io::{self, Write};
use std::path::Path;

use regex::Regex;
use serde::Serialize;

use crate::output;

#[derive(Serialize)]
pub struct MatchInfo {
    pub line: usize,
    pub column: usize,
    pub text: String,
    pub before: Vec<String>,
    pub after: Vec<String>,
}

#[derive(Serialize)]
pub struct FileResult {
    pub path: String,
    pub matches: Vec<MatchInfo>,
}

/// Search for a regex pattern in given files
pub fn search(
    pattern: &str,
    files: &[&str],
    context_before: usize,
    context_after: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    // Compile regex
    let re = match Regex::new(pattern) {
        Ok(r) => r,
        Err(e) => {
            output::print_error(&format!("Invalid regex: {}", e));
            return Err(format!("Invalid regex: {}", e).into());
        }
    };

    let stdout = io::stdout();
    let mut out = stdout.lock();

    let mut results: Vec<FileResult> = Vec::new();

    for file_path in files {
        let path = Path::new(file_path);

        if !path.exists() || !path.is_file() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(path) {
            let lines: Vec<&str> = content.lines().collect();
            let mut matches: Vec<MatchInfo> = Vec::new();

            for (idx, line) in lines.iter().enumerate() {
                if re.is_match(line) {
                    // Get context
                    let before: Vec<String> = (1..=context_before)
                        .rev()
                        .filter_map(|i| {
                            if idx >= i {
                                Some(lines[idx - i].to_string())
                            } else {
                                None
                            }
                        })
                        .collect();

                    let after: Vec<String> = (1..=context_after)
                        .filter_map(|i| {
                            if idx + i < lines.len() {
                                Some(lines[idx + i].to_string())
                            } else {
                                None
                            }
                        })
                        .collect();

                    // Find first match position
                    let column = re.find(line).map(|m| m.start() + 1).unwrap_or(1);

                    matches.push(MatchInfo {
                        line: idx + 1,
                        column,
                        text: line.to_string(),
                        before,
                        after,
                    });
                }
            }

            if !matches.is_empty() {
                results.push(FileResult {
                    path: file_path.to_string(),
                    matches,
                });
            }
        }
    }

    writeln!(out, "{}", serde_json::to_string(&results)?)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &TempDir, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.path().join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        let mut file = File::create(&path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
        path
    }

    #[test]
    fn test_search_simple_pattern() {
        let dir = TempDir::new().unwrap();

        create_test_file(
            &dir,
            "test.ts",
            "function hello() {\n  console.log('hello world');\n}",
        );

        let path = dir.path().join("test.ts").to_string_lossy().into_owned();
        let file_refs: Vec<&str> = vec![&path];

        // Test searching for "hello"
        let result = search("hello", &file_refs, 1, 1);
        assert!(result.is_ok());
    }

    #[test]
    fn test_search_regex_pattern() {
        let dir = TempDir::new().unwrap();

        create_test_file(
            &dir,
            "code.rs",
            "fn main() {}\nfn test() {}\nfn helper() {}",
        );

        let path = dir.path().join("code.rs").to_string_lossy().into_owned();
        let file_refs: Vec<&str> = vec![&path];

        // Test regex pattern: fn \w+\(\)
        let result = search(r"fn \w+\(\)", &file_refs, 0, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_search_invalid_regex() {
        let result = search(r"[invalid(", &["/some/file.txt"], 0, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_search_no_matches() {
        let dir = TempDir::new().unwrap();

        create_test_file(&dir, "empty.txt", "nothing to see here");

        let path = dir.path().join("empty.txt").to_string_lossy().into_owned();
        let file_refs: Vec<&str> = vec![&path];

        let result = search("nonexistent_pattern_xyz123", &file_refs, 0, 0);
        assert!(result.is_ok()); // No error, just no matches
    }

    #[test]
    fn test_search_multiple_files() {
        let dir = TempDir::new().unwrap();

        create_test_file(&dir, "a.ts", "const foo = 1;");
        create_test_file(&dir, "b.ts", "const bar = 2;");
        create_test_file(&dir, "c.ts", "const baz = 3;");

        let a = dir.path().join("a.ts").to_string_lossy().into_owned();
        let b = dir.path().join("b.ts").to_string_lossy().into_owned();
        let c = dir.path().join("c.ts").to_string_lossy().into_owned();

        let file_refs: Vec<&str> = vec![&a, &b, &c];

        let result = search("const", &file_refs, 0, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_search_nonexistent_file() {
        let result = search("pattern", &["/nonexistent/file.txt"], 0, 0);
        assert!(result.is_ok()); // Skips nonexistent files gracefully
    }
}
