import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";
import { OfficeCLIError } from "./tool-types.js";

export const RemoveElementParams = Type.Object({
	path: Type.String({ description: "Path to the document" }),
	domPath: Type.String({
		description: "DOM path to the element to remove (e.g., /slide[2], /document/body/p[3])",
	}),
});

export type TRemoveElementParams = Static<typeof RemoveElementParams>;

export function createRemoveElementTool(): ToolDefinition<
	typeof RemoveElementParams
> {
	return {
		name: "remove_element",
		label: "Remove Element",
		description:
			"Remove an element (slide, paragraph, row, shape, etc.) from a document. Use read_document(mode: 'structure') to find the DOM path.",
		promptSnippet: "Remove slides, paragraphs, or other elements from documents.",
		promptGuidelines: [
			"Always confirm with the user before removing elements from a document.",
			"Use read_document(mode: 'structure') first to get the correct DOM path.",
		],
		parameters: RemoveElementParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();
			try {
				const result = executor.removeElement({
					path: params.path,
					domPath: params.domPath,
				});
				return {
					content: [{ type: "text" as const, text: `✅ Removed ${params.domPath} from ${params.path}` }],
					details: { action: "remove_element", domPath: params.domPath },
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
