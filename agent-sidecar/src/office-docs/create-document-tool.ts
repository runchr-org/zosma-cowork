/**
 * create_document — pi tool definition
 *
 * Creates a new blank Office document (DOCX, PPTX, or XLSX).
 * Type is inferred from file extension if not explicitly set.
 * Optionally accepts a template file path to base the document on.
 */

import { existsSync } from "node:fs";
import { type Static, Type } from "typebox";

// ─── Parameter Schema ───────────────────────────────────────────────

export const CreateDocumentParams = Type.Object({
	path: Type.String({
		description: "Output file path (e.g., ~/Documents/deck.pptx)",
	}),
	type: Type.Optional(
		Type.Union(
			[
				Type.Literal("docx"),
				Type.Literal("pptx"),
				Type.Literal("xlsx"),
			],
			{
				description:
					"Document type. Inferred from file extension if omitted.",
			},
		),
	),
	template: Type.Optional(
		Type.String({
			description: "Optional template file path to base the document on.",
		}),
	),
});

export type TCreateDocumentParams = Static<typeof CreateDocumentParams>;

// ─── Tool Registration ──────────────────────────────────────────────

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";

export function createCreateDocumentTool(): ToolDefinition<
	typeof CreateDocumentParams
> {
	return {
		name: "create_document",
		label: "Create Document",
		description: [
			"Create a new Office document (DOCX, PPTX, or XLSX).",
			"Supports optional template-based creation.",
			"File type is inferred from extension if not specified.",
			"",
			"Examples:",
			'  create_document({ path: "deck.pptx" })',
			'  create_document({ path: "report.docx", template: "~/templates/quarterly.docx" })',
			'  create_document({ path: "budget.xlsx", type: "xlsx" })',
		].join("\n"),
		promptSnippet:
			"Create DOCX, PPTX, or XLSX files using OfficeCLI.",
		promptGuidelines: [
			"Use create_document to create new files before adding content.",
			"Pass an absolute path or relative-to-workspace path.",
			"After creation, use add_element to populate the document.",
		],
		parameters: CreateDocumentParams,
		execute: async (_toolCallId, params) => {
			const path = params.path;
			const type = params.type;

			const executor = getOfficeCLIExecutor();
			const result = executor.createDocument({
				path,
				type,
				template: params.template,
			});

			if (!result.created) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Failed to create document: ${path}. The file may already exist or the path is invalid.`,
					},
				],
				details: { error: "create_failed", path },
				isError: true,
			};
		}

		return {
			content: [
				{
					type: "text" as const,
					text: [
						`✅ Created ${path}`,
						`   Type: ${result.type}`,
						`   Size: ${formatBytes(result.sizeBytes)}`,
						"",
						"Next steps:",
						"  • Use add_element to populate the document",
						"  • Use read_document(mode: 'outline') to verify structure",
						"  • Use preview_document to see it in the browser",
					].join("\n"),
				},
			],
			details: result,
		};
		},
	};
}

// ─── Helper ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}
