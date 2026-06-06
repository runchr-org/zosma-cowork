import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	computeInheritedCredentials,
	piAuthPath,
	readAuthFile,
	type AuthData,
} from "./auth-seed.js";

describe("auth-seed", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "pi-auth-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	describe("readAuthFile", () => {
		it("returns {} when absent", () => {
			expect(readAuthFile(join(dir, "auth.json"))).toEqual({});
		});
		it("returns {} when corrupt", () => {
			writeFileSync(join(dir, "auth.json"), "{ bad json");
			expect(readAuthFile(join(dir, "auth.json"))).toEqual({});
		});
		it("parses a valid auth.json", () => {
			const data = { crofai: { type: "api_key", key: "k" } };
			writeFileSync(join(dir, "auth.json"), JSON.stringify(data));
			expect(readAuthFile(join(dir, "auth.json"))).toEqual(data);
		});
		it("derives the pi auth path", () => {
			expect(piAuthPath("/home/u/.pi/agent")).toBe("/home/u/.pi/agent/auth.json");
		});
	});

	describe("computeInheritedCredentials", () => {
		const pi: AuthData = {
			crofai: { type: "api_key", key: "nahcrof_x" },
			"github-copilot": { type: "oauth", refresh: "r", access: "a" },
			"opencode-go": { type: "api_key", key: "sk-y" },
		};

		it("inherits every pi provider when Cowork is empty (first run)", () => {
			expect(computeInheritedCredentials({}, pi)).toEqual(pi);
		});

		it("inherits both api_key and oauth credentials", () => {
			const out = computeInheritedCredentials({}, pi);
			expect(out["github-copilot"].type).toBe("oauth");
			expect(out.crofai.type).toBe("api_key");
		});

		it("never overwrites a provider Cowork already has", () => {
			const cowork: AuthData = { crofai: { type: "api_key", key: "COWORK_OWN" } };
			const out = computeInheritedCredentials(cowork, pi);
			expect(out.crofai).toBeUndefined(); // not re-seeded
			expect(out["opencode-go"]).toBeDefined();
		});

		it("returns {} when pi has nothing configured", () => {
			expect(computeInheritedCredentials({}, {})).toEqual({});
		});

		it("skips malformed entries (non-object / missing type)", () => {
			const bad = {
				ok: { type: "api_key", key: "k" },
				nullish: null,
				notyped: { key: "no-type" },
			} as unknown as AuthData;
			const out = computeInheritedCredentials({}, bad);
			expect(Object.keys(out)).toEqual(["ok"]);
		});
	});
});
