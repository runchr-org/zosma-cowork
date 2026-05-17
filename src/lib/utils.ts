import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { invoke } from "@tauri-apps/api/core";

/**
 * Open a URL in the system browser via the Tauri backend.
 * Falls back to window.open if the IPC call fails.
 */
export async function openExternalUrl(url: string): Promise<void> {
	try {
		await invoke("open_url", { url });
	} catch {
		// fallback for non-Tauri environments (browser dev mode)
		const win = window.open(url, "_blank");
		if (win) {
			win.focus();
		} else {
			// popup blocked — navigate in current window
			window.location.href = url;
		}
	}
}

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
