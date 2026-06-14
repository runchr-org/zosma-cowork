/**
 * tasks-store — sidecar bridge for the pi-routines scheduled-task store.
 *
 * The Tasks UI must read/write scheduled tasks WITHOUT round-tripping the LLM.
 * pi-routines exposes `cron_create`/`cron_delete`/`cron_list` only as *agent
 * tools* (LLM-facing) and has no `set_enabled`/`run_now` tool at all, so this
 * module talks to pi-routines' on-disk source of truth directly:
 *
 *   <cwd>/.pi/scheduled_tasks.json    ← pi-routines' durable task file.
 *
 * pi-routines hot-reloads that file via chokidar (its 1s scheduler poll fires
 * any task whose `nextRunAt` is in the past), so writing the file by hand is a
 * fully supported way to drive it — this is exactly what the #286 spike harness
 * proved.
 *
 * ── enabled / paused semantics ──────────────────────────────────────────────
 * pi-routines has NO `enabled`/`paused` concept: every task in `tasks[]` with a
 * `nextRunAt` fires, and its scheduler RE-DERIVES `nextRunAt` from the cron
 * `schedule` whenever it's missing. Worse, pi-routines' own `writeDurableFile`
 * only persists `{ version, tasks }` — any extra top-level key we add (e.g. a
 * `disabled` array) is silently wiped the next time *any* task fires.
 *
 * So "pause" can't live inside `scheduled_tasks.json`. Instead the bridge keeps
 * paused tasks in a SEPARATE, bridge-owned file pi-routines never touches:
 *
 *   <cwd>/.pi/scheduled_tasks_disabled.json
 *
 * `set_enabled(false)` MOVES a task out of `scheduled_tasks.json` into the
 * disabled file (so pi-routines stops seeing it); `set_enabled(true)` moves it
 * back (stripping `nextRunAt` so pi-routines recomputes a fresh forward run).
 * This survives pi-routines' file rewrites because the two files are disjoint.
 *
 * Session (in-memory) tasks live inside pi-routines' process and aren't on disk,
 * so they're out of scope for this MVP bridge (durable tasks only).
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	type FSWatcher,
	watch,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type TaskType = "durable" | "session";

/** Mirrors pi-routines' `ScheduledTask` (src/cronTasks.ts). */
export interface ScheduledTask {
	id: string;
	name: string;
	/** cron expression, e.g. "* * * * *" */
	schedule: string;
	/** message sent to the agent when the task fires */
	prompt: string;
	type: TaskType;
	/** ISO timestamp */
	createdAt: string;
	lastRunAt?: string;
	nextRunAt?: string;
	recurring: boolean;
	/** auto-expire recurring tasks after N days of inactivity (0 = permanent) */
	maxAgeDays: number;
	sessionId?: string;
}

/** A task plus the bridge-derived `enabled` flag the UI renders. */
export interface BridgeTask extends ScheduledTask {
	enabled: boolean;
}

interface DurableTaskFile {
	version: 1;
	tasks: ScheduledTask[];
}

/** pi-routines' durable task file: `<cwd>/.pi/scheduled_tasks.json`. */
export function tasksFilePath(cwd: string): string {
	return join(cwd, ".pi", "scheduled_tasks.json");
}

/** Bridge-owned paused-task file: `<cwd>/.pi/scheduled_tasks_disabled.json`. */
export function disabledTasksFilePath(cwd: string): string {
	return join(cwd, ".pi", "scheduled_tasks_disabled.json");
}

/**
 * Read a `{ version: 1, tasks: [...] }` file, tolerant of an absent/corrupt
 * file (returns an empty store). Mirrors pi-routines' own `readDurableFile`.
 */
function readTaskFile(path: string): DurableTaskFile {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		if (parsed && parsed.version === 1 && Array.isArray(parsed.tasks)) {
			return parsed as DurableTaskFile;
		}
	} catch {
		// absent or malformed — treat as empty
	}
	return { version: 1, tasks: [] };
}

/** Write a task file (pretty-printed), creating `.pi/` if needed. */
function writeTaskFile(path: string, data: DurableTaskFile): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * List all durable tasks for `cwd`: enabled tasks (from pi-routines'
 * `scheduled_tasks.json`) annotated `enabled: true`, followed by paused tasks
 * (from the bridge's disabled file) annotated `enabled: false`.
 */
export function listTasks(cwd: string): BridgeTask[] {
	const active = readTaskFile(tasksFilePath(cwd)).tasks.map((t) => ({
		...t,
		enabled: true,
	}));
	const disabled = readTaskFile(disabledTasksFilePath(cwd)).tasks.map((t) => ({
		...t,
		enabled: false,
	}));
	return [...active, ...disabled];
}

/**
 * Delete a task by id from whichever file holds it. Returns `true` if a task
 * was removed.
 */
export function deleteTask(cwd: string, taskId: string): boolean {
	for (const path of [tasksFilePath(cwd), disabledTasksFilePath(cwd)]) {
		const file = readTaskFile(path);
		const before = file.tasks.length;
		file.tasks = file.tasks.filter((t) => t.id !== taskId);
		if (file.tasks.length < before) {
			writeTaskFile(path, file);
			return true;
		}
	}
	return false;
}

/**
 * Pause/resume a task by MOVING it between the active file and the bridge's
 * disabled file (see module header for why a flag in-file can't work).
 *
 * - `enabled: false` → move active → disabled (pi-routines stops seeing it).
 * - `enabled: true`  → move disabled → active, clearing `nextRunAt` so
 *   pi-routines recomputes the next run from the cron `schedule`.
 *
 * No-op (returns `true`) if the task is already in the requested state.
 * Returns `false` if the task id exists in neither file.
 */
export function setTaskEnabled(
	cwd: string,
	taskId: string,
	enabled: boolean,
): boolean {
	const activePath = tasksFilePath(cwd);
	const disabledPath = disabledTasksFilePath(cwd);
	const from = enabled ? disabledPath : activePath;
	const to = enabled ? activePath : disabledPath;

	const fromFile = readTaskFile(from);
	const task = fromFile.tasks.find((t) => t.id === taskId);

	if (!task) {
		// Already in the destination state? Treat as a successful no-op.
		const toFile = readTaskFile(to);
		return toFile.tasks.some((t) => t.id === taskId);
	}

	// Remove from source.
	fromFile.tasks = fromFile.tasks.filter((t) => t.id !== taskId);

	// Add to destination. When re-enabling, drop nextRunAt so pi-routines
	// derives a fresh forward run rather than firing a stale backlog.
	const moved: ScheduledTask = { ...task };
	if (enabled) delete moved.nextRunAt;

	const toFile = readTaskFile(to);
	toFile.tasks = toFile.tasks.filter((t) => t.id !== taskId);
	toFile.tasks.push(moved);

	// Write destination first, then source: if we crash between writes the task
	// is briefly visible in both files (harmless dup) rather than lost.
	writeTaskFile(to, toFile);
	writeTaskFile(from, fromFile);
	return true;
}

/**
 * Fire a task on pi-routines' next poll by setting its `nextRunAt` ~5s in the
 * past (the exact trick the #286 spike used). Only operates on ENABLED tasks —
 * a paused task must be re-enabled first.
 *
 * Returns `false` if the id isn't an enabled task. Throws if the id refers to a
 * disabled task (so the UI can surface "enable it first").
 */
export function runTaskNow(cwd: string, taskId: string): boolean {
	const activePath = tasksFilePath(cwd);
	const file = readTaskFile(activePath);
	const task = file.tasks.find((t) => t.id === taskId);

	if (!task) {
		const disabled = readTaskFile(disabledTasksFilePath(cwd));
		if (disabled.tasks.some((t) => t.id === taskId)) {
			throw new Error(
				`Task ${taskId} is disabled — enable it before running it now.`,
			);
		}
		return false;
	}

	task.nextRunAt = new Date(Date.now() - 5000).toISOString();
	writeTaskFile(activePath, file);
	return true;
}

/** Filenames (under `.pi/`) whose changes should push a `tasks_changed`. */
const WATCHED_FILES = new Set([
	basename(tasksFilePath(".")),
	basename(disabledTasksFilePath(".")),
]);

/**
 * Watch `<cwd>/.pi/` for task-file changes and invoke `onChange` (debounced).
 *
 * Uses Node's built-in `fs.watch` rather than chokidar (which pi-routines pulls
 * in but isn't resolvable from the Cowork sidecar's own package). We watch the
 * `.pi` DIRECTORY, not the file, so a not-yet-created `scheduled_tasks.json`
 * still triggers once pi-routines (or the bridge) writes it. Returns a closer.
 */
export function watchTaskFiles(
	cwd: string,
	onChange: () => void,
	debounceMs = 150,
): () => void {
	const dir = join(cwd, ".pi");
	if (!existsSync(dir)) {
		try {
			mkdirSync(dir, { recursive: true });
		} catch {
			// best-effort: if we can't create it, watch will simply no-op below
		}
	}

	let timer: ReturnType<typeof setTimeout> | null = null;
	const fire = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			try {
				onChange();
			} catch {
				// listener errors must not kill the watcher
			}
		}, debounceMs);
	};

	let watcher: FSWatcher | null = null;
	try {
		watcher = watch(dir, (_event, filename) => {
			// `filename` can be null on some platforms — fire conservatively then.
			if (filename == null || WATCHED_FILES.has(String(filename))) fire();
		});
	} catch {
		// Directory unwatchable (e.g. removed); caller gets a no-op closer.
	}

	return () => {
		if (timer) clearTimeout(timer);
		watcher?.close();
	};
}
