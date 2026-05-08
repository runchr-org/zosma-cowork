/**
 * ToolCallTimeline — Flat inline tool execution display matching pi's TUI.
 *
 * Design:
 *   - No borders, no rounded corners, no accordion
 *   - Subtle background tint, thin left accent bar
 *   - Clean text headers: "write ~/path (stats)" with status below
 *   - Side-by-side diff for edit/write with line numbers
 *   - Bash shows $ command then output
 *   - Read shows file content directly
 */

import type { ToolCallInfo } from "@/types";
import { Loader2, AlertCircle, Check } from "lucide-react";

// ─── Main timeline ──────────────────────────────────────────────────

interface ToolCallTimelineProps {
	toolCalls: ToolCallInfo[];
}

export function ToolCallTimeline({ toolCalls }: ToolCallTimelineProps) {
	if (toolCalls.length === 0) return null;
	return (
		<div className="flex flex-col gap-1 my-1.5">
			{toolCalls.map((tc) => (
				<ToolCallBlock key={tc.id} toolCall={tc} />
			))}
		</div>
	);
}

// ─── Single tool block ──────────────────────────────────────────────

function ToolCallBlock({ toolCall }: { toolCall: ToolCallInfo }) {
	const isRunning = toolCall.status === "running";
	const isError = toolCall.status === "error";

	const accentColor = isRunning
		? "hsl(var(--tool-running-fg))"
		: isError
			? "hsl(var(--tool-error-fg))"
			: "hsl(var(--tool-complete-fg))";

	const bgColor = isRunning
		? "hsl(var(--tool-running-bg))"
		: isError
			? "hsl(var(--tool-error-bg))"
			: "hsl(var(--tool-complete-bg))";

	const { header, statusLine } = buildHeader(toolCall);

	return (
		<div
			className="text-xs font-mono"
			style={{
				background: bgColor,
				borderLeft: `2px solid ${accentColor}`,
			}}
		>
			{/* Header line */}
			<div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
				{isRunning ? (
					<Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: accentColor }} />
				) : isError ? (
					<AlertCircle className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
				) : (
					<Check className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
				)}
				<span className="opacity-90">{header}</span>
			</div>

			{/* Status sub-line */}
			{statusLine && (
				<div className="px-2 pb-1 opacity-60">{statusLine}</div>
			)}

			{/* Content */}
			<div className="px-2 pb-1.5">
				<ToolContent toolCall={toolCall} />
			</div>
		</div>
	);
}

// ─── Build header text per tool ─────────────────────────────────────

function buildHeader(tc: ToolCallInfo): { header: string; statusLine?: string } {
	const args = tc.args;

	switch (tc.name) {
		case "write": {
			const path = str(args.path) || str(args.file_path) || "";
			const content = str(args.content) || "";
			const lines = lineCount(content);
			const size = formatSize(new Blob([content]).size);
			return {
				header: `write ${shortenPath(path)} (${lines} lines · ${size})`,
				statusLine: tc.status === "completed" ? "└ overwritten" : undefined,
			};
		}

		case "edit": {
			const path = str(args.path) || str(args.file_path) || "";
			const edits = Array.isArray(args.edits) ? args.edits : [];
			const lineCount = edits.reduce(
				(sum: number, e: Record<string, unknown>) => sum + countLines(str(e.newText) || ""),
				0,
			);
			const { added, removed } = diffStats(tc.result || "");
			return {
				header: `edit ${shortenPath(path)} (${lineCount} lines)`,
				statusLine:
					tc.status === "completed"
						? `└ diff +${added} -${removed} split`
						: undefined,
			};
		}

		case "read": {
			const path = str(args.path) || str(args.file_path) || "";
			const offset = num(args.offset);
			const limit = num(args.limit);
			let range = "";
			if (offset || limit) {
				const from = offset ?? 1;
				const to = limit ? from + limit - 1 : undefined;
				range = `:${from}${to ? `-${to}` : ""}`;
			}
			return { header: `read ${shortenPath(path)}${range}` };
		}

		case "bash": {
			const cmd = str(args.command) || "";
			const display = cmd.length > 80 ? `${cmd.slice(0, 77)}...` : cmd;
			return { header: `bash $ ${display}` };
		}

		case "grep": {
			const pattern = str(args.pattern) || "";
			const scope = shortenPath(str(args.path) || ".");
			return { header: `grep /${pattern}/ in ${scope}` };
		}

		case "find": {
			const pattern = str(args.pattern) || "";
			const scope = shortenPath(str(args.path) || ".");
			return { header: `find ${pattern} in ${scope}` };
		}

		case "ls": {
			const path = shortenPath(str(args.path) || ".");
			return { header: `ls ${path}` };
		}

		case "web_search":
		case "code_search": {
			const q = str(args.query) || (Array.isArray(args.queries) ? (args.queries as string[]).join(", ") : "");
			return { header: `${tc.name} ${q.slice(0, 80)}` };
		}

		case "fetch_content": {
			const url = str(args.url) || "";
			return { header: `fetch ${url.slice(0, 80)}` };
		}

		default: {
			return { header: `${tc.name}` };
		}
	}
}

// ─── Render tool-specific content ───────────────────────────────────

function ToolContent({ toolCall }: { toolCall: ToolCallInfo }) {
	const isRunning = toolCall.status === "running";

	// Running: show partial output
	if (isRunning && toolCall.partialOutput) {
		return (
			<pre className="text-[11px] opacity-60 whitespace-pre-wrap">
				{truncate(toolCall.partialOutput, 800)}
			</pre>
		);
	}

	// No result yet
	if (toolCall.result === undefined || toolCall.result === "") {
		return null;
	}

	// Edit/write with diff
	if ((toolCall.name === "edit" || toolCall.name === "write") && isDiff(toolCall.result)) {
		return <SplitDiff diffText={toolCall.result} />;
	}

	// Read result — try to show as code block with line numbers
	if (toolCall.name === "read") {
		return <CodeBlock content={toolCall.result} />;
	}

	// Bash error
	if (toolCall.name === "bash" && toolCall.status === "error") {
		return (
			<pre className="text-[11px] whitespace-pre-wrap" style={{ color: "hsl(var(--destructive))" }}>
				{truncate(toolCall.result, 3000)}
			</pre>
		);
	}

	// Default
	return (
		<pre className="text-[11px] whitespace-pre-wrap opacity-80">
			{truncate(toolCall.result, 3000)}
		</pre>
	);
}

// ─── Side-by-side diff viewer ───────────────────────────────────────

interface DiffLine {
	oldNum: number | null;
	newNum: number | null;
	type: "context" | "add" | "remove" | "header" | "hunk";
	text: string;
}

function parseUnifiedDiff(diffText: string): DiffLine[][] {
	const lines = diffText.split("\n");
	const hunks: DiffLine[][] = [];
	let currentHunk: DiffLine[] = [];
	let oldLine = 0;
	let newLine = 0;

	for (const line of lines) {
		if (line.startsWith("+++ ") || line.startsWith("--- ")) {
			if (currentHunk.length > 0) {
				hunks.push(currentHunk);
				currentHunk = [];
			}
			currentHunk.push({ oldNum: null, newNum: null, type: "header", text: line });
			continue;
		}

		if (line.startsWith("@@")) {
			if (currentHunk.length > 0 && currentHunk.some((l) => l.type !== "header")) {
				hunks.push(currentHunk);
				currentHunk = [];
			}
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			oldLine = match ? Number.parseInt(match[1], 10) : 0;
			newLine = match ? Number.parseInt(match[2], 10) : 0;
			currentHunk.push({ oldNum: null, newNum: null, type: "hunk", text: line });
			continue;
		}

		if (line.startsWith("+")) {
			currentHunk.push({ oldNum: null, newNum: newLine++, type: "add", text: line.slice(1) });
		} else if (line.startsWith("-")) {
			currentHunk.push({ oldNum: oldLine++, newNum: null, type: "remove", text: line.slice(1) });
		} else if (line.startsWith(" ")) {
			currentHunk.push({
				oldNum: oldLine++,
				newNum: newLine++,
				type: "context",
				text: line.slice(1),
			});
		} else if (line === "") {
			currentHunk.push({ oldNum: oldLine++, newNum: newLine++, type: "context", text: "" });
		} else {
			currentHunk.push({ oldNum: null, newNum: null, type: "context", text: line });
		}
	}

	if (currentHunk.length > 0) hunks.push(currentHunk);
	return hunks;
}

function SplitDiff({ diffText }: { diffText: string }) {
	const hunks = parseUnifiedDiff(diffText);
	if (hunks.length === 0) return null;

	return (
		<div className="mt-1 overflow-x-auto">
			{hunks.map((hunk) => (
				<div key={hunk[0]?.text || hunk[0]?.type} className="min-w-[500px]">
					{/* Hunk header */}
					{hunk[0]?.type === "hunk" && (
						<div className="text-[10px] opacity-50 py-0.5">{hunk[0].text}</div>
					)}
					{/* Side-by-side rows */}
					<div className="grid grid-cols-2 gap-px">
						{/* Old column header */}
						<div className="text-[10px] opacity-40 px-1 border-b border-border/30">old</div>
						<div className="text-[10px] opacity-40 px-1 border-b border-border/30">new</div>
						{/* Lines */}
						{hunk
							.filter((l) => l.type !== "header" && l.type !== "hunk")
							.map((line) => (
								<DiffRow key={`${line.oldNum ?? 'n'}-${line.newNum ?? 'n'}-${line.text.slice(0, 20)}`} line={line} />
							))}
					</div>
				</div>
			))}
		</div>
	);
}

function DiffRow({ line }: { line: DiffLine }) {
	const removeBg = "hsl(var(--diff-removed-bg))";
	const removeFg = "hsl(var(--diff-removed-fg))";
	const addBg = "hsl(var(--diff-added-bg))";
	const addFg = "hsl(var(--diff-added-fg))";
	const contextFg = "hsl(var(--diff-context-fg))";

	if (line.type === "remove") {
		return (
			<>
				<div className="px-1 flex gap-1" style={{ background: removeBg, color: removeFg }}>
					<span className="opacity-40 w-6 text-right flex-shrink-0">{line.oldNum}</span>
					<span className="truncate">{line.text || " "}</span>
				</div>
				<div className="px-1" style={{ background: removeBg }} />
			</>
		);
	}

	if (line.type === "add") {
		return (
			<>
				<div className="px-1" style={{ background: addBg }} />
				<div className="px-1 flex gap-1" style={{ background: addBg, color: addFg }}>
					<span className="opacity-40 w-6 text-right flex-shrink-0">{line.newNum}</span>
					<span className="truncate">{line.text || " "}</span>
				</div>
			</>
		);
	}

	// Context
	return (
		<>
			<div className="px-1 flex gap-1" style={{ color: contextFg }}>
				<span className="opacity-40 w-6 text-right flex-shrink-0">{line.oldNum}</span>
				<span className="truncate">{line.text || " "}</span>
			</div>
			<div className="px-1 flex gap-1" style={{ color: contextFg }}>
				<span className="opacity-40 w-6 text-right flex-shrink-0">{line.newNum}</span>
				<span className="truncate">{line.text || " "}</span>
			</div>
		</>
	);
}

// ─── Code block with line numbers ───────────────────────────────────

function CodeBlock({ content }: { content: string }) {
	const lines = content.split("\n");
	const startNum = 1;

	return (
		<div className="mt-1 overflow-x-auto">
			<div className="min-w-[300px]">
				{lines.map((line, idx) => (
					<div key={`L${startNum + idx}`} className="flex gap-2 text-[11px]">
						<span className="opacity-30 w-8 text-right flex-shrink-0 select-none">
							{startNum + idx}
						</span>
						<span className="whitespace-pre opacity-80">{line || " "}</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Compact summary (for message header) ───────────────────────────

export function ToolCallSummary({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
	const running = toolCalls.filter((tc) => tc.status === "running").length;
	const completed = toolCalls.filter((tc) => tc.status === "completed").length;
	const errors = toolCalls.filter((tc) => tc.status === "error").length;

	const parts: string[] = [];
	if (completed > 0) parts.push(`${completed} done`);
	if (running > 0) parts.push(`${running} running`);
	if (errors > 0) parts.push(`${errors} failed`);

	return (
		<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
			<span className="text-muted-foreground/60">●</span>
			{toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""}
			{parts.length > 0 && (
				<>
					<span className="text-muted-foreground/40">·</span>
					{parts.join(" · ")}
				</>
			)}
		</span>
	);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function str(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	return undefined;
}

function num(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	return undefined;
}

function shortenPath(path: string): string {
	if (!path) return "...";
	return path
		.replace(/^\/home\/[^/]+\//, "~/")
		.replace(/^\/Users\/[^/]+\//, "~/")
		.replace(/^C:\\Users\\[^/\\]+\\/, "~/");
}

function lineCount(text: string): number {
	if (!text) return 0;
	return text.split("\n").length;
}

function countLines(text: string): number {
	return lineCount(text);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function diffStats(diffText: string): { added: number; removed: number } {
	const lines = diffText.split("\n");
	let added = 0;
	let removed = 0;
	for (const line of lines) {
		if (line.startsWith("+") && !line.startsWith("+++")) added++;
		if (line.startsWith("-") && !line.startsWith("---")) removed++;
	}
	return { added, removed };
}

function isDiff(text: string): boolean {
	return (
		text.includes("\n+") ||
		text.includes("\n-") ||
		text.includes("@@ ") ||
		text.includes("+++ ") ||
		text.includes("--- ")
	);
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... (${text.length - max} more chars)`;
}
