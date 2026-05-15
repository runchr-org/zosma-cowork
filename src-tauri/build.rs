fn main() {
    tauri_build::build();

    // Re-run build script if ../.env changes
    println!("cargo:rerun-if-changed=../.env");

    // Load APTABASE_KEY from ../.env so it's available at compile time
    // to option_env!("APTABASE_KEY") in lib.rs.
    //
    // The actual .env is gitignored — keys stay local.
    // In CI, set APTABASE_KEY directly as an environment variable
    // (takes precedence over .env).
    if std::env::var("APTABASE_KEY").is_err() {
        if let Ok(contents) = std::fs::read_to_string("../.env") {
            for line in contents.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim();
                    if key == "APTABASE_KEY" && !value.is_empty() {
                        println!("cargo:rustc-env=APTABASE_KEY={}", value);
                        break;
                    }
                }
            }
        }
    }

    // Warn if still not set (usage analytics will be disabled)
    if std::env::var("APTABASE_KEY").unwrap_or_default().is_empty() {
        println!("cargo:warning=APTABASE_KEY is not set. Usage analytics will be disabled.");
    }
}
