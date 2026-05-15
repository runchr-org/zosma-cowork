# Phased Implementation Plan: Next Features

**Date:** 2026-05-16
**Status:** Plan
**Total Scope:** 7 features, implemented sequentially via feature branches, PRs, CI validation, and squash-merge.

---

## Overview

Seven features to make Zosma Cowork more useful for non-technical users, ordered by complexity and dependency.

| Phase | Feature | Complexity | Sidecar? | Est. Files |
|-------|---------|-----------|----------|-----------|
| 1 | Prompt Templates | Low | No | 3-4 |
| 2 | Skills Search & Install | Medium | No (IPC) | 5-6 |
| 3 | Inline Response Feedback | Low | No | 3-4 |
| 4 | In-app Feedback Submission | Low | No | 2-3 |
| 5 | Conversation Search | Medium | No | 4-5 |
| 6 | Custom Instructions / Persona | Medium | Yes (init) | 4-5 |
| 7 | Share Conversations | Medium | No | 3-4 |
| 8 | Share the App (Referral) | Low | No | 3-4 |

---

## Phase 1: Prompt Templates

**Goal:** Reusable prompt templates that non-tech users can click to quickly start common tasks.

### UX
- New "Templates" tab in the sidebar (alongside Chats, Extensions, Settings)
- Grid of template cards with icon, title, description
- Clicking a template populates the composer with the prompt text and optionally sends it
- Templates grouped by category (Writing, Data, Code, General)

### Data
- Hard-coded initial set of 8-10 templates stored in a constants file
- Structure:
  ```ts
  interface PromptTemplate {
    id: string;
    title: string;
    description: string;
    category: "writing" | "data" | "code" | "general";
    icon: string; // lucide icon name
    prompt: string; // the template text
  }
  ```

### Implementation
1. `src/data/templates.ts` — constants file with template data
2. `src/components/PromptTemplates.tsx` — sidebar panel component
3. `src/components/PromptTemplates.test.tsx` — tests
4. Wire into `Sidebar.tsx` as a new tab/panel
5. Click handler calls `onSend(prompt)` callback passed from App

### Test Cases
- Renders all templates grouped by category
- Clicking a template calls onSend with correct prompt
- Categories render section headers
- Empty state (if applicable)

### Files Changed
- `src/data/templates.ts` (new)
- `src/components/PromptTemplates.tsx` (new)
- `src/components/PromptTemplates.test.tsx` (new)
- `src/components/Sidebar.tsx` (add Templates tab)
- `src/App.tsx` (wire onSend)

---

## Phase 2: Skills Search & Install

**Goal:** Let non-technical users discover, browse, and install pi agent skills from [skills.sh](https://skills.sh/) directly within Zosma Cowork — no terminal needed.

### UX
- New **Skills** tab in sidebar (alongside Chats, Extensions, Settings, Templates)
- **Skills tab shows:**
  - Search bar to find skills from skills.sh
  - Results list with: name, description, install count, source reputation badge
  - Installed skills section with toggle enable/disable and uninstall
- **Search:** queries `npx skills find <query>` via Rust IPC, parses results, displays in a clean list
- **Install:** one-click install button on each search result, calls `npx skills add <package> -g -y` via Rust IPC
- **Installed skills:** show with version, source, toggle to enable/disable
- **Each skill card shows:**
  - Icon/initial, name, description, install count (if available)
  - Source badge (official = green, community = blue, unknown = gray)
  - Install/Uninstall button

### Technical

#### Rust IPC Commands (src-tauri/src/lib.rs)
New commands to execute `npx skills` CLI:

```rust
#[tauri::command]
async fn search_skills(query: String) -> Result<Vec<SkillInfo>, String> {
    // Runs: npx skills find --json <query>
    // Parses JSON output into SkillInfo structs
}

#[tauri::command]
async fn install_skill(package: String) -> Result<(), String> {
    // Runs: npx skills add <package> -g -y
}

#[tauri::command]
async fn list_installed_skills() -> Result<Vec<SkillInfo>, String> {
    // Runs: npx skills list --json
}

#[tauri::command]
async fn uninstall_skill(package: String) -> Result<(), String> {
    // Runs: npx skills remove <package> -y
}
```

SkillInfo struct:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SkillInfo {
    pub id: String,          // e.g., "vercel-labs/agent-skills@react-best-practices"
    pub name: String,        // Display name
    pub description: String,
    pub source: String,      // e.g., "vercel-labs", "anthropics"
    pub installs: Option<u32>,
    pub version: Option<String>,
    pub installed: bool,
    pub enabled: bool,
}
```

#### Frontend
- `src/hooks/useSkills.ts` — hook wrapping IPC calls
- `src/components/SkillsPanel.tsx` — sidebar panel with search + installed list
- `src/components/SkillsPanel.test.tsx` — tests
- Wire into `Sidebar.tsx` as a new tab

### Edge Cases & States

| State | Handling |
|-------|----------|
| `npx skills` not installed | Show helpful message: "Skills CLI not found. Install via `npm install -g @anthropic-ai/skills`" with copy-to-clipboard |
| Search returns no results | "No skills found for '{query}'. Try different keywords" |
| Network error | Show error banner with retry button |
| Install fails | Show error with details from stderr |
| Already installed | Button shows "Installed ✓" disabled |
| Installing in progress | Spinner, button disabled |
| Empty state (no skills installed) | "No skills installed yet. Search and install from the marketplace above." with illustration |
| CLI command timeout | Show "Command timed out. npx may be downloading packages." with retry |

### Test Cases
- Renders search input and installed list sections
- Search calls IPC with query
- Search results render correctly
- Install button triggers IPC
- Already installed shows different state
- Error state displays message
- Empty state displays message
- Loading state shows spinner

### Files Changed
- `src-tauri/src/lib.rs` (new IPC commands: search_skills, install_skill, list_installed_skills, uninstall_skill)
- `src/hooks/useSkills.ts` (new)
- `src/hooks/useSkills.test.ts` (new)
- `src/components/SkillsPanel.tsx` (new)
- `src/components/SkillsPanel.test.tsx` (new)
- `src/components/Sidebar.tsx` (add Skills tab)
- `src/types/index.ts` (add SkillInfo interface)

---

## Phase 3: Inline Response Feedback

**Goal:** Per-message upvote/downvote buttons with feedback collection on downvote, and optional "what worked" on upvote.

### UX
- Two small buttons (thumbs up / thumbs down) next to each assistant message
- Appear on hover (like export actions), or always visible
- **Upvote:** briefly highlights, optionally shows a small "Thanks!" tooltip
- **Downvote:** opens an inline text input below the message: "What went wrong? (optional)" with a Submit button
- Both states persist visually (filled icon once voted)
- Voting is stored in-memory per session (not persistent across reloads for v1)

### Data Collection
- `trackEvent("response_feedback", { vote: "up" | "down", reason?: string })` via existing telemetry
- If user provides a reason on downvote: `trackEvent("response_feedback", { vote: "down", reason: "..." })`
- For future: opt-in full session collection would include this data

### Implementation
1. Add `FeedbackButtons` component with up/down state
2. Add inline reason input component (shown on downvote)
3. Wire into `ChatMessage.tsx` alongside existing export actions
4. Test: button rendering, click handlers, reason input submission

### Files Changed
- `src/components/FeedbackButtons.tsx` (new)
- `src/components/FeedbackButtons.test.tsx` (new)
- `src/components/ChatMessage.tsx` (integrate feedback buttons)

---

## Phase 4: In-app Feedback Submission

**Goal:** A general feedback form accessible from the sidebar or header, letting users report bugs, suggest features, or send general feedback.

### UX
- Small "Feedback" link/button in sidebar footer or header
- Opens a dialog/modal with:
  - Category selector: Bug Report, Feature Request, General Feedback
  - Subject line input
  - Message textarea
  - Optional email/contact field
  - Submit button
- On submit: sends data, shows "Thank you" confirmation

### Data Collection
- For v1: `trackEvent("user_feedback", { category, subject, message })` via existing telemetry
- Or use a simple HTTP POST to a feedback endpoint (if one exists)
- Since Sentry has a user feedback feature, could use `Sentry.captureFeedback()` — but this only works with Sentry events. A simpler approach is just telemetry + optional email.

### Implementation
1. `src/components/FeedbackDialog.tsx` — modal with form fields
2. `src/components/FeedbackDialog.test.tsx` — tests
3. Wire trigger button into Sidebar footer
4. Submit sends via telemetry or fetch to endpoint

### Files Changed
- `src/components/FeedbackDialog.tsx` (new)
- `src/components/FeedbackDialog.test.tsx` (new)
- `src/components/Sidebar.tsx` (add feedback trigger)
- `src/lib/telemetry.ts` (add submitFeedback or use trackEvent)

---

## Phase 5: Conversation Search

**Goal:** Search through past conversations by content/keywords from the sidebar.

### UX
- Search bar at the top of the Chats sidebar panel
- As user types, filter session list by matching content
- Matches show: session title, date, snippet of matched text
- Click to open matching session (existing session select flow)

### Implementation
- Load session JSONL files, parse messages, search content
- For v1: simple substring/word matching in session titles and loaded messages
- For v1: re-scan on each keystroke with debounce (sessions are small)
- Future: could cache a search index, but v1 keeps it simple
- Show results inline in the Chats panel (switch between "list" and "search" modes)

### Files Changed
- `src/components/SessionSearch.tsx` (new)
- `src/components/SessionSearch.test.tsx` (new)
- `src/components/Sidebar.tsx` (integrate search bar)
- `src/App.tsx` (expose load/invoke for session content)

---

## Phase 6: Custom Instructions / Persona

**Goal:** Let users define custom instructions that are injected into every conversation's system prompt — like Claude's "Custom Instructions" or "Persona" settings.

### UX
- New "Persona" tab in sidebar (or section in Settings)
- Name field (optional)
- Textarea: "How should Zosma behave? Describe your preferences, role, tone, constraints..."
- Examples / suggested prompts below the textarea
- Save button (persists to settings)
- Toggle: "Enable custom instructions" on/off
- Preview: "This will be added to the start of every conversation"

### Technical
- Custom instructions stored in `settings.json` via existing `save_settings` / `get_settings`
- When starting a stream, custom instructions are prepended as an initial `system` message or injected into the prompt
- Requires modifying `usePiStream.startStream()` to prepend system instructions
- If sidecar protocol supports system messages at init time, use that. Otherwise, prepend as a system role message.

### Sidecar Protocol
- Check if sidecar init accepts a `systemPrompt` or `customInstructions` field
- If not, modify agent-sidecar to accept it in the init JSON
- Fallback: add a system message to the front of the messages array

### Files Changed
- `src/components/PersonaSettings.tsx` (new)
- `src/components/PersonaSettings.test.tsx` (new)
- `src/components/Sidebar.tsx` (add Persona tab)
- `src/hooks/usePiStream.ts` (inject custom instructions)
- `src/App.tsx` (load/save persona settings, wire into stream)
- Maybe: `agent-sidecar/src/index.ts` (accept systemPrompt in init)

---

## Phase 7: Share Conversations

**Goal:** Export a session as a shareable artifact that can be sent to others.

### UX
- "Share" button in the header or ChatMessage export area
- Opens a dialog with options:
  - **Export as Markdown** — clean markdown transcript with all messages
  - **Export as JSON** — raw session data
  - **Copy share link** — (future, needs backend)
- On export: similar to existing Save action but with formatted output
- Markdown export includes: session title, date, model info, messages with role labels

### Implementation
1. Format session messages into a clean markdown transcript
2. Use existing `write_user_file` IPC to save
3. Or use `navigator.clipboard` to copy markdown
4. Dialog component for export options

### Files Changed
- `src/lib/export-session.ts` — formatting logic
- `src/components/ShareDialog.tsx` (new)
- `src/components/ShareDialog.test.tsx` (new)
- `src/App.tsx` (wire into header/actions)

---

## Execution Workflow

For each phase:
1. **Create worktree:**
   ```bash
   git worktree add .worktrees/feature/<phase-name> origin/main -b feature/<phase-name>
   ```
2. **Implement** following TDD (RED → GREEN → REFACTOR)
3. **Validate:** lint → typecheck → test
4. **Commit** with conventional commit message
5. **Push** to personal fork
6. **Create PR** from `arjun-zosma:feature/<phase-name>` → `zosmaai/zosma-cowork:main`
7. **Wait** for all CI checks to pass
8. **Squash-merge** and delete branch
9. **Pull main** locally, clean worktree
10. **Repeat** for next phase

---

## Template Constants (Phase 1)

Initial 10 prompt templates:

| Category | Title | Prompt |
|----------|-------|--------|
| writing | Write a Document | "Write a professional document about [topic]. Include an introduction, key points, and conclusion." |
| writing | Proofread & Edit | "Please review the following text for grammar, clarity, and style. Suggest improvements while preserving the original meaning: [paste text]" |
| writing | Write an Email | "Help me draft a professional email about [topic]. The tone should be [formal/casual] and the recipient is [recipient]." |
| data | Summarize a File | "Read the file at [path] and provide a concise summary covering the main points, key data, and conclusions." |
| data | Analyze Data | "Analyze the following data and identify patterns, trends, and outliers. Provide actionable insights: [paste data]" |
| data | Translate Text | "Translate the following text from [source language] to [target language], preserving the tone and nuance: [paste text]" |
| code | Write Code | "Write a [programming language] function/program that [describe what it should do]. Include comments explaining the logic." |
| code | Explain Code | "Explain the following code in simple terms: what it does, how it works, and potential improvements: [paste code]" |
| general | Brainstorm Ideas | "I need ideas for [topic]. Please help me brainstorm creative approaches, consider pros and cons, and suggest next steps." |
| general | Plan a Project | "Help me create a plan for [project]. Include goals, milestones, timeline, resources needed, and potential risks." |

---

## Session Search (Phase 4) Architecture

```
┌─────────────────────┐
│  SearchInput (bar)  │  ── query ──→  App.tsx
└─────────────────────┘
                                      │
                                      ▼
                              invoke("list_sessions")
                              + invoke("load_session")
                                      │
                                      ▼
                              filter sessions by:
                              - title contains query (case-insensitive)
                              - message content contains query
                                      │
                                      ▼
                              Return filtered SessionEntry[]
                   
┌─────────────────────┐
│  SearchResults       │  ←── filtered sessions
│  (list in sidebar)   │
└─────────────────────┘
```

Search is reactive: as the user types, results update. Click a result → load that session.

For performance: limit search to session titles initially (fast, no content loading). If more precision is needed, load each session's first message content async.

---

## Persona / Custom Instructions (Phase 5) Protocol Design

Current `startStream(text)` sends user text to the sidecar. The flow:

```
App.tsx → usePiStream.startStream(text)
        → dispatch(START_STREAM)
        → sidecar stdin: { type: "user_message", content: text }
```

For custom instructions, we need to modify this to:

```
App.tsx → usePiStream.startStream(text, customInstructions?)
        → sidecar stdin: { 
            type: "user_message", 
            content: text,
            system_prompt: customInstructions // new field
          }
```

The sidecar then prepends the system prompt to the conversation. If sidecar doesn't support this field, we can either:
1. Modify `agent-sidecar/src/index.ts` to accept `system_prompt` in the init/user_message
2. Or add a system message at the front of the messages array before sending

Option 1 is cleaner. The sidecar already has a `systemPrompt` concept in pi's SDK — we just need to pass it through.

---

## Share Format (Phase 7)

Markdown export format:
```markdown
# Session: {title}
**Date:** {date}
**Model:** {provider}/{model}

---

## You
{user message content}

## Zosma
{assistant message content}
...
```

---

## Phase 8: Share the App (Referral)

**Goal:** Let users share Zosma Cowork with friends via social media and referral links — spread the word without leaving the app.

### UX
- Small "Share Zosma" button in sidebar footer or header bar
- Opens a **ShareDialog** with:
  - Title: "Share Zosma Cowork with friends"
  - Subtitle: "Help us grow! Share the app on social media or send a referral link."
  - Grid of social share buttons:
    - **LinkedIn** — share as a post
    - **X / Twitter** — tweet about it
    - **Facebook** — share on timeline
    - **WhatsApp Web** — send to a contact
    - **Copy link** — copy download page URL to clipboard
  - Pre-filled message: "I've been using Zosma Cowork — India's first non-coding agentic work harness. It's free, open-source, and amazing for getting work done! Check it out: https://zosma.ai/cowork"
  - Referral code (future): placeholder text "Coming soon: earn credits when friends sign up"

### Social Share URLs

Each platform uses a standard share URL with pre-filled text:

```typescript
const SHARE_URLS = {
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(DOWNLOAD_URL)}`,
  twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(DOWNLOAD_URL)}`,
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(DOWNLOAD_URL)}`,
  whatsapp: `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + ' ' + DOWNLOAD_URL)}`,
};
```

Each opens the share URL via the existing `open_url` IPC command (which opens the system browser).

### Implementation
- `src/components/ShareAppDialog.tsx` — modal with social share buttons
- `src/components/ShareAppDialog.test.tsx` — tests
- Wire trigger into `Sidebar.tsx` footer or header
- Very little backend work — all client-side URL generation

### Edge Cases & States

| State | Handling |
|-------|----------|
| No internet | Buttons still work (open browser to share URL), browser handles offline |
| Platform blocked | Browser shows the platform's login/error page naturally |
| Share text edited | Optional editable textarea before sharing (v1 uses fixed text) |
| Referral code unavailable | Show "Coming soon" badge, no functional change |
| Copy link | Falls back to `navigator.clipboard.writeText()` with "Copied!" feedback |

### Test Cases
- Renders all 5 share options
- LinkedIn button opens correct URL
- Twitter button opens correct URL
- Facebook button opens correct URL
- WhatsApp button opens correct URL
- Copy link copies to clipboard
- Dialog opens/closes correctly

### Files Changed
- `src/components/ShareAppDialog.tsx` (new)
- `src/components/ShareAppDialog.test.tsx` (new)
- `src/components/Sidebar.tsx` (add share trigger)

---
