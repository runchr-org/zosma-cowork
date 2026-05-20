/**
 * add_element — pi tool definition
 *
 * Adds an element (slide, shape, paragraph, table, image, chart, etc.)
 * to an existing Office document at a specified DOM path.
 *
 * The element type determines available properties. Common types:
 *   - PPTX: slide, shape, textBox, picture, chart, table, connector
 *   - DOCX: paragraph, run, table, image, list, header, footer
 *   - XLSX: sheet, row, cell, chart, pivotTable
 */

import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";
import { OfficeCLIError } from "./tool-types.js";

// ─── Parameter Schema ───────────────────────────────────────────────

const ChildElement = Type.Object({
	element: Type.String({ description: "Child element type" }),
	content: Type.Optional(
		Type.String({ description: "Child element text content" }),
	),
	properties: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), {
			description: "Child element properties",
		}),
	),
});

export const AddElementParams = Type.Object({
	path: Type.String({
		description:
			"Path to the existing document (e.g., ~/Documents/deck.pptx)",
	}),
	domPath: Type.String({
		description: [
			"DOM path specifying where to add the element.",
			"Examples:",
			'  "/slide[1]" — first slide of a PPTX',
			'  "/slide[last]" — last slide',
			'  "/document/body/p[3]" — third paragraph in a DOCX',
			'  "/document/body/table[1]" — first table',
			'  "/sheet[1]/row[1]/cell[1]" — XLSX cell',
		].join("\n"),
	}),
	element: Type.String({
		description: [
			"Element type to add. Depends on document type:",
			"",
			"PPTX elements: slide, shape, textBox, picture, chart, table, connector, group, video, audio, equation, placeholder",
			"DOCX elements: paragraph, run, table, image, list, header, footer, footnote, comment, bookmark, hyperlink, contentControl, formField",
			"XLSX elements: sheet, row, cell, chart, pivotTable, namedRange, dataValidation, conditionalFormatting, sparkline",
		].join("\n"),
	}),
	content: Type.Optional(
		Type.String({
			description: "Text content for the element (e.g., slide title text)",
		}),
	),
	properties: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), {
			description: [
				"Element properties as key-value pairs.",
				"Common properties:",
				"  font: { name, size, bold, italic, color }",
				"  fill: { color, transparency }",
				"  position: { x, y }",
				"  size: { width, height }",
				"  alignment: 'left' | 'center' | 'right'",
				"  layout: 'title' | 'content' | 'twoContent' (PPTX slides)",
			].join("\n"),
		}),
	),
	children: Type.Optional(
		Type.Array(ChildElement, {
			description:
				"Child elements for containers (e.g., table rows, group children)",
		}),
	),
});

export type TAddElementParams = Static<typeof AddElementParams>;

// ─── Tool Registration ──────────────────────────────────────────────

export function createAddElementTool(): ToolDefinition<
	typeof AddElementParams
> {
	return {
		name: "add_element",
		label: "Add Element",
		description: [
			"Add an element (slide, paragraph, table, chart, shape, etc.)",
			"to an existing Office document at a specified DOM path.",
			"",
			"Each document type supports specific element types.",
			"Use read_document(mode: 'structure') to see the full DOM tree.",
		].join("\n"),
		promptSnippet:
			"Add slides, paragraphs, tables, charts, and other elements to documents.",
		promptGuidelines: [
			"Always use add_element after create_document to populate content.",
			"Use domPath /slide[last] to append slides to PPTX files.",
			"Use domPath /document/body/p[last] to append paragraphs to DOCX.",
			"Set font, alignment, and color via the properties parameter.",
			"For PPTX slides, set layout via properties.layout.",
		],
		parameters: AddElementParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();

			try {
				const result = executor.addElement({
					path: params.path,
					domPath: params.domPath,
					element: params.element,
					content: params.content,
					properties: params.properties as Record<string, unknown> | undefined,
					children: params.children as
						| Array<{
								element: string;
								content?: string;
								properties?: Record<string, unknown>;
						  }>
						| undefined,
				});

				return {
					content: [
						{
							type: "text" as const,
							text: [
								`✅ Added ${params.element} to ${params.path}`,
								`   DOM path: ${params.domPath}`,
								result.stdout
									? `   ${result.stdout.trim()}`
									: "",
							]
								.filter(Boolean)
								.join("\n"),
						},
					],
					details: { action: "add_element", domPath: params.domPath },
				};
			} catch (err) {
				if (err instanceof OfficeCLIError) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Failed to add element: ${err.message}`,
							},
						],
						details: { error: err.name, stderr: err.stderr },
						isError: true,
					};
				}
				throw err;
			}
		},
	};
}
