/**
 * Zosma Cowork — Font size / zoom control
 *
 * Uses CSS `zoom` on the root app container to scale the entire UI
 * proportionally. Stored in localStorage so it persists across sessions.
 */

const STORAGE_KEY = "zosma-font-scale";

export type FontScale = 0.85 | 1 | 1.15 | 1.3;

/** All available font scale presets. */
export const FONT_SCALE_PRESETS: FontScale[] = [0.85, 1, 1.15, 1.3];

/** Human-readable labels for each preset. */
export const FONT_SCALE_LABELS: Record<FontScale, string> = {
	0.85: "Small",
	1: "Normal",
	1.15: "Large",
	1.3: "Extra Large",
};

/** Icons for each preset. */
export const FONT_SCALE_ICONS: Record<FontScale, string> = {
	0.85: "A",
	1: "A",
	1.15: "A",
	1.3: "A",
};

/** Get the persisted font scale, falling back to 1 (Normal). */
export function getFontScale(): FontScale {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const n = Number(saved);
			if (FONT_SCALE_PRESETS.includes(n as FontScale)) return n as FontScale;
		}
	} catch {
		// localStorage unavailable — use default
	}
	return 1;
}

/** Persist a font scale choice. */
export function setFontScale(scale: FontScale): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(scale));
	} catch {
		// Ignore
	}
}

/** Initialize font scale from saved preference (call once on app load). */
export function initFontScale(): void {
	// Just reading sets no side effects — actual zoom is applied in App.tsx
	const scale = getFontScale();
	if (scale !== 1) {
		// We don't do the zoom here because React needs the DOM to be ready.
		// App.tsx handles it by reading the saved value on mount.
	}
}
