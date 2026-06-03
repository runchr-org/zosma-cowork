/**
 * Regression test for issue #150.
 *
 * Before: useAuth.saveApiKey hardcoded `provider: "opencode-go"` when calling
 * the `save_auth_key` Tauri command, so every API key the user pasted (e.g.
 * OpenRouter, Anthropic, OpenAI) was stored under the wrong provider slot.
 *
 * After: the caller MUST pass the provider id; useAuth forwards it as-is.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock("@tauri-apps/api/event", () => ({
	listen: (...a: unknown[]) => listenMock(...a),
}));

import { useAuth } from "./useAuth";

describe("useAuth.saveApiKey", () => {
	beforeEach(() => {
		invokeMock.mockReset();
		listenMock.mockReset();
		listenMock.mockResolvedValue(() => {});
		// Default: no credentials yet.
		invokeMock.mockImplementation((cmd: string) => {
			if (cmd === "has_credentials") return Promise.resolve(false);
			return Promise.resolve(undefined);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("forwards the provider id (not a hardcoded constant) to save_auth_key", async () => {
		const { result } = renderHook(() => useAuth());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.saveApiKey("openrouter", "sk-or-test-key");
		});

		expect(invokeMock).toHaveBeenCalledWith("save_auth_key", {
			provider: "openrouter",
			key: "sk-or-test-key",
		});
		// And critically — NOT the legacy hardcoded slot.
		expect(invokeMock).not.toHaveBeenCalledWith(
			"save_auth_key",
			expect.objectContaining({ provider: "opencode-go" }),
		);
	});

	it("trims the provider id and rejects empty providers", async () => {
		const { result } = renderHook(() => useAuth());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await expect(
			act(async () => {
				await result.current.saveApiKey("   ", "sk-test");
			}),
		).rejects.toThrow(/provider is required/);

		expect(invokeMock).not.toHaveBeenCalledWith("save_auth_key", expect.anything());
	});

	it("passes whatever provider id the caller picks (e.g. anthropic, openai, groq)", async () => {
		const { result } = renderHook(() => useAuth());
		await waitFor(() => expect(result.current.loading).toBe(false));

		for (const provider of ["anthropic", "openai", "groq", "mistral"]) {
			await act(async () => {
				await result.current.saveApiKey(provider, `key-${provider}`);
			});
			expect(invokeMock).toHaveBeenCalledWith("save_auth_key", {
				provider,
				key: `key-${provider}`,
			});
		}
	});
});
