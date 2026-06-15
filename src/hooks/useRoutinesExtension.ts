/**
 * useRoutinesExtension — ensures the `pi-routines` extension is installed &
 * enabled the first time the user opens the Tasks tab (#289).
 *
 * Tasks are powered by the pi-routines pi-extension: it gives the agent the
 * `cron_create` tool and runs the scheduler that fires tasks. It isn't part of
 * the default package set, so rather than make the user hunt for it in the
 * Extensions screen, the Tasks tab transparently installs + enables it on first
 * visit and shows a short "setting up" state while that happens.
 *
 * Bringing it online needs three steps (install/enable only mutate config):
 *   1. install_extension (if missing) — adds the npm package + registry entry.
 *   2. set_extension_enabled (if present but disabled).
 *   3. reload_sidecar — re-inits the agent so cron_create + the scheduler load
 *      into the live session. We only reload when we actually changed something,
 *      so re-opening Tasks later is a cheap no-op.
 *
 * The check runs once per app session, gated on `active` (the Tasks tab being
 * selected), so nothing is installed until the user actually wants Tasks.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** npm package id of the routines/scheduler extension. */
export const ROUTINES_PKG = "pi-routines";

export type RoutinesStatus = "checking" | "installing" | "ready" | "error";

interface UseRoutinesExtensionReturn {
	/** Lifecycle of the ensure flow; gate the Tasks UI on `"ready"`. */
	status: RoutinesStatus;
	/** Error message when `status === "error"`. */
	error: string | null;
	/** Re-run the ensure flow (e.g. from a "Try again" button). */
	retry: () => void;
}

export function useRoutinesExtension(active: boolean): UseRoutinesExtensionReturn {
	const [status, setStatus] = useState<RoutinesStatus>("checking");
	const [error, setError] = useState<string | null>(null);
	const ranRef = useRef(false);

	useEffect(() => {
		if (!active || ranRef.current) return;
		ranRef.current = true;
		// pi-routines is always loaded as an inline factory in Cowork (#300).
		// No need to install from npm or enable — it's always ready.
		setStatus("ready");
	}, [active]);

	const retry = useCallback(() => {
		setError(null);
		setStatus("ready");
	}, []);

	return { status, error, retry };
}
