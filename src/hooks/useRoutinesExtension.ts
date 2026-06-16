/**
 * useRoutinesExtension — reports when the Tasks scheduler is ready (#289, #300).
 *
 * HISTORY: originally (#289) this hook downloaded + enabled the `pi-routines`
 * npm extension the first time the user opened the Tasks tab (install_extension
 * → set_extension_enabled → reload_sidecar). That runtime install flow is GONE.
 *
 * TODAY (#300): the forked pi-routines scheduler is VENDORED at build time from
 * github.com/zosmaai/pi-routines (see agent-sidecar/scripts/fetch-vendor.mjs)
 * and bundled into the sidecar, where it's injected as an inline extension
 * factory (agent-sidecar/src/index.ts). Nothing is downloaded or installed at
 * runtime, and there is no network call when the user opens Tasks.
 *
 * The hook is therefore a thin status shim: it stays `checking` until the Tasks
 * tab becomes active, then flips to `ready` immediately. The `installing` /
 * `error` states and `retry()` are kept only to satisfy the UI contract
 * consumed by App.tsx + Sidebar.tsx; they are not reachable with the inline
 * factory and exist as defensive fallbacks.
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
