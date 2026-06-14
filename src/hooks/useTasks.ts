/**
 * useTasks — React hook for the pi-routines Tasks bridge (#288).
 *
 * Bridges the sidecar's `tasks_*` commands (which read/write the active cwd's
 * `.pi/scheduled_tasks.json` directly, no LLM round-trip) to React state, and
 * refetches live on the `tasks_changed` push event the sidecar emits when the
 * file changes (a task fires, or the bridge edits it).
 *
 * No UI yet — that's #289. This hook + its test are the data layer it builds on.
 */

import type { Task } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

import { retryOnClosed } from "@/lib/utils";

interface UseTasksReturn {
	/** All durable tasks (enabled first, then paused). */
	tasks: Task[];
	/** Initial-load / refresh in flight. */
	loading: boolean;
	/** Last error message, if any. */
	error: string | null;

	/** Refetch the task list from the sidecar. */
	refresh: () => Promise<void>;
	/** Delete a task by id. */
	del: (taskId: string) => Promise<void>;
	/** Pause (false) or resume (true) a task by id. */
	setEnabled: (taskId: string, enabled: boolean) => Promise<void>;
	/** Fire a task on pi-routines' next poll (sets nextRunAt into the past). */
	runNow: (taskId: string) => Promise<void>;
	/** Clear the current error. */
	clearError: () => void;
}

export function useTasks(): UseTasksReturn {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await retryOnClosed(() =>
				invoke<{ tasks?: Task[] } | Task[]>("tasks_list"),
			);
			const list = Array.isArray(result)
				? result
				: (result as { tasks?: Task[] }).tasks || [];
			setTasks(list);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	// Live updates: the sidecar emits `tasks_changed` whenever the task file
	// changes (pi-routines fires a task, or the bridge mutates it). Refetch.
	useEffect(() => {
		let unlisten: (() => void) | undefined;
		let mounted = true;
		listen("tasks_changed", () => {
			refresh();
		}).then((fn) => {
			if (mounted) unlisten = fn;
			else fn();
		});
		return () => {
			mounted = false;
			unlisten?.();
		};
	}, [refresh]);

	const del = useCallback(
		async (taskId: string) => {
			setError(null);
			try {
				await invoke("tasks_delete", { taskId });
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[refresh],
	);

	const setEnabled = useCallback(async (taskId: string, enabled: boolean) => {
		setError(null);
		try {
			await invoke("tasks_set_enabled", { taskId, enabled });
			// Optimistic; the `tasks_changed` event reconciles authoritatively.
			setTasks((prev) =>
				prev.map((t) => (t.id === taskId ? { ...t, enabled } : t)),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	const runNow = useCallback(async (taskId: string) => {
		setError(null);
		try {
			await invoke("tasks_run_now", { taskId });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	const clearError = useCallback(() => setError(null), []);

	return {
		tasks,
		loading,
		error,
		refresh,
		del,
		setEnabled,
		runNow,
		clearError,
	};
}
