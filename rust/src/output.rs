use std::io::{self, Write};

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(serde::Serialize)]
struct ErrorOutput {
    ok: bool,
    error: String,
}

pub fn print_error(message: &str) {
    let output = ErrorOutput {
        ok: false,
        error: message.to_string(),
    };

    let stdout = io::stdout();
    let mut lock = stdout.lock();

    if let Ok(json) = serde_json::to_string(&output) {
        let _ = writeln!(lock, "{}", json);
    }
}
