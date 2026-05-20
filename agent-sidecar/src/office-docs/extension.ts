/**
 * Zosma Cowork — Office Document Generation Extension
 *
 * Registers all OfficeCLI-based document tools into the pi agent session.
 * Tools: create_document, add_element, set_element, remove_element,
 *        read_document, validate_document, batch_edit, preview_document
 *
 * Loaded by DefaultResourceLoader via extensionFactories in index.ts.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAddElementTool } from "./add-element-tool.js";
import { createBatchEditTool } from "./batch-edit-tool.js";
import { createCreateDocumentTool } from "./create-document-tool.js";
import { getOfficeCLIResolver } from "./officecli-resolver.js";
import { createPreviewDocumentTool } from "./preview-document-tool.js";
import { createReadDocumentTool } from "./read-document-tool.js";
import { createRemoveElementTool } from "./remove-element-tool.js";
import { createSetElementTool } from "./set-element-tool.js";
import { createValidateDocumentTool } from "./validate-document-tool.js";

export default async function zosmaOfficeDocs(pi: ExtensionAPI): Promise<void> {
	// On load, check if OfficeCLI is available (non-blocking — don't throw)
	// The tools themselves will resolve OfficeCLI on first use.
	try {
		const resolver = getOfficeCLIResolver();
		const info = resolver.tryResolve();
		if (info) {
			// OfficeCLI is available — good to go
		} else {
			// OfficeCLI not found — tools will auto-download on first use
		}
	} catch {
		// Silently ignore; tools handle resolution on execution
	}

	// ── Register Document Creation Tool ──────────────────────────
	pi.registerTool(createCreateDocumentTool());

	// ── Register Element Manipulation Tools ──────────────────────
	pi.registerTool(createAddElementTool());
	pi.registerTool(createSetElementTool());
	pi.registerTool(createRemoveElementTool());

	// ── Register Inspection Tools ────────────────────────────────
	pi.registerTool(createReadDocumentTool());
	pi.registerTool(createValidateDocumentTool());

	// ── Register Batch & Preview Tools ───────────────────────────
	pi.registerTool(createBatchEditTool());
	pi.registerTool(createPreviewDocumentTool());
}
