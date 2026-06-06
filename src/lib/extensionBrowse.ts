/**
 * extensionBrowse — curated featured pi extensions for the Extensions store.
 *
 * Search uses the npm registry (scoped to pi packages via the sidecar). This
 * module provides the default "browse" set: a hand-picked list of high-quality
 * pi extensions, grouped by category for filtering. Live metadata (version,
 * description, author) is fetched from npm at render time.
 */

export interface FeaturedExtension {
	/** npm package name — also the install source. */
	pkg: string;
	/** Short human label (falls back to derived name). */
	label: string;
	category: string;
	/** One-line blurb shown before npm metadata resolves. */
	blurb: string;
}

export const FEATURED_EXTENSIONS: FeaturedExtension[] = [
	{
		pkg: "pi-web-access",
		label: "Web Access",
		category: "Web",
		blurb: "Web search, URL fetching, GitHub cloning, and PDF extraction.",
	},
	{
		pkg: "@zosmaai/pi-llm-wiki",
		label: "LLM Wiki",
		category: "Memory",
		blurb: "Self-maintaining knowledge wiki (Karpathy pattern).",
	},
	{
		pkg: "@touchskyer/memex",
		label: "Memex",
		category: "Memory",
		blurb: "Zettelkasten agent memory with bidirectional links.",
	},
	{
		pkg: "context-mode",
		label: "Context Mode",
		category: "Context",
		blurb: "Saves up to 98% of your context window.",
	},
	{
		pkg: "pi-superpowers-plus",
		label: "Superpowers Plus",
		category: "Workflows",
		blurb: "Workflow skills: TDD, debugging, planning, code review.",
	},
	{
		pkg: "@plannotator/pi-extension",
		label: "Plannotator",
		category: "Planning",
		blurb: "Interactive plan review with inline annotations.",
	},
	{
		pkg: "@the-forge-flow/lumen",
		label: "Lumen",
		category: "Visuals",
		blurb: "Diagrams, charts, mermaid, and slide generation.",
	},
	{
		pkg: "pi-ask-user",
		label: "Ask User",
		category: "Interaction",
		blurb: "Interactive multiple-choice prompts for the agent.",
	},
	{
		pkg: "pi-messenger-bridge",
		label: "Messenger Bridge",
		category: "Integrations",
		blurb: "Bridge Telegram, WhatsApp, Slack, and Discord.",
	},
];

export const EXTENSION_CATEGORIES = [
	"All",
	"Memory",
	"Context",
	"Web",
	"Workflows",
	"Planning",
	"Visuals",
	"Interaction",
	"Integrations",
];

/** Derive a friendly display name from an npm package name. */
export function extensionDisplayName(pkg: string): string {
	const base = pkg.split("/").pop() || pkg;
	return base
		.replace(/^pi-/, "")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}
