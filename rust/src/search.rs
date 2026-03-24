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
