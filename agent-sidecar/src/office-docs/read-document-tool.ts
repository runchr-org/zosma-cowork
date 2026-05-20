import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";
import { OfficeCLIError } from "./tool-types.js";

export const ReadDocumentParams = Type.Object({
	path: Type.String({ description: "Path to the document" }),
	mode: Type.Union(
		[
			Type.Literal("outline"),
			Type.Literal("text"),
			Type.Literal("html"),
			Type.Literal("annotated"),
			Type.Literal("issues"),
			Type.Literal("structure"),
		],
		{
			description: [
				"View mode for the document:",
				"  outline   — text outline (quick overview)",
				"  text      — full text content",
				"  html      — HTML rendering (for visual inspection)",
				"  annotated — text with formatting annotations",
				"  issues    — quality/formatting/structure problem detection",
				"  structure — document DOM tree",
			].join("\n"),
		},
	),
	issueType: Type.Optional(
		Type.Union(
			[Type.Literal("format"), Type.Literal("content"), Type.Literal("structure")],
			{ description: "Filter issues by type (only in issues mode)" },
		),
	),
	limit: Type.Optional(
		Type.Number({
			description: "Max results (only in issues mode)",
			minimum: 1,
			maximum: 100,
		}),
	),
});

export type TReadDocumentParams = Static<typeof ReadDocumentParams>;

export function createReadDocumentTool(): ToolDefinition<
	typeof ReadDocumentParams
> {
	return {
		name: "read_document",
		label: "Read Document",
		description: [
			"Inspect a document in various modes.",
			"Use 'outline' for a quick text summary.",
			"Use 'structure' to see the full DOM tree for editing.",
			"Use 'issues' to detect formatting, content, or structure problems.",
			"Use 'html' to render the document for visual review.",
		].join("\n"),
		promptSnippet:
			"Inspect documents: view outline, structure, issues, or rendered HTML.",
		promptGuidelines: [
			"After creating a document, use read_document(mode: 'outline') to verify content.",
			"Before editing, use read_document(mode: 'structure') to find correct DOM paths.",
			"Before delivering, use read_document(mode: 'issues') to check quality.",
			"Use read_document(mode: 'html') for visual inspection of layouts.",
		],
		parameters: ReadDocumentParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();

			if (params.mode === "issues") {
				try {
					const result = executor.readDocument({
						path: params.path,
						mode: "issues",
						issueType: params.issueType,
						limit: params.limit,
					});
					return {
						content: [
							{
								type: "text" as const,
								text: [
									`📋 Issues for ${params.path}`,
									"",
									result.stdout || "No issues found.",
								].join("\n"),
							},
						],
						details: { mode: "issues" },
					};
				} catch (err) {
					if (err instanceof OfficeCLIError) {
						return {
							content: [{ type: "text" as const, text: err.stderr || err.message }],
							details: { mode: "issues", error: err.name },
							isError: true,
						};
					}
					throw err;
				}
			}

			try {
				const result = executor.readDocument({
					path: params.path,
					mode: params.mode,
				});

				const modeLabel =
					params.mode.charAt(0).toUpperCase() + params.mode.slice(1);
				return {
					content: [
						{
							type: "text" as const,
							text: [
								`📄 ${modeLabel} of ${params.path}`,
								"",
								result.stdout || "(empty)",
							].join("\n"),
						},
					],
					details: { mode: params.mode },
				};
			} catch (err) {
				if (err instanceof OfficeCLIError) {
					return {
						content: [{ type: "text" as const, text: err.stderr || err.message }],
						details: { mode: params.mode, error: err.name },
						isError: true,
					};
				}
				throw err;
			}
		},
	};
}
