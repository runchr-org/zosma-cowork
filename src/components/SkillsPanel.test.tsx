import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillsPanel } from "./SkillsPanel";

// Mock Tauri invoke
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("SkillsPanel (store)", () => {
	beforeEach(() => {
		mockInvoke.mockReset();
		mockInvoke.mockImplementation((cmd: string) => {
			if (cmd === "list_skills") return Promise.resolve([]);
			if (cmd === "search_skills") return Promise.resolve([]);
			if (cmd === "install_skill") return Promise.resolve({ success: true });
			if (cmd === "remove_skill") return Promise.resolve({ success: true });
			if (cmd === "read_skill_md") return Promise.resolve({ content: "# Hello" });
			return Promise.resolve(null);
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders the search input", () => {
		render(<SkillsPanel />);
		expect(screen.getByPlaceholderText("Search skills by name or keyword...")).toBeDefined();
	});

	it("shows the Discover and Installed view switch", () => {
		render(<SkillsPanel />);
		expect(screen.getByText("Discover")).toBeDefined();
		expect(screen.getByText("Installed")).toBeDefined();
	});

	it("shows featured skills by default", () => {
		render(<SkillsPanel />);
		// Featured set includes anthropics/skills/frontend-design → "Frontend Design"
		expect(screen.getAllByText("Frontend Design").length).toBeGreaterThan(0);
	});

	it("calls search_skills IPC with debounced query", async () => {
		render(<SkillsPanel />);
		const input = screen.getByPlaceholderText("Search skills by name or keyword...");
		fireEvent.change(input, { target: { value: "typescript" } });

		await waitFor(
			() => {
				expect(mockInvoke).toHaveBeenCalledWith("search_skills", { query: "typescript" });
			},
			{ timeout: 1500 },
		);
	});

	it("renders search results as tiles", async () => {
		mockInvoke.mockImplementation((cmd: string) => {
			if (cmd === "list_skills") return Promise.resolve([]);
			if (cmd === "search_skills") {
				return Promise.resolve([
					{
						id: "wshobson/agents/typescript-advanced-types",
						installCount: 41200,
						url: "https://skills.sh/wshobson/agents/typescript-advanced-types",
						npmData: null,
					},
				]);
			}
			return Promise.resolve(null);
		});

		render(<SkillsPanel />);
		fireEvent.change(screen.getByPlaceholderText("Search skills by name or keyword..."), {
			target: { value: "typescript" },
		});

		await waitFor(() => {
			expect(screen.getByText("Typescript Advanced Types")).toBeDefined();
		});
		expect(screen.getByText("41.2K")).toBeDefined();
	});

	it("shows installed skills in the Installed view", async () => {
		mockInvoke.mockImplementation((cmd: string) => {
			if (cmd === "list_skills") {
				return Promise.resolve([
					{
						name: "find-skills",
						path: "/home/user/.agents/skills/find-skills",
						scope: "project",
						agents: ["Codex"],
						removable: true,
					},
				]);
			}
			return Promise.resolve(null);
		});

		render(<SkillsPanel />);
		fireEvent.click(screen.getByText("Installed"));

		await waitFor(() => {
			expect(screen.getByText("Find Skills")).toBeDefined();
		});
		expect(screen.getAllByTitle("Remove skill").length).toBeGreaterThan(0);
	});

	it("calls install_skill IPC when Install clicked", async () => {
		mockInvoke.mockImplementation((cmd: string) => {
			if (cmd === "list_skills") return Promise.resolve([]);
			if (cmd === "search_skills") {
				return Promise.resolve([
					{ id: "test/skill/my-skill", installCount: 100, url: "", npmData: null },
				]);
			}
			if (cmd === "install_skill") return Promise.resolve({ success: true });
			return Promise.resolve(null);
		});

		render(<SkillsPanel />);
		fireEvent.change(screen.getByPlaceholderText("Search skills by name or keyword..."), {
			target: { value: "test" },
		});

		await waitFor(() => {
			expect(screen.getByText("My Skill")).toBeDefined();
		});

		fireEvent.click(screen.getAllByTitle("Install skill")[0]);
		expect(mockInvoke).toHaveBeenCalledWith("install_skill", {
			source: "test/skill/my-skill",
		});
	});

	it("opens the SKILL.md reader when a tile is clicked", async () => {
		mockInvoke.mockImplementation((cmd: string) => {
			if (cmd === "list_skills") {
				return Promise.resolve([
					{
						name: "find-skills",
						path: "/home/user/.agents/skills/find-skills",
						scope: "project",
						agents: [],
						removable: true,
					},
				]);
			}
			if (cmd === "read_skill_md")
				return Promise.resolve({ content: "# Find Skills\n\nDiscover skills." });
			return Promise.resolve(null);
		});

		render(<SkillsPanel />);
		fireEvent.click(screen.getByText("Installed"));

		await waitFor(() => {
			expect(screen.getByText("Find Skills")).toBeDefined();
		});

		fireEvent.click(screen.getByText("Find Skills"));

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith("read_skill_md", {
				path: "/home/user/.agents/skills/find-skills",
			});
		});
	});
});
