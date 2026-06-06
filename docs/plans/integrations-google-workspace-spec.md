# Google integration spec — curated packages + external auth broker

Status: in progress · Epic #180 · relates to B2 #186, B3 #187, B4 #188

## Decision (refines the epic)

Integrations are **curated pi packages**, not a dynamic "any plugin works" runtime.
Cowork ships a small, hand-picked catalog and knows exactly how to configure each
one. For Google we **reuse existing pi packages for everything except Calendar**,
and **author only the missing package**:

| Product | Tool(s) | Package | Source |
|---|---|---|---|
| Gmail | `gmail` | `@e9n/pi-gmail` | curated (reuse) |
| Drive/Docs/Sheets/Slides | `google_drive_*`, `google_docs_*`, `google_sheets_*`, `google_slides_*` | `pi-google-workspace` (Geun-Oh) | curated (reuse) |
| **Calendar** | `google_calendar` | **authored in-tree** | `agent-sidecar/src/google-calendar/` (B4 #188) |

## Auth model: app brokers once, extensions just read

1. **Cowork app** (Tauri/Rust + React) owns a **Zosma-embedded OAuth client** and
   runs **one** consent for the **union of scopes** (loopback + PKCE).
2. After consent, the app **fans the credentials out** to each curated package's
   real config location (this is the B2 #186 config-routing layer):

   | Destination | Format | Read by |
   |---|---|---|
   | `~/.pi/agent/google-workspace/oauth.json` | `{clientId, clientSecret, tokens}` | `pi-google-workspace` **and** `google_calendar` (shared) |
   | `settings.json → "pi-gmail"` + `~/.pi/agent/db/gmail-tokens.json` | pi-gmail settings + token file | `@e9n/pi-gmail` |

3. **Extensions read + self-refresh** their config at tool-call time. No per-tool
   setup command runs inside Cowork. Because config lands in pi's *real* files,
   the same setup works from the `pi` CLI too (epic acceptance criterion).

Union scopes requested at consent:
`gmail.modify`, `calendar`, `drive`, `documents`, `spreadsheets`, `presentations`.

Key simplification: the **Calendar package deliberately shares
`oauth.json`** with `pi-google-workspace` (same `AuthConfig` shape + refresh
logic), so the app writes that file **once** and both packages use it. Only Gmail
needs a second destination.

## What's built (this PR)

`agent-sidecar/src/google-calendar/` — owned extension, same pattern as
`src/office-docs/`, registered via `extensionFactories` in `index.ts`:

- `auth.ts` — reads/refreshes the shared `oauth.json`; `calendarConnectionStatus()`.
- `client.ts` — `calendarRequest()` (auth header, 401 retry, error surfacing).
- `tool.ts` — `google_calendar` tool, action-dispatched:
  `list_calendars, list_events, get_event, create_event, update_event,
  delete_event, quick_add, freebusy, status`.
- `extension.ts` — `pi.registerTool` factory (default export).
- `tool.test.ts` — 9 unit tests (request shaping, all-day vs timed, attendees,
  custom calendarId, validation, freebusy, error surfacing).

## Remaining work (tracked by epic sub-issues)

- **B2 #186** — config-routing descriptors for the 2 Google destinations above;
  generalize `set_extension_config` to write the resolved file/format.
- **B3 #187** — `SetupHandler` for Google: React "Connect Google" card (consent,
  scope toggles, connected-as-email, disconnect/revoke). Reuse `start_oauth`.
- **Rust/Tauri** — embed Zosma OAuth client; loopback+PKCE consent; write the
  two destinations; `get_google_status` + `disconnect_google` commands.
- One-time migration: import any pre-existing legacy token files.

## Caveat — OAuth verification

Restricted scopes (`gmail.modify`, full `drive`) require Google's security
assessment. Ship in OAuth **Testing** mode (allowlisted users) for internal
builds; complete verification before public release. Track as a release blocker.
