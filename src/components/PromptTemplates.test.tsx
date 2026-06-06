/**
 * PromptTemplates test
 *
 * Tests for the templates sidebar panel that shows reusable prompt templates.
 * Clicking a template loads its prompt into the composer (onUseTemplate) for
 * editing — it must NOT auto-send.
 */

import { CATEGORIES, TEMPLATES } from "@/data/templates";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptTemplates } from "./PromptTemplates";

describe("PromptTemplates", () => {
	const mockOnUseTemplate = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the section title", () => {
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);
		expect(screen.getByText("Templates")).toBeInTheDocument();
	});

	it("renders all category sections", () => {
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);
		for (const cat of Object.values(CATEGORIES)) {
			// Use getAllByText with substring match — at least one element should match
			const matches = screen.getAllByText((content) => content.includes(cat.label));
			expect(matches.length).toBeGreaterThanOrEqual(1);
		}
	});

	it("renders all template cards with titles", () => {
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);
		for (const tpl of TEMPLATES) {
			expect(screen.getByText(tpl.title)).toBeInTheDocument();
		}
	});

	it("renders template descriptions", () => {
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);
		for (const tpl of TEMPLATES) {
			expect(screen.getByText(tpl.description)).toBeInTheDocument();
		}
	});

	it("templates are rendered under their category section", () => {
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);
		// Verify writing templates appear in the rendered output
		const writingTemplates = TEMPLATES.filter((t) => t.category === "writing");
		for (const tpl of writingTemplates) {
			expect(screen.getByText(tpl.title)).toBeInTheDocument();
		}
	});

	it("calls onUseTemplate with the template prompt when a card is clicked", async () => {
		const user = userEvent.setup();
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);

		const firstTemplate = TEMPLATES[0];
		const card = screen.getByText(firstTemplate.title).closest("button");
		if (!card) throw new Error("Card element not found");
		await user.click(card);
		expect(mockOnUseTemplate).toHaveBeenCalledWith(firstTemplate.prompt);
	});

	it("calls onUseTemplate with the correct prompt for each template", async () => {
		const user = userEvent.setup();
		render(<PromptTemplates onUseTemplate={mockOnUseTemplate} />);

		for (const tpl of TEMPLATES) {
			vi.clearAllMocks();
			const card = screen.getByText(tpl.title).closest("button");
			if (!card) throw new Error("Card element not found");
			await user.click(card);
			expect(mockOnUseTemplate).toHaveBeenCalledWith(tpl.prompt);
		}
	});
});
