import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";
import { OfficeCLIError } from "./tool-types.js";

export const PreviewDocumentParams = Type.Object({
	path: Type.String({
		description: "Path to the document to preview",
	}),
	browser: Type.Optional(
		Type.Boolean({
			description: "Open in browser (default: true)",
			default: true,
		}),
	),
	port: Type.Optional(
		Type.Number({
			description: "Preview server port (default: 26315)",
			minimum: 1024,
			maximum: 65535,
		}),
	),
});

export type TPreviewDocumentParams = Static<typeof PreviewDocumentParams>;

export function createPreviewDocumentTool(): ToolDefinition<
	typeof PreviewDocumentParams
> {
	return {
		name: "preview_document",
		label: "Preview Document",
		description: [
			"Open a live browser preview of a document.",
			"Uses OfficeCLI's built-in rendering engine to display",
			"the document as HTML. The preview auto-refreshes on changes.",
			"",
			"Useful for visual inspection during document creation:",
			"check slide layouts, color schemes, font sizes, alignment.",
		].join("\n"),
		promptSnippet:
			"Open a live browser preview of a document for visual inspection.",
		promptGuidelines: [
			"Use preview_document before presenting a document to the user.",
			"The preview auto-refreshes — make changes and see them live.",
			"For headless environments, set browser: false to get just the URL.",
		],
		parameters: PreviewDocumentParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();

			try {
				const result = executor.previewDocument({
					path: params.path,
					browser: params.browser !== false,
					port: params.port,
				});

				return {
					content: [
						{
							type: "text" as const,
							text: [
								`🔍 Preview for ${params.path}`,
								`   URL: ${result.url}`,
								params.browser !== false
									? "   (opened in your browser)"
									: "",
								"",
								"The preview auto-refreshes as you make changes.",
							]
								.filter(Boolean)
								.join("\n"),
						},
					],
					details: result,
				};
			} catch (err) {
				if (err instanceof OfficeCLIError) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Preview failed: ${err.message}`,
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
