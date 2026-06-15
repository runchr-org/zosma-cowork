import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRoutinesExtension } from "./useRoutinesExtension";

describe("useRoutinesExtension (#300 inline factory)", () => {
	it("uses checking until the Tasks tab becomes active, then goes to ready", () => {
		const { result: inactive } = renderHook(() => useRoutinesExtension(false));
		expect(inactive.current.status).toBe("checking");

		const { result: active } = renderHook(() => useRoutinesExtension(true));
		expect(active.current.status).toBe("ready");
	});

	it("retry resets to ready", async () => {
		const { result } = renderHook(() => useRoutinesExtension(false));
		expect(result.current.status).toBe("checking");

		result.current.retry();
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});
});
