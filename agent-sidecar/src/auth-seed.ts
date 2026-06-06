/**
 * auth-seed — first-run credential inheritance from the pi CLI.
 *
 * Cowork keeps its own auth at `~/.zosmaai/cowork/auth.json`, but a user who
 * already configured providers in the pi CLI (`~/.pi/agent/auth.json`) expects
 * those to "just work" in Cowork too — and the onboarding/Connect screen should
 * only appear when NOTHING is configured anywhere.
 *
 * On Cowork's FIRST run (no auth file yet) we therefore seed its auth from pi's,
 * copying every provider pi has that Cowork doesn't. After that Cowork owns its
 * own auth.json (logouts/edits stick — we never re-seed), so the two stay
 * independent going forward.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AuthCredential = { type: string; [k: string]: unknown };
export type AuthData = Record<string, AuthCredential>;

export function piAuthPath(piAgentDir: string): string {
	return join(piAgentDir, "auth.json");
}

/** Read & parse an auth.json. Returns `{}` if absent, corrupt, or non-object. */
export function readAuthFile(path: string): AuthData {
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8"));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as AuthData;
		}
		return {};
	} catch {
		return {};
	}
}

/**
 * Compute the credentials Cowork should inherit from pi: every provider present
 * in pi's auth that Cowork doesn't already have. Cowork always wins on conflict.
 * Malformed entries (non-object, missing `type`) are skipped.
 */
export function computeInheritedCredentials(coworkData: AuthData, piData: AuthData): AuthData {
	const out: AuthData = {};
	for (const [provider, cred] of Object.entries(piData)) {
		if (!cred || typeof cred !== "object" || typeof cred.type !== "string") continue;
		if (coworkData[provider]) continue; // Cowork already configured this one
		out[provider] = cred;
	}
	return out;
}
