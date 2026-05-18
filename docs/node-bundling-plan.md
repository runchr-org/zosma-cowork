# Plan: Bundle Node.js with Zosma Cowork

## Problem

Non-technical users cannot use Zosma Cowork because it requires Node.js to be pre-installed. Previously:

1. **Sidecar runtime**: `find_node()` searched common paths, fell back to PATH — failed if no Node.js
2. **Skill install/remove**: Used `execFileSync("npx", ...)` inside sidecar — needed npx (ships with Node)
3. **Extensions using npm packages**: Any extension running npm-based commands also needs Node.js

## Decisions Made

1. **Target-specific bundles** — each build carries only its own platform's Node.js (~30-50MB, not 150MB)
2. **Move skill install/remove to Rust** — no npx needed, validates SKILL.md before install (fixes "appears in search but fails" bug)
3. **Node.js v24.x LTS** (v24.15.0 as of May 2026, supported through 2028)
4. **macOS universal build** — bundles BOTH arm64 and x64 Node.js binaries; Rust picks the right one at runtime

## Status: ✅ IMPLEMENTED

All steps completed. Changes compile cleanly (`cargo check` + `tsc --noEmit` pass).

## Implementation Summary

### Files Changed

| File | Change |
|------|--------|
| `src-tauri/scripts/fetch-node.mjs` | **NEW** — downloads Node.js binary during build; handles all platforms including macOS universal |
| `src-tauri/tauri.conf.json` | Added `binaries/node`, `node-arm64`, `node-x64` to resources; added fetch-node to beforeBuildCommand |
| `src-tauri/src/lib.rs` | Rewrote `find_node()` to check bundled Node (with arch detection for macOS universal); implemented `install_skill` and `remove_skill` directly in Rust using git2 |
| `agent-sidecar/src/index.ts` | Removed `install_skill`/`remove_skill` handlers and interfaces — moved to Rust |
| `src-tauri/Cargo.toml` | Added `git2`, `walkdir`, `dir-diff` dependencies |
| `.github/workflows/release.yml` | Added "Fetch bundled Node.js" step before frontend build |
| `src-tauri/binaries/` | Created with placeholder stubs for dev builds (actual binary fetched during production build) |
| `src-tauri/.gitignore` | Exclude `binaries/node` from git (fetched during build) |

### Architecture

```
┌─────────────────────────────────────────────┐
│  Tauri App Bundle                           │
│                                             │
│  ┌──────────────────┐  ┌─────────────────┐ │
│  │  Rust Binary     │  │  Resources      │ │
│  │                  │  │                 │ │
│  │  - find_node()   │  │  binaries/node  │ │
│  │    checks:       │  │  binaries/      │ │
│  │    1. Bundled    │  │    node-arm64   │ │
│  │    2. System     │  │  binaries/      │ │
│  │       paths      │  │    node-x64     │ │
│  │    3. PATH       │  │                 │ │
│  │                  │  │  agent-sidecar/ │ │
│  │  - install_skill │  │    index.cjs    │ │
│  │    (git2 clone   │  │                 │ │
│  │     + copy)      │  └─────────────────┘ │
│  │                  │                      │
│  │  - remove_skill  │                      │
│  │    (rm -rf)      │                      │
│  └──────────────────┘                      │
└─────────────────────────────────────────────┘
```

### Platform Strategy

| Build | Output | Bundled Node | Size Impact |
|-------|--------|--------------|-------------|
| macOS universal | `.dmg` / `.app` | `node-arm64` + `node-x64` | +60MB |
| Linux x64 | `.AppImage` / `.deb` | `node-linux-x64` | +30MB |
| Windows x64 | `.exe` / `.msi` | `node-windows-x64.exe` | +50MB |

### Rust Skill Install Flow

1. Parse source string (`github/owner/repo` or `https://...`) into git URL + optional sub-path
2. Clone repo using `git2::Repository::clone()` (blocking, run on threadpool)
3. Walk directory tree to find `SKILL.md` files
4. Validate each SKILL.md has `name` and `description` in YAML frontmatter
5. Copy skill directories to `~/.pi/agent/skills/{skill-name}/`
6. Return list of installed skills

### Rust Skill Remove Flow

1. Look up skill directory at `~/.pi/agent/skills/{skill-name}/`
2. Delete directory recursively
3. Return success or error

### macOS Universal Build

The fetch script downloads BOTH arm64 and x64 Node.js binaries. At runtime, the Rust code:
1. Runs `uname -m` to detect current architecture
2. Selects `node-arm64` on Apple Silicon, `node-x64` on Intel
3. Falls back to generic `node` if arch-specific binary is missing

## Future Work

- [ ] Add skill search validation so repos without valid SKILL.md don't appear in results
- [ ] Consider bundling other CLI tools (git, curl) for Windows where they may be missing
- [ ] Add post-install verification: check that bundled Node.js runs correctly
- [ ] Update Node.js version periodically as new LTS releases arrive
