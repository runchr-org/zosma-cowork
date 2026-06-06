/**
 * Zosma Cowork — Google Calendar Extension
 *
 * Registers the `google_calendar` tool. This is the one Google product with no
 * existing pi-package, so Cowork authors it here (epic #180 / B4 #188). Gmail
 * and Drive/Docs/Sheets/Slides are provided by the curated community packages
 * `@e9n/pi-gmail` and `pi-google-workspace`.
 *
 * Auth is brokered by Cowork (one consent, union scopes) and written to the
 * shared `~/.pi/agent/google-workspace/oauth.json`; this tool reads + refreshes
 * that file (see ./auth.ts), so no per-tool setup command is needed.
 *
 * Loaded by DefaultResourceLoader via extensionFactories in index.ts.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCalendarTool } from "./tool.js";

export default async function zosmaGoogleCalendar(pi: ExtensionAPI): Promise<void> {
	pi.registerTool(createCalendarTool());
}
