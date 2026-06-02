import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareExport } from "./ShareExport";

const mockWriteText = vi.fn();
Object.defineProperty(navigator, "clipboard", {
	value: { writeText: mockWriteText },
	writable: true,
});

describe("ShareExport", () => {
	const mockMessages = [
		{ role: "user" as const, content: "Hello", timestamp: 1000 },
		{
			role: "assistant" as const,
			content: "Hi there!",
			timestamp: 2000,
			model: "claude-sonnet",
			provider: "anthropic",
		},
	];

	it("renders the export button", () => {
		render(<ShareExport messages={mockMessages} />);
		expect(screen.getByRole("button", { name: /export/i })).toBeDefined();
	});

	it("renders the share button", () => {
		render(<ShareExport messages={mockMessages} />);
		expect(screen.getByRole("button", { name: /share/i })).toBeDefined();
	});

	it("exports markdown when Export is clicked", async () => {
		// Stub URL.createObjectURL for the blob-download fallback path
		const createObjectURL = vi.fn(() => "blob:mock");
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, writable: true });
		Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, writable: true });

		// Spy on anchor click so the test doesn't actually navigate
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		render(<ShareExport messages={mockMessages} />);
		fireEvent.click(screen.getByRole("button", { name: /export/i }));

		await vi.waitFor(() => {
			expect(createObjectURL).toHaveBeenCalled();
		});

		// Verify the blob payload looks like our markdown export
		const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
		const text = await blob.text();
		expect(text).toContain("# Zosma Cowork Conversation");
		expect(text).toContain("**You:**");
		expect(text).toContain("**Zosma:**");
		expect(text).toContain("Hello");
		expect(text).toContain("Hi there!");

		clickSpy.mockRestore();
	});

	it("copies app repo URL to clipboard when Share is clicked", async () => {
		mockWriteText.mockResolvedValue(undefined);
		render(<ShareExport messages={mockMessages} />);
		fireEvent.click(screen.getByRole("button", { name: /share/i }));
		await vi.waitFor(() => {
			expect(mockWriteText).toHaveBeenCalledWith("https://github.com/zosmaai/zosma-cowork");
		});
	});

	it("shows confirmation label briefly after copy", async () => {
		mockWriteText.mockResolvedValue(undefined);
		render(<ShareExport messages={mockMessages} />);
		fireEvent.click(screen.getByRole("button", { name: /share/i }));
		await vi.waitFor(() => {
			expect(screen.getByText("Copied!")).toBeDefined();
		});
	});
});
