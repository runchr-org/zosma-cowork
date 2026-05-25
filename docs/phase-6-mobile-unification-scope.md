# Phase 6 — Mobile Unification Scope

**Status:** Planning  
**Date:** 2026-05-25  
**Context:** [Issue #116](https://github.com/zosmaai/zosma-cowork/issues/116)

---

## 1. Current State Assessment

### What ships in the React app (desktop-only today)

The Tauri desktop app is a fully featured chat UI:

| Component | Lines | Capabilities |
|-----------|-------|-------------|
| `ChatView.tsx` | ~100 | Message list, streaming, scroll tracking, tool call rendering, thinking blocks |
| `MessageInput.tsx` | ~190 | Textarea, file attach, image paste, model selector, file chips |
| `StatusBar.tsx` | ~190 | Elapsed timer, tool progress dots, phase labels, abort button, model badge |
| `Sidebar.tsx` | ~80 | Session list, search, templates, settings nav |
| `SettingsPage.tsx` | ~400 | Auth, extensions, skills, custom instructions, theme, telemetry, **Remote Access**, about |
| `ChatMessage.tsx` | ~240 | Markdown rendering, code blocks, copy, download, feedback buttons |
| `App.tsx` | ~500 | Session management, onboarding flow, layout orchestration |
| `RemoteAccessPanel.tsx` | ~350 | QR code, PIN, Tailscale detection, start/stop toggle |

**Total: ~1,900 lines of mobile-capable UI locked behind a 1400×900 desktop window.**

### What the standalone `mobile/index.html` does

A 376-line self-contained vanilla HTML file served by `remote-server.ts` when `isMobileUA()` matches. It has:

- PIN entry → SSR-style rendered chat
- Basic markdown via CDN `marked` + `DOMPurify`
- SSE for streaming, `fetch` for commands
- Status indicator (green/yellow/red dot)
- Abort button

**Missing vs. React app:** tool calls, thinking blocks, session history, file attach, model selection, error retry, auto-reconnect, settings, PWA, offline support, emoji picker, voice input.

### Architecture Fork

```
remote-server.ts
  ├─ isMobileUA() === true  →  serves mobile/index.html  (vanilla fork, 376 lines)
  └─ isMobileUA() === false →  serves dist/               (React app, ~1,900 lines)
```

Both need to stay in sync whenever the protocol changes.

---

## 2. Decision: Eliminate `mobile/index.html`, Make the React App Responsive

**No new mobile framework.** The existing React + Vite + Tailwind CSS stack is already sufficient for mobile. The `mobile/index.html` was a rapid prototype to ship Phase 6.0 — now we merge back into the React app.

### Why this works

1. **The app is already mobile-capable** — no Tauri APIs needed for basic chat (everything goes through HTTP/WS). The React build produces plain static files; `remote-server.ts` already serves `dist/` for desktop browsers.
2. **Tailwind `md:` breakpoints are already used** in `SettingsPage.tsx` (desktop sidebar vs mobile tab bar). The pattern is established.
3. **`isMobileUA()` can still work** — it just serves the same `dist/index.html`. The React app detects mobile via CSS media queries (which it already has) and/or a JS check.
4. **PWA is trivial** — `vite-plugin-pwa` adds manifest + service worker in ~10 lines of config. No new dependencies needed beyond one dev dependency.
5. **All Phase 6.1 features** (touch targets, composer polish, session history, pull-to-refresh) are easier to build in React than in vanilla JS.

### What gets deleted

- `mobile/index.html` (376 lines) — no more fork
- `isMobileUA()` logic in `remote-server.ts` (lines 39–41, 344–354, 396–424) — the UA check
- The `getMobileDir()` function (line 338)

---

## 3. Implementation Plan

### 3.1 Add PWA Support — 1 hour

**Why before layout:** PWA `manifest.json` is needed even in desktop browsers for "Add to Home Screen" on phones. It's a quick addition that unblocks the rest.

**Files:**
- `package.json` — add `vite-plugin-pwa` dev dependency
- `vite.config.ts` — register the plugin with manifest config (app name, icons, theme color, display mode)
- `public/` folder — add app icons (192×192, 512×512 PNGs — can use placeholder SVG during dev)

**Acceptance:** `npm run build:frontend` produces `dist/manifest.json` + `dist/sw.js` + icons. Running `npx serve dist` and visiting on phone shows "Add to Home Screen" prompt.

### 3.2 Add Mobile Layout to `App.tsx` — 2–3 hours

**Current layout (desktop-only):**

```tsx
<div class="flex h-screen bg-background">
  <Sidebar class="w-64 ..." />           {/* 256px sidebar */}
  <div class="flex-1 flex flex-col">
    <header />                            {/* model info, share */}
    <main class="flex-1">
      <ChatView />                        {/* messages + input */}
    </main>
  </div>
</div>
```

**Required responsive layout:**

```tsx
<div class="flex h-screen bg-background">
  {/* Desktop: sidebar visible */}
  <div class="hidden md:block">
    <Sidebar ... />
  </div>
  
  <div class="flex-1 flex flex-col">
    {/* Mobile: top bar with hamburger/menu */}
    <MobileTopBar class="md:hidden ..." />
    
    <header class="hidden md:flex ..." /> {/* desktop header */}
    <main class="flex-1">
      <ChatView />
    </main>
  </div>

  {/* Mobile: bottom nav bar */}
  <MobileBottomNav class="md:hidden ..." />
</div>
```

**New component: `MobileTopBar.tsx`** (~40 lines)
- Hamburger icon that opens sidebar as a slide-over drawer
- Model badge (compact)
- Settings gear icon
- Title "Zosma Cowork"

**New component: `MobileBottomNav.tsx`** (~50 lines)
- Chat / Templates / Settings tabs (reuses the pattern from `SettingsPage.tsx`)
- Active tab indicator

**Sidebar behavior on mobile:**
- Hidden by default (`hidden md:block`)
- Slides in from left when hamburger is tapped (use a `useState` + conditional rendering with `animate-slide-in` CSS)
- Backdrop overlay when open
- Close on tap outside

**Changes to `App.tsx`:**
- Add `mobileMenuOpen` state (default `false`)
- Wrap `<Sidebar>` in responsive container: `hidden md:block` + conditional slide-over
- Conditionally render `MobileTopBar` / `MobileBottomNav` on small screens
- Move the `<header>` (model info, share) to `hidden md:flex`

### 3.3 Responsive ChatView (`ChatView.tsx`) — 1 hour

**Changes are mostly CSS, minimal logic changes:**

| Element | Desktop | Mobile |
|---------|---------|--------|
| Message bubble max-width | Default (prose) | `max-w-[95%]` |
| Message input | Compact, side-by-side model selector | Full-width, larger textarea, larger send target |
| Status bar | Compact | Full-width, same content |
| Tool call details | Inline | Collapsible by default on mobile |
| Error banner | Inline | Inline, same |

**Files:**
- `ChatView.tsx` — The component already uses Tailwind classes. Most of the responsive work is in the parent layout (App.tsx).
- `MessageInput.tsx` — On mobile (`<md`):
  - Larger textarea padding (`py-3` → `py-4`)
  - Larger send button (44×44px minimum tap target)
  - Add `enterKeyHint="send"` and `inputMode="text"`
  - Model selector becomes a picker overlay instead of inline dropdown

### 3.4 Remote Access Panel — Adapt for Mobile Display — 30 min

The `RemoteAccessPanel.tsx` already uses `sm:flex-row` for the QR/layout section. It's already responsive. **No changes needed.**

### 3.5 Touch-Friendly Composer (Phase 6.1.2) — 2 hours

**Voice button** — Add to `MessageInput.tsx`:

```tsx
// On mobile only (useMediaQuery)
if (isMobile) {
  return (
    <button onClick={startVoiceInput}>
      <MicIcon />
    </button>
  );
}
```

Uses the Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`). Falls back gracefully if not available.

**Send button:** Ensure minimum 44×44px tap target on mobile. Currently the button is `px-4 py-1.5` (~60×32px) — needs min-height.

### 3.6 Connection Status Bar (Phase 6.1.5) — 1 hour

Currently the mobile HTML has a status bar in the HTML. The React `StatusBar.tsx` only shows during streaming.

**Add a persistent connection status** to `ChatView.tsx` or `App.tsx` for remote sessions:

- New state: `remoteConnected` from SSE connection health
- Show a thin bar at top when in remote mode: green "Connected" / red "Disconnected"
- Add a reconnect button
- Auto-reconnect with exponential backoff

This requires the React app to know it's being served from the remote server. Options:
- Add a `?remote=1` query param when the remote server serves `dist/`
- Or check `window.location.port === "8765"` (the remote server port)
- Or use a meta tag / JS variable injected by the server

**Recommended:** Check `window.location.port` — if it's not `1420` (Vite dev) or the Tauri webview default, assume remote mode.

### 3.7 Session History on Mobile (Phase 6.1.6) — 1 hour

The `Sidebar` already has session list + search. On mobile, sessions are accessible via:
- The sidebar slide-over (hamburger menu)
- Or use `MobileBottomNav` → "Chats" tab which opens the sidebar as a slide-over

**No new code needed** — just make sure the session list renders correctly on narrow screens.

### 3.8 Remove `mobile/index.html` — 30 min

After the React app is responsive:

- Delete `mobile/index.html`
- In `remote-server.ts`:
  - Remove `isMobileUA()` function (lines 39–41)
  - Remove the UA check in `serveStatic()` (lines 344–354) — always serve from `dist/`
  - Remove `serveMobileIndex()` function (lines 396–424)
  - Remove `getMobileDir()` function (line 338)

The server becomes simpler: it serves `dist/index.html` for all browsers. The React app handles responsive layout.

---

## 4. Not Doing

These items are explicitly **out of scope** per the user's direction:

| Item | Status | Reason |
|------|--------|--------|
| ngrok integration (6.2.3) | ❌ Skip | "We are good with tailscale" |
| Built-in relay (6.2.4) | ❌ Skip | Future work, not needed now |
| Native companion app (6.3) | ❌ Skip | Future work, not needed now |
| HTTPS / self-signed cert | ❌ Defer | Should revisit in Phase 6.2 security audit |
| Rate limiting | ❌ Defer | Should revisit in security audit |

---

## 5. Updated Roadmap Status

### Phase 6.0 — Foundation (Week 1) — 5/6 done ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.0.1 | Embedded HTTP+WS server | ✅ Done | 680 lines, `remote-server.ts` |
| 6.0.2 | Wire to existing protocol | ✅ Done | EventBus + CommandQueue |
| 6.0.3 | Serve mobile web UI | ✅ Done | Via `dist/` + `mobile/index.html` |
| 6.0.4 | QR code display | ✅ Done | `RemoteAccessPanel.tsx` |
| 6.0.5 | Security: local-only default | ⚠️ Partial | PIN works; default host should be `127.0.0.1` not `0.0.0.0`; no HTTPS |
| 6.0.6 | Feature flag | ✅ Done | Toggle in settings → Rust → sidecar |

### Phase 6.1 — Mobile UI Polish (Week 2) — 1/6 done ⏳

| # | Task | Status | Plan |
|---|------|--------|------|
| 6.1.1 | Responsive chat view | ⚠️ Partial → **Doing** | Make React app responsive, eliminate `mobile/index.html` |
| 6.1.2 | Touch-friendly composer | ❌ → **After 6.1.1** | Larger targets, voice button (Web Speech API) |
| 6.1.3 | PWA manifest | ❌ → **After 6.1.1** | `vite-plugin-pwa`, icons, manifest |
| 6.1.4 | Session continuity | ✅ Done | Shared `~/.zosmaai/cowork/sessions/` |
| 6.1.5 | Connection status bar | ⚠️ Partial → **After 6.1.1** | Auto-reconnect, persistent status |
| 6.1.6 | Pull-to-refresh history | ❌ → **After 6.1.1** | Sidebar accessible via slide-over |

### Phase 6.2 — From Anywhere (Week 3) — 1/5 done 🟡

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.2.1 | Tailscale detection | ✅ Done | `RemoteAccessPanel.tsx` |
| 6.2.2 | Tailscale docs | ❌ | No formal docs file yet |
| 6.2.3 | ngrok integration | ❌ Skipped | User confirmed Tailscale is enough |
| 6.2.4 | Built-in relay | ❌ Future | Not needed now |
| 6.2.5 | Security audit | ❌ Deferred | PIN, HTTPS, rate limiting, CORS |

### Phase 6.3 — Native App (Future) — 0/4 done ⏸️

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.3.1–6.3.4 | All tasks | ❌ Not started | Marked as Future/Optional |

---

## 6. Effort Summary

| Step | Hours | Files Changed |
|------|-------|---------------|
| 3.1 PWA support | 1 | `package.json`, `vite.config.ts`, new icons in `public/` |
| 3.2 Mobile layout in App.tsx | 2–3 | `App.tsx`, new `MobileTopBar.tsx`, new `MobileBottomNav.tsx` |
| 3.3 Responsive ChatView | 1 | `ChatView.tsx`, `MessageInput.tsx` |
| 3.4 RemoteAccessPanel (already responsive) | 0 | None |
| 3.5 Touch composer + voice | 2 | `MessageInput.tsx` |
| 3.6 Connection status bar | 1 | `App.tsx`, `ChatView.tsx` |
| 3.7 Session history on mobile | 0–0.5 | Already works via slide-over |
| 3.8 Remove mobile/index.html | 0.5 | `remote-server.ts`, delete `mobile/index.html` |
| **Total** | **8–10** | **~10 files** |

---

## 7. Open Questions

1. **Default host binding (6.0.5):** The React UI passes `host: "0.0.0.0"` to `start_remote_server`. Should the default be `"127.0.0.1"` instead, with an explicit "Allow LAN" checkbox? Currently anyone on the network can see the QR/PIN page.

2. **Auto-reconnect on mobile:** The SSE connection has no auto-reconnect logic. Should the React app show a "Connection lost" bar with a manual reconnect button, or should it auto-retry?

3. **Tailscale docs:** Should we add a `docs/tailscale-setup.md` file, or is the inline UI text in `RemoteAccessPanel.tsx` sufficient?
