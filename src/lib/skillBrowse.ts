/**
 * skillBrowse — curated featured skills and SKILL.md retrieval helpers for the
 * Skills store. Search hits skills.sh via the sidecar; this module adds the
 * "browse" experience (a hand-picked featured set) plus the logic to read a
 * skill's SKILL.md for the in-app reader.
 *
 * SKILL.md resolution:
 *   - installed skills  → read the local file via the `read_skill_md` IPC
 *   - remote skills     → best-effort fetch from GitHub raw (skills.sh skills
 *                         are GitHub-hosted). Resolution is heuristic because
 *                         repos lay skills out differently, so callers must
 *                         handle a null result gracefully.
 */

import { invoke } from "@tauri-apps/api/core";
import type { SkillResult } from "./skillRegistry";

export interface FeaturedSkill extends SkillResult {
	name: string;
	source: string; // owner/repo
	category: string;
}

/**
 * Curated "good set" of skills shown when the user hasn't searched yet.
 * Sourced from the most-installed skills on skills.sh across popular
 * categories. `url` is the canonical skills.sh page; `id` is the install id.
 */
export const FEATURED_SKILLS: FeaturedSkill[] = [
	mk("anthropics/skills/frontend-design", 509177, "Design"),
	mk("vercel-labs/agent-skills/vercel-react-best-practices", 455300, "Frontend"),
	mk("microsoft/azure-skills/azure-kubernetes", 200842, "DevOps"),
	mk("xixu-me/skills/github-actions-docs", 198311, "DevOps"),
	mk("vercel-labs/agent-skills/vercel-react-native-skills", 135607, "Mobile"),
	mk("leonxlnx/taste-skill/design-taste-frontend", 116180, "Design"),
	mk("anthropics/skills/webapp-testing", 89705, "Testing"),
	mk("vercel-labs/agent-skills/vercel-react-view-transitions", 50915, "Frontend"),
	mk("wshobson/agents/typescript-advanced-types", 45621, "Languages"),
	mk("neondatabase/agent-skills/neon-postgres", 39576, "Database"),
	mk("firebase/agent-skills/firebase-security-rules-auditor", 38705, "Security"),
	mk("anthropics/skills/claude-api", 35988, "API"),
	mk("github/awesome-copilot/git-commit", 34283, "Git"),
	mk("wshobson/agents/python-performance-optimization", 25363, "Languages"),
	mk("wshobson/agents/python-testing-patterns", 23195, "Testing"),
	mk("vercel-labs/skills/find-skills", 0, "Meta"),
];

export const FEATURED_CATEGORIES = [
	"All",
	"Design",
	"Frontend",
	"Languages",
	"Testing",
	"DevOps",
	"Database",
	"Security",
	"API",
	"Git",
	"Mobile",
	"Meta",
];

function mk(id: string, installs: number, category: string): FeaturedSkill {
	const parts = id.split("/");
	const source = parts.slice(0, 2).join("/");
	const name = parts[parts.length - 1];
	return { id, name, source, category, installCount: installs, url: `https://skills.sh/${id}` };
}

// ─── Skill id parsing ───────────────────────────────────────────────

export interface ParsedSkill {
	owner: string;
	repo: string;
	source: string; // owner/repo
	skillName: string; // last segment
	displayName: string;
}

/** Parse a skill id like "owner/repo/skill-name" or "owner/repo@skill". */
export function parseSkillId(id: string): ParsedSkill {
	// Normalize "owner/repo@skill" → "owner/repo/skill"
	const normalized = id.replace("@", "/");
	const parts = normalized.split("/").filter(Boolean);
	const owner = parts[0] ?? id;
	const repo = parts[1] ?? "";
	const skillName = parts[parts.length - 1] ?? id;
	return {
		owner,
		repo,
		source: repo ? `${owner}/${repo}` : owner,
		skillName,
		displayName: prettify(skillName),
	};
}

export function prettify(name: string): string {
	return name
		.replace(/[:_]/g, " ")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── SKILL.md retrieval ─────────────────────────────────────────────

const remoteCache = new Map<string, string | null>();

/** Read an installed skill's SKILL.md from disk via IPC. */
export async function readInstalledSkillMd(path: string): Promise<string | null> {
	try {
		const res = await invoke<{ content?: string }>("read_skill_md", { path });
		return res?.content ?? null;
	} catch {
		return null;
	}
}

/**
 * Best-effort fetch of a remote skill's SKILL.md from GitHub raw.
 * Tries a series of conventional paths across main/master, then falls back to
 * the GitHub trees API to locate a SKILL.md matching the skill name.
 * Returns null if nothing resolves.
 */
export async function fetchRemoteSkillMd(id: string): Promise<string | null> {
	if (remoteCache.has(id)) return remoteCache.get(id) ?? null;

	const { owner, repo, skillName } = parseSkillId(id);
	if (!owner || !repo) {
		remoteCache.set(id, null);
		return null;
	}

	// Sub-path inside the repo (everything after owner/repo)
	const sub = id.replace("@", "/").split("/").slice(2).join("/");
	const branches = ["main", "master"];
	const relPaths = [
		sub ? `${sub}/SKILL.md` : "SKILL.md",
		`skills/${skillName}/SKILL.md`,
		`${skillName}/SKILL.md`,
		sub ? `${sub}.md` : "",
		"SKILL.md",
	].filter(Boolean);

	for (const branch of branches) {
		for (const rel of relPaths) {
			const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`;
			const md = await tryFetchText(url);
			if (md) {
				remoteCache.set(id, md);
				return md;
			}
		}
	}

	// Fallback: locate SKILL.md via the GitHub trees API.
	const located = await locateViaTreesApi(owner, repo, skillName);
	remoteCache.set(id, located);
	return located;
}

async function tryFetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
		if (!res.ok) return null;
		const text = await res.text();
		return text.trim() ? text : null;
	} catch {
		return null;
	}
}

async function locateViaTreesApi(
	owner: string,
	repo: string,
	skillName: string,
): Promise<string | null> {
	try {
		const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
			signal: AbortSignal.timeout(7000),
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!repoRes.ok) return null;
		const repoData = (await repoRes.json()) as { default_branch?: string };
		const branch = repoData.default_branch || "main";

		const treeRes = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
			{ signal: AbortSignal.timeout(8000), headers: { Accept: "application/vnd.github+json" } },
		);
		if (!treeRes.ok) return null;
		const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
		const files = (tree.tree || []).filter((t) => t.type === "blob");

		// Prefer "<skillName>/SKILL.md", then any SKILL.md, then "<skillName>.md".
		const exact = files.find((f) => f.path.endsWith(`${skillName}/SKILL.md`));
		const anySkill = files.find((f) => f.path.endsWith("SKILL.md"));
		const dashMd = files.find((f) => f.path.endsWith(`${skillName}.md`));
		const hit = exact || anySkill || dashMd;
		if (!hit) return null;

		return tryFetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${hit.path}`);
	} catch {
		return null;
	}
}

// ─── Pagination ─────────────────────────────────────────────────────

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
	const start = page * perPage;
	return items.slice(start, start + perPage);
}

export function pageCount(total: number, perPage: number): number {
	return Math.max(1, Math.ceil(total / perPage));
}
