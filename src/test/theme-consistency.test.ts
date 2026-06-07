import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Theme-consistency regression guards for the brand-blue glass theme (#190).
 * These assert the merged design system stays internally consistent:
 *   • brand-blue tokens present, legacy Oliver-green tokens gone
 *   • brand fonts (Chakra Petch / Space Grotesk) loaded + applied globally
 *   • reusable glass/elevated surfaces defined and applied to app chrome
 *   • the font-size (zoom) feature from our advanced branch is preserved
 */
const root = resolve(__dirname, "..", "..");
const appCss = readFileSync(resolve(root, "src/App.css"), "utf8");
const appTsx = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");

describe("theme tokens", () => {
	it("uses brand-blue as the primary/brand accent", () => {
		expect(appCss).toContain("--brand: 210 99% 48%");
		expect(appCss).toContain("--primary: 210 99% 48%");
	});

	it("has no leftover Oliver-green design tokens", () => {
		expect(appCss).not.toContain("102 86% 70%");
		expect(appCss).not.toContain("102 70% 32%");
	});
});

describe("fonts (app-wide)", () => {
	it("loads Chakra Petch + Space Grotesk in index.html", () => {
		expect(indexHtml).toContain("Chakra+Petch");
		expect(indexHtml).toContain("Space+Grotesk");
	});

	it("sets Chakra Petch as the primary sans family", () => {
		expect(appCss).toMatch(/--font-sans:\s*"Chakra Petch"/);
	});

	it("applies the brand font globally on body", () => {
		expect(appCss).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-sans\)/s);
	});
});

describe("glass / elevated surfaces", () => {
	it("defines reusable glass utilities with backdrop blur", () => {
		for (const cls of [".glass", ".panel-raised", ".panel-sidebar"]) {
			expect(appCss).toContain(cls);
		}
		expect(appCss).toMatch(/backdrop-filter:\s*blur\(/);
	});

	it("applies glass panels to the sidebar and main content in App.tsx", () => {
		expect(appTsx).toContain("panel-sidebar");
		expect(appTsx).toContain("panel-raised");
	});
});

describe("preserved features", () => {
	it("keeps the font-size (zoom) control on the root container", () => {
		expect(appTsx).toContain("zoom: fontScale");
	});
});
