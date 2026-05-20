import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";
import { OfficeCLIError } from "./tool-types.js";

export const SetElementParams = Type.Object({
	path: Type.String({
		description: "Path to the document to edit",
	}),
	domPath: Type.String({
		description:
			"DOM path to the target element (e.g., /slide[1]/shape[1])",
	}),
	properties: Type.Record(Type.String(), Type.Unknown(), {
		description: "Properties to update on the element",
	}),
	content: Type.Optional(
		Type.String({ description: "Optional new text content" }),
	),
});

export type TSetElementParams = Static<typeof SetElementParams>;

export function createSetElementTool(): ToolDefinition<
	typeof SetElementParams
> {
	return {
		name: "set_element",
		label: "Set Element",
		description: [
			"Update properties and/or text content of an existing document element.",
			"Use with read_document(mode: 'structure') to find element DOM paths.",
			"",
			"Common properties to set:",
			'  font: { name: "Arial", size: 24, bold: true, color: "#333" }',
			'  fill: { color: "#0078D4", transparency: 0.1 }',
			'  position: { x: 100, y: 200 }',
			'  size: { width: 400, height: 300 }',
			"  alignment: 'left' | 'center' | 'right'",
			"  text: { wrap: true, direction: 'horizontal' }",
		].join("\n"),
		promptSnippet: "Update properties and content of existing document elements.",
		promptGuidelines: [
			"Read the document structure first (read_document mode:structure) to find element DOM paths.",
			"Use set_element to change formatting, colors, and text after adding elements.",
			"For batch updates, use batch_edit instead of multiple set_element calls.",
		],
		parameters: SetElementParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();
			try {
				const result = executor.setElement({
					path: params.path,
					domPath: params.domPath,
					properties: params.properties as Record<string, unknown>,
					content: params.content,
				});
				return {
					content: [{ type: "text" as const, text: `✅ Updated ${params.domPath} in ${params.path}` }],
					details: { action: "set_element", domPath: params.domPath },
				};
			} catch (err) {
				if (err instanceof OfficeCLIError) {
					return {
						content: [{ type: "text" as const, text: `Failed: ${err.message}` }],
						details: { error: err.name, stderr: err.stderr },
						isError: true,
					};
				}
				throw err;
			}
		},
	};
}
