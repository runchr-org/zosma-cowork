# Zosma Cowork — Extensions Tab Design

> **Status:** Proposal  
> **Date:** 2026-05-12  
> **Goal:** Add an "Extensions" tab to Zosma Cowork's sidebar that lets users install, manage, and configure extensions. The design must survive a future engine swap from pi to dhara.

---

## 1. Current State

### 1.1 Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React Frontend (Tauri WebView)                          │
│  ├── Sidebar (Chats / Settings tabs)                     │
│  ├── ChatView (messages + tool timeline)                 │
│  └── HomeView (onboarding / API key entry)               │
├──────────────────────────────────────────────────────────┤
│  Rust Backend (Tauri)         lib.rs (300 LOC)           │
│  └── Spawns Node.js sidecar, relays JSON-lines           │
├──────────────────────────────────────────────────────────┤
│  Node.js Sidecar             agent-sidecar/src/index.ts   │
│  └── Uses pi-mono SDK directly:                          │
│      ModelRegistry, SettingsManager, SessionManager,     │
│      AuthStorage, createAgentSession                     │
└──────────────────────────────────────────────────────────┘
```

### 1.2 What exists today
- **Sidebar tabs:** `Chats` and `Settings` (only API key + version info)
- **No extension management UI** — extensions must be manually added to `~/.zosmaai/agent/extensions/`
- **No package install** — users can't install from npm/git/local
- **Previous attempt existed** (in git rr-cache / PR #24) with Rust-based extension manager, but was reverted during the pi-mono migration simplification

### 1.3 What we know works
- Piper extension SDK is battle-tested (docs at pi-coding-agent/docs/extensions.md — 2600 lines)
- Pi packages (`pi install npm:...`, `pi install git:...`) work end-to-end
- Dhara extension protocol (JSON-RPC subprocess) is tested and proven
- Pi skills system (`SKILL.md` files) is mature

---

## 2. Pi Extension / Skill Capabilities

### 2.1 Extensions (TypeScript, in-process)

Pi extensions export a default function receiving `ExtensionAPI`:

```typescript
export default function (pi: ExtensionAPI) {
  // Lifecycle events
  pi.on("session_start", handler);
  pi.on("tool_call", handler);       // block/modify tool calls
  pi.on("tool_result", handler);     // modify results
  pi.on("before_agent_start", handler); // inject context, modify system prompt

  // Register capabilities
  pi.registerTool({ name, description, parameters, execute });
  pi.registerCommand("name", { handler });
  pi.registerShortcut("ctrl+x", { handler });
  pi.registerFlag("my-flag", { description });

  // User interaction
  ctx.ui.notify(...);
  ctx.ui.confirm(...);
  ctx.ui.select(...);

  // Session
  pi.appendEntry("customType", data);
  pi.setSessionName("...");
}
```

**Install locations:**
- `~/.pi/agent/extensions/*.ts` (global)
- `.pi/extensions/*.ts` (project-local)
- Via `settings.json` `packages` array (npm, git, local paths)

### 2.2 Skills (Markdown, on-demand)

Skills are markdown files with YAML frontmatter. The agent loads them on demand when a task matches the description.

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
└── references/           # Detailed docs
```

**Install locations:**
- `~/.pi/agent/skills/` (global)
- `.pi/skills/` (project-local)
- Via pi packages (`skills/` dir or `pi.skills` in package.json)

### 2.3 Pi Packages

Distribution format for extensions, skills, prompts, themes:

```json
{
  "name": "@zosmaai/slide-generator",
  "version": "1.0.0",
  "pi": {
    "extensions": ["./src/extension.ts"],
    "skills": ["./skills/"],
    "prompts": ["./prompts/"],
    "themes": ["./themes/"]
  }
}
```

Install: `pi install npm:@zosmaai/slide-generator`

### 2.4 Cowork Apps (pi-cowork concept)

A higher-level concept that wraps extensions + UI config:

```json
{
  "cowork": {
    "name": "Slide Generator",
    "description": "Generate presentations",
    "icon": "presentation",
    "category": "content",
    "configSchema": { /* JSON Schema with ui annotations */ },
    "scheduled": [
      { "cron": "0 9 * * 1", "prompt": "Generate weekly report for {{project}}" }
    ]
  }
}
```

---

## 3. Dhara Extension Protocol

Dhara extensions are subprocesses communicating via JSON-RPC 2.0 over stdin/stdout:

### 3.1 Manifest format

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "What it does",
  "runtime": {
    "type": "subprocess",
    "command": "node ./dist/index.js",
    "protocol": "json-rpc"
  }
}
```

### 3.2 Protocol lifecycle

```
Core                          Extension
 │                               │
 ├── initialize ────────────────►│  { protocolVersion, capabilities }
 │◄── result: { name, tools } ──┤
 │                               │
 ├── tools/execute ─────────────►│  { toolName, input }
 │◄── result: { content } ──────┤
 │                               │
 ├── tools/cancel ──────────────►│  (notification, no response)
 │                               │
 ├── shutdown ──────────────────►│  {}
 │◄── result: { status: "ok" } ─┤
```

### 3.3 Key differences from pi

| Aspect | Pi Extensions | Dhara Extensions |
|--------|--------------|-----------------|
| **Process model** | In-process (TypeScript) | Subprocess (any language) |
| **Loading** | Auto-discovered from `.ts` files | Manifest-driven discovery |
| **Tools** | `pi.registerTool()` with full API | Declared in initialize response |
| **Lifecycle** | Rich event system (20+ events) | Minimal (initialize/execute/shutdown) |
| **Distribution** | npm packages via `pi install` | npm/git with manifest.json |
| **UI interaction** | `ctx.ui.*` methods | Not built-in (needs extension protocol) |

---

## 4. Zosma Extension Model (ZEM) — The Abstraction

To survive an engine swap, we need an abstraction layer that the UI talks to, not the raw engine. The ZEM defines what an "extension" looks like to Zosma Cowork regardless of backend.

### 4.1 Core Extension Model

```typescript
interface ZemExtension {
  id: string;              // Unique identifier (e.g., "@zosmaai/slide-generator")
  name: string;            // Human-readable name
  version: string;         // Semver
  description: string;     // What it does
  author?: string;
  icon?: string;           // Icon name or URL
  category?: string;       // "productivity" | "development" | "content" | "utility"

  // Source tracking
  source: {
    type: "npm" | "git" | "local" | "url";
    value: string;         // npm:@zosmaai/slide-generator, git:..., /path/to/local
    ref?: string;          // Git ref or npm version
  };

  // Capabilities this extension provides
  capabilities: {
    tools?: ZemTool[];
    skills?: string[];     // Skill directories
    commands?: ZemCommand[];
    themes?: string[];
  };

  // Runtime backend (engine-specific)
  runtime: "pi" | "dhara" | "native";

  // Installation state
  installed: boolean;
  enabled: boolean;
  installPath?: string;   // Where on disk it lives
  config?: Record<string, unknown>;  // User configuration
  configSchema?: ZemConfigSchema;    // JSON Schema for config UI
}

interface ZemTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

interface ZemCommand {
  name: string;
  description: string;
}

interface ZemConfigSchema {
  type: "object";
  properties: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
    enum?: string[];
    ui?: string;  // "text" | "toggle" | "select" | "tags" | "slider"
  }>;
}
```

### 4.2 Extension Manager Backend

```typescript
interface ExtensionManagerBackend {
  /** List all installed extensions */
  listExtensions(): Promise<ZemExtension[]>;

  /** Install an extension from a source */
  install(source: ExtensionSource): Promise<ZemExtension>;

  /** Uninstall an extension */
  uninstall(extensionId: string): Promise<void>;

  /** Enable/disable an extension */
  setEnabled(extensionId: string, enabled: boolean): Promise<void>;

  /** Update extension configuration */
  setConfig(extensionId: string, config: Record<string, unknown>): Promise<void>;

  /** Search available extensions (future: marketplace) */
  searchAvailable(query: string): Promise<ZemExtension[]>;

  /** Reload extensions (apply changes without restart) */
  reload(): Promise<void>;
}
```

### 4.3 Engine Adapters

#### Pi Adapter
- Reads `~/.zosmaai/agent/extensions/` directory
- Lists packages from `settings.json` `packages` array
- Installs via `npm install` / `git clone`
- Enables/disables by modifying `settings.json`

#### Dhara Adapter
- Discovers from `~/.zosmaai/agent/extensions/` scanning for `manifest.json`
- Installs via `npm install` / `git clone`
- Enables/disables by moving manifest in/out of scanned directories
- Spawns subprocesses via `ExtensionManager`

---

## 5. UI Design — Extensions Tab

### 5.1 Sidebar Layout

```
┌─────────────────────┐
│  🔍 Search...       │  ← Filter installed exts
│                     │
│  ┌─────────────────┐│
│  │ + Install       ││  ← Opens install dialog
│  └─────────────────┘│
├─────────────────────┤
│  Installed (3)      │
│                     │
│  ┌─────────────────┐│
│  │ 🎨 Slide Gen    ││  ← Extension card
│  │   v1.2.0  ✓     ││     Toggle enabled/disabled
│  │   @zosmaai/...  ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │ 📋 PDF Tools    ││
│  │   v0.5.0  ✓     ││
│  └─────────────────┘│
│  ┌─────────────────┐│
│  │ 🔍 Web Search   ││
│  │   v2.1.0  —     ││     Disabled
│  └─────────────────┘│
│                     │
├─────────────────────┤
│  Explore            │  ← Future: browse marketplace
│  Popular / New      │
│                     │
├─────────────────────┤
│ [💬 Chats] [🧩 Ext]│  ← Tab bar
│ [⚙️ Settings]       │
└─────────────────────┘
```

### 5.2 Install Dialog

```
┌──────────────────────────────────────┐
│  Install Extension                   │
│                                      │
│  Source:                             │
│  ┌──────────────────────────────────┐│
│  │ npm:@zosmaai/slide-generator     ││
│  └──────────────────────────────────┘│
│                                      │
│  Quick options:                      │
│  [npm] [Git URL] [Local Path]        │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │  Cancel  │  │  Install │         │
│  └──────────┘  └──────────┘         │
└──────────────────────────────────────┘
```

### 5.3 Extension Detail / Config

Clicking an extension card opens a detail view:

```
┌──────────────────────────────────────┐
│  ← Back to Extensions                │
│                                      │
│  🎨 Slide Generator                  │
│  v1.2.0 by @zosmaai                  │
│                                      │
│  Generate presentations from markdown│
│                                      │
│  ── Tools ──                         │
│  • generate_slides — Create .pptx    │
│  • add_slide — Add slide to deck     │
│                                      │
│  ── Configuration ──                │
│  Default theme: [dark ▼]            │
│  Slide size:    [16:9 ▼]            │
│  Auto-save:     [✓]                 │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │ Disable  │  │Uninstall │         │
│  └──────────┘  └──────────┘         │
└──────────────────────────────────────┘
```

---

## 6. Backend Protocol Additions

### 6.1 New sidecar commands

```
Request:  {"type":"list_extensions", "id":"le1"}
Response: {"type":"result", "id":"le1",
           "data": {"extensions": [ZemExtension, ...]}}

Request:  {"type":"install_extension", "id":"ie1",
           "source":"npm:@zosmaai/slide-generator",
           "ref":"1.2.0"}
Response: {"type":"result", "id":"ie1",
           "data": {"extension": ZemExtension}}
Event:    {"type":"event", "event": {
             "type":"install_progress",
             "extensionId":"@zosmaai/slide-generator",
             "stage":"downloading" | "installing" | "complete" | "error",
             "message":"Installing dependencies..."
           }}

Request:  {"type":"uninstall_extension", "id":"ue1",
           "extensionId":"@zosmaai/slide-generator"}
Response: {"type":"result", "id":"ue1", "data": {}}

Request:  {"type":"set_extension_enabled", "id":"se1",
           "extensionId":"@zosmaai/slide-generator",
           "enabled": false}
Response: {"type":"result", "id":"se1", "data": {}}

Request:  {"type":"set_extension_config", "id":"sc1",
           "extensionId":"@zosmaai/slide-generator",
           "config": {"defaultTheme":"dark"}}
Response: {"type":"result", "id":"sc1", "data": {}}
```

### 6.2 New Tauri commands

```rust
#[tauri::command]
async fn list_extensions(
    state: State<'_, AppState>
) -> Result<Value, String>;

#[tauri::command]
async fn install_extension(
    source: String,
    ref_name: Option<String>,
    state: State<'_, AppState>
) -> Result<Value, String>;

#[tauri::command]
async fn uninstall_extension(
    extension_id: String,
    state: State<'_, AppState>
) -> Result<(), String>;

#[tauri::command]
async fn set_extension_enabled(
    extension_id: String,
    enabled: bool,
    state: State<'_, AppState>
) -> Result<(), String>;
```

---

## 7. Engine-Swap Strategy

The key insight: **the ZEM abstraction lives in the sidecar, not in the frontend**. The frontend never calls pi or dhara APIs directly — it talks JSON-lines to the sidecar. This means:

### 7.1 Today (pi backend)

```
Frontend → Tauri Rust → Sidecar (pi-mono SDK) → ~/.zosmaai/agent/extensions/
                          │
                          ├── ModelRegistry (pi)
                          ├── SettingsManager (pi)
                          └── ExtensionManager (pi adapter) ← NEW
```

### 7.2 Tomorrow (dhara backend)

```
Frontend → Tauri Rust → Sidecar (dhara SDK) → ~/.zosmaai/agent/extensions/
                          │
                          ├── DharaAgentLoop
                          ├── DharaProvider
                          ├── ExtensionManager (dhara adapter) ← SAME INTERFACE
                          └── SessionManager (dhara)
```

### 7.3 What changes, what stays

| Component | Pi | Dhara | Impact |
|-----------|-----|-------|--------|
| **Frontend** | React + TypeScript | Same | 0 changes |
| **Tauri layer** | JSON relay | Same | 0 changes |
| **Sidecar protocol** | JSON-lines | Same | 0 changes |
| **ExtensionManager interface** | `ZemExtension[]` | Same | 0 changes |
| **How extensions run** | TypeScript in-process | Subprocess JSON-RPC | Internal only |
| **Extension format** | `.ts` files + `package.json` pi key | `manifest.json` | Migration needed |
| **Package install** | `npm install` + pi settings | `npm install` + manifest scan | Minor path diff |

### 7.4 Migration path for extensions

When switching to dhara:
1. Pi extensions can be wrapped in a dhara subprocess adapter
2. Or pi extensions can be ported to dhara manifest format
3. ZEM provides compatibility mapping

---

## 8. Implementation Phases

### Phase 1: Foundation (sidebar tab + list/view)
- [ ] Add "Extensions" tab to Sidebar component
- [ ] Create `ExtensionPanel` component (list view)
- [ ] Create `useExtensions` hook (React state management)
- [ ] Add `list_extensions` sidecar command (discover from `~/.zosmaai/agent/extensions/`)
- [ ] Add `list_extensions` Tauri command
- [ ] Show installed extensions with enable/disable toggle

**Files to create/modify:**
- `src/components/Sidebar.tsx` — add Extensions tab
- `src/components/ExtensionPanel.tsx` — new component
- `src/hooks/useExtensions.ts` — new hook
- `src/types/extensions.ts` — ZemExtension types
- `agent-sidecar/src/extension-manager.ts` — new module (ZEM + pi adapter)
- `agent-sidecar/src/index.ts` — add `list_extensions` handler
- `src-tauri/src/lib.rs` — add `list_extensions` command

### Phase 2: Install/uninstall
- [ ] Create `InstallDialog` component
- [ ] Add `install_extension` and `uninstall_extension` sidecar commands
- [ ] Support npm source: `npm install <package>` → copy to extensions dir
- [ ] Support git source: `git clone <url>` → extensions dir
- [ ] Support local path: symlink or copy
- [ ] Show install progress events
- [ ] Add install/uninstall Tauri commands

### Phase 3: Extension detail & config
- [ ] Create `ExtensionDetail` component
- [ ] Show tools, skills, commands provided by extension
- [ ] Auto-generate config form from `configSchema`
- [ ] Save config to disk
- [ ] Add `set_extension_config` sidecar command

### Phase 4: Dhara compatibility
- [ ] Implement dhara adapter for ExtensionManager
- [ ] Support `manifest.json` discovery
- [ ] Support JSON-RPC subprocess spawning for dhara extensions
- [ ] Test extension migration path

### Phase 5: Marketplace (future)
- [ ] Discover extensions from npm registry (search `@zosmaai/` scope)
- [ ] Show popular / trending extensions
- [ ] One-click install from listing

---

## 9. Key Design Decisions

### 9.1 Extension storage: `~/.zosmaai/agent/extensions/`

```
~/.zosmaai/
├── agent/
│   ├── extensions/          ← All installed extensions
│   │   ├── slide-generator/  ← npm: package
│   │   │   ├── package.json
│   │   │   ├── node_modules/
│   │   │   └── src/
│   │   ├── my-local-ext/     ← local: symlink or copy
│   │   └── pdf-tools/        ← git: cloned repo
│   ├── extensions.json       ← Extension registry (enabled/disabled, config)
│   ├── settings.json         ← pi settings (model, provider, packages)
│   └── sessions/            ← Session files
```

`extensions.json`:
```json
{
  "extensions": {
    "@zosmaai/slide-generator": {
      "enabled": true,
      "config": { "defaultTheme": "dark" },
      "installedAt": "2026-05-12T10:00:00Z",
      "source": { "type": "npm", "value": "@zosmaai/slide-generator", "ref": "1.2.0" }
    },
    "my-local-ext": {
      "enabled": false,
      "config": {},
      "installedAt": "2026-05-10T15:30:00Z",
      "source": { "type": "local", "value": "/home/user/projects/my-ext" }
    }
  }
}
```

### 9.2 Why not reuse pi's `settings.json` directly?

Pi's `settings.json` `packages` array works but:
- No enable/disable per-extension
- No config per-extension
- No metadata (description, icon, category)
- Tightly coupled to pi's format

ZEM's `extensions.json` is engine-agnostic and richer.

### 9.3 Why sidecar-level abstraction, not Rust-level?

The sidecar is the "brain" — it knows the engine. Keeping ZEM in TypeScript (sidecar) means:
- One implementation for both engines
- Easier to test
- No need to recompile Rust when engines swap
- The Rust layer stays ultra-thin (JSON relay)

### 9.4 Why not in-process Tauri Rust for extension management?

Previous attempt (PR #24) had Rust-based extension management (`ext_installer` crate). This was:
- Duplicative: Rust code for npm install, git clone when Node.js already does this
- Harder to maintain: Two languages for the same logic
- Less flexible: Rust npm/git handling is fragile

Sidecar-based is simpler and more maintainable.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Pi SDK changes break extension loading | ZEM adapter isolates pi-specific code in one module |
| Dhara protocol still evolving | Start with pi-only adapter, add dhara when stable |
| User installs malicious extension | Show source URL, trust-on-install model (same as VS Code) |
| npm install takes too long (blocking) | Stream progress events, async install |
| Extension conflicts with each other | Enable/disable per-extension, conflict detection in ZEM |

---

## 11. Success Metrics

- [ ] User can see installed extensions in the Extensions tab
- [ ] User can install an extension from npm (e.g., `npm:@zosmaai/slide-generator`)
- [ ] User can enable/disable extensions
- [ ] User can uninstall extensions
- [ ] Extension config is editable and persistent
- [ ] Same UI works when engine is swapped to dhara (no frontend changes)
- [ ] Installed extensions are auto-discovered on next app launch

---

## 12. References

- [Pi Extensions Docs](https://docs.rs/pi-coding-agent/latest/pi_coding_agent/extensions/index.html)
- [Pi Packages Docs](https://docs.rs/pi-coding-agent/latest/pi_coding_agent/packages/index.html)
- [Dhara Extension Protocol](../dhara/src/core/protocol.ts)
- [Dhara Extension Manager](../dhara/src/core/extension-manager.ts)
- [Cowork Apps vs Pi Extensions](../memex/cards/cowork-app-model-vs-extensions.md)
- [Zosma Extension Architecture (memex)](../memex/cards/zosma-extension-architecture.md)
- [Previous Rust extension installer (rr-cache)](.git/rr-cache/)
