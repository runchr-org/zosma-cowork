import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { getOfficeCLIExecutor } from "./officecli-executor.js";

export const ValidateDocumentParams = Type.Object({
	path: Type.String({
		description: "Path to the document to validate",
	}),
});

export type TValidateDocumentParams = Static<typeof ValidateDocumentParams>;

export function createValidateDocumentTool(): ToolDefinition<
	typeof ValidateDocumentParams
> {
	return {
		name: "validate_document",
		label: "Validate Document",
		description: [
			"Validate a document against the OpenXML schema.",
			"Checks structural integrity, formatting compliance, and content consistency.",
			"Returns a list of issues (errors, warnings, info) with severity levels.",
		].join("\n"),
		promptSnippet:
			"Validate documents against OpenXML schema before delivery.",
		promptGuidelines: [
			"Always validate a document before presenting it to the user as complete.",
			"If validation finds errors, fix them using set_element or remove_element.",
			"Run a final validate after all fixes are applied.",
		],
		parameters: ValidateDocumentParams,
		execute: async (_toolCallId, params) => {
			const executor = getOfficeCLIExecutor();
			const result = executor.validateDocument({ path: params.path });

			if (result.valid) {
				return {
					content: [
						{
							type: "text" as const,
							text: `✅ ${params.path} — document is valid\n   Schema: ${result.schemaValid ? "valid" : "issues"}`,
						},
					],
					details: result,
				};
			}

			const issueLines = result.issues.map(
				(i) => `  [${i.severity.toUpperCase()}] ${i.message}`,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: [
							`⚠️ ${params.path} — ${result.issues.length} issue(s) found`,
							...issueLines,
							"",
							"Fix issues with set_element or remove_element, then re-validate.",
						].join("\n"),
					},
				],
				details: result,
				isError: result.issues.some((i) => i.severity === "error"),
			};
		},
	};
}
