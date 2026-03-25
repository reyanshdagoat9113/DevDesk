use clap::{Parser, Subcommand};

mod scanner;
mod search;
mod output;

/// DevDesk Scanner - Fast file scanning and search
#[derive(Parser)]
#[command(name = "devdesk-scan")]
#[command(about = "Fast file scanning and search for DevDesk", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scan a directory and output file metadata + content as JSON stream
    Scan {
        /// Path to scan
        #[arg(short, long)]
        path: String,

        /// Include hidden files
        #[arg(short = 'H', long)]
        hidden: bool,

        /// Maximum depth to traverse (0 = unlimited)
        #[arg(short = 'd', long, default_value = "0")]
        max_depth: usize,

        /// Include file content in output (for indexing)
        #[arg(short = 'c', long)]
        content: bool,
    },

    /// Search for a regex pattern in files
    Search {
        /// Regex pattern to search for
        #[arg(short, long)]
        pattern: String,

        /// File paths to search (comma-separated)
        #[arg(short, long)]
        files: String,

        /// Context lines before match
        #[arg(long, default_value = "2")]
        before: usize,

        /// Context lines after match
        #[arg(long, default_value = "2")]
        after: usize,
    },

    /// Hash a file's content
    Hash {
        /// Path to the file
        #[arg(short, long)]
        file: String,
    },
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Scan {
            path,
            hidden,
            max_depth,
            content,
        } => scanner::scan(&path, hidden, max_depth, content),

        Commands::Search {
            pattern,
            files,
            before,
            after,
        } => {
            let file_list: Vec<&str> = files.split(',').collect();
            search::search(&pattern, &file_list, before, after)
        }

        Commands::Hash { file } => scanner::hash_file(&file),
    };

    if let Err(e) = result {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
