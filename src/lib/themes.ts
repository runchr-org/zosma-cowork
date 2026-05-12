/**
 * Zosma Cowork — Theme definitions
 *
 * CSS variable-based themes with light, dark, and accent variants.
 * Each theme defines the full set of CSS custom properties used by the app.
 * New themes can be added by creating another object in THEMES.
 */

export interface Theme {
	id: string;
	name: string;
	description: string;
	type: "light" | "dark";
	/** CSS variable overrides — all without the leading `--` */
	vars: Record<string, string>;
}

export const THEMES: Theme[] = [
	{
		id: "zosma-dark",
		name: "Zosma Dark",
		description: "Dark theme with Zosma's signature indigo accent",
		type: "dark",
		vars: {
			// Background hierarchy
			background: "215 20% 8%",
			foreground: "210 15% 88%",
			card: "215 18% 11%",
			"card-foreground": "210 15% 88%",
			popover: "215 18% 11%",
			"popover-foreground": "210 15% 88%",
			muted: "215 15% 15%",
			"muted-foreground": "210 10% 55%",

			// Primary accent — indigo
			primary: "255 70% 65%",
			"primary-foreground": "0 0% 100%",

			// Destructive
			destructive: "0 70% 55%",
			"destructive-foreground": "0 0% 100%",

			// Borders and inputs
			border: "215 15% 20%",
			input: "215 15% 20%",
			ring: "255 70% 65%",

			// Sidebar
			"sidebar-background": "215 20% 8%",
			"sidebar-foreground": "210 15% 80%",
			"sidebar-accent": "215 18% 14%",
			"sidebar-accent-foreground": "210 15% 88%",
			"sidebar-border": "215 15% 16%",

			// Chat
			"chat-user-bg": "215 18% 14%",
			"chat-user-fg": "210 15% 88%",
			"chat-assistant-bg": "transparent",
			"chat-assistant-fg": "210 15% 85%",
			"chat-system-bg": "215 15% 18%",
			"chat-system-fg": "210 10% 60%",
			"chat-avatar-user-bg": "255 60% 55%",
			"chat-avatar-user-fg": "0 0% 100%",
			"chat-avatar-assistant-bg": "215 15% 25%",
			"chat-avatar-assistant-fg": "210 15% 80%",

			// Status
			"status-bg": "215 18% 11%",
			"status-divider": "215 15% 18%",
			"status-active-fg": "142 70% 55%",

			// Tool calls
			"tool-running-bg": "215 18% 14%",
			"tool-running-fg": "255 70% 65%",
			"tool-running-border": "255 70% 65% / 0.2",
			"tool-complete-bg": "215 18% 12%",
			"tool-complete-fg": "142 60% 55%",
			"tool-complete-border": "142 60% 55% / 0.15",
			"tool-error-bg": "0 50% 16%",
			"tool-error-fg": "0 70% 55%",
			"tool-error-border": "0 70% 55% / 0.2",

			// Diff
			"diff-removed-bg": "0 50% 20% / 0.4",
			"diff-removed-fg": "0 60% 70%",
			"diff-added-bg": "142 50% 18% / 0.4",
			"diff-added-fg": "142 60% 65%",
			"diff-context-fg": "210 10% 50%",

			// Success
			success: "142 60% 50%",
		},
	},
	{
		id: "zosma-light",
		name: "Zosma Light",
		description: "Clean light theme for daytime coding",
		type: "light",
		vars: {
			background: "0 0% 97%",
			foreground: "215 20% 20%",
			card: "0 0% 100%",
			"card-foreground": "215 20% 20%",
			popover: "0 0% 100%",
			"popover-foreground": "215 20% 20%",
			muted: "215 15% 93%",
			"muted-foreground": "215 10% 50%",

			primary: "255 65% 55%",
			"primary-foreground": "0 0% 100%",

			destructive: "0 65% 50%",
			"destructive-foreground": "0 0% 100%",

			border: "215 15% 85%",
			input: "215 15% 85%",
			ring: "255 65% 55%",

			"sidebar-background": "0 0% 100%",
			"sidebar-foreground": "215 20% 25%",
			"sidebar-accent": "215 15% 93%",
			"sidebar-accent-foreground": "215 20% 20%",
			"sidebar-border": "215 15% 88%",

			"chat-user-bg": "215 15% 90%",
			"chat-user-fg": "215 20% 20%",
			"chat-assistant-bg": "transparent",
			"chat-assistant-fg": "215 20% 25%",
			"chat-system-bg": "215 15% 90%",
			"chat-system-fg": "215 10% 45%",
			"chat-avatar-user-bg": "255 60% 50%",
			"chat-avatar-user-fg": "0 0% 100%",
			"chat-avatar-assistant-bg": "215 15% 80%",
			"chat-avatar-assistant-fg": "215 20% 25%",

			"status-bg": "0 0% 100%",
			"status-divider": "215 15% 88%",
			"status-active-fg": "142 65% 45%",

			"tool-running-bg": "255 65% 96%",
			"tool-running-fg": "255 65% 55%",
			"tool-running-border": "255 65% 55% / 0.15",
			"tool-complete-bg": "142 60% 95%",
			"tool-complete-fg": "142 60% 45%",
			"tool-complete-border": "142 60% 45% / 0.15",
			"tool-error-bg": "0 65% 95%",
			"tool-error-fg": "0 65% 50%",
			"tool-error-border": "0 65% 50% / 0.15",

			"diff-removed-bg": "0 65% 92%",
			"diff-removed-fg": "0 60% 45%",
			"diff-added-bg": "142 60% 92%",
			"diff-added-fg": "142 60% 40%",
			"diff-context-fg": "215 10% 55%",

			success: "142 60% 45%",
		},
	},
	{
		id: "midnight",
		name: "Midnight",
		description: "Deep blue-black dark theme, easy on the eyes",
		type: "dark",
		vars: {
			background: "220 18% 6%",
			foreground: "220 12% 85%",
			card: "220 16% 9%",
			"card-foreground": "220 12% 85%",
			popover: "220 16% 9%",
			"popover-foreground": "220 12% 85%",
			muted: "220 14% 12%",
			"muted-foreground": "220 10% 50%",

			primary: "210 80% 60%",
			"primary-foreground": "0 0% 100%",

			destructive: "0 70% 50%",
			"destructive-foreground": "0 0% 100%",

			border: "220 14% 18%",
			input: "220 14% 18%",
			ring: "210 80% 60%",

			"sidebar-background": "220 18% 6%",
			"sidebar-foreground": "220 12% 80%",
			"sidebar-accent": "220 16% 11%",
			"sidebar-accent-foreground": "220 12% 85%",
			"sidebar-border": "220 14% 14%",

			"chat-user-bg": "220 16% 11%",
			"chat-user-fg": "220 12% 85%",
			"chat-assistant-bg": "transparent",
			"chat-assistant-fg": "220 12% 82%",
			"chat-system-bg": "220 14% 15%",
			"chat-system-fg": "220 10% 55%",
			"chat-avatar-user-bg": "210 70% 50%",
			"chat-avatar-user-fg": "0 0% 100%",
			"chat-avatar-assistant-bg": "220 14% 22%",
			"chat-avatar-assistant-fg": "220 12% 80%",

			"status-bg": "220 16% 9%",
			"status-divider": "220 14% 16%",
			"status-active-fg": "160 70% 50%",

			"tool-running-bg": "220 16% 12%",
			"tool-running-fg": "210 80% 60%",
			"tool-running-border": "210 80% 60% / 0.2",
			"tool-complete-bg": "220 16% 10%",
			"tool-complete-fg": "160 60% 50%",
			"tool-complete-border": "160 60% 50% / 0.15",
			"tool-error-bg": "0 50% 14%",
			"tool-error-fg": "0 70% 50%",
			"tool-error-border": "0 70% 50% / 0.2",

			"diff-removed-bg": "0 50% 18% / 0.35",
			"diff-removed-fg": "0 60% 65%",
			"diff-added-bg": "160 50% 16% / 0.35",
			"diff-added-fg": "160 60% 60%",
			"diff-context-fg": "220 10% 45%",

			success: "160 60% 45%",
		},
	},
	{
		id: "solarized-dark",
		name: "Solarized Dark",
		description: "Solarized color scheme — warm dark",
		type: "dark",
		vars: {
			background: "195 10% 15%",
			foreground: "45 20% 80%",
			card: "195 10% 18%",
			"card-foreground": "45 20% 80%",
			popover: "195 10% 18%",
			"popover-foreground": "45 20% 80%",
			muted: "195 10% 20%",
			"muted-foreground": "45 5% 55%",

			primary: "18 80% 55%",
			"primary-foreground": "0 0% 100%",

			destructive: "0 70% 50%",
			"destructive-foreground": "0 0% 100%",

			border: "195 10% 25%",
			input: "195 10% 25%",
			ring: "18 80% 55%",

			"sidebar-background": "195 10% 15%",
			"sidebar-foreground": "45 20% 75%",
			"sidebar-accent": "195 10% 21%",
			"sidebar-accent-foreground": "45 20% 80%",
			"sidebar-border": "195 10% 22%",

			"chat-user-bg": "195 10% 21%",
			"chat-user-fg": "45 20% 80%",
			"chat-assistant-bg": "transparent",
			"chat-assistant-fg": "45 20% 78%",
			"chat-system-bg": "195 10% 23%",
			"chat-system-fg": "45 5% 60%",
			"chat-avatar-user-bg": "18 80% 50%",
			"chat-avatar-user-fg": "0 0% 100%",
			"chat-avatar-assistant-bg": "195 10% 30%",
			"chat-avatar-assistant-fg": "45 20% 75%",

			"status-bg": "195 10% 18%",
			"status-divider": "195 10% 25%",
			"status-active-fg": "68 60% 50%",

			"tool-running-bg": "195 10% 21%",
			"tool-running-fg": "18 80% 55%",
			"tool-running-border": "18 80% 55% / 0.2",
			"tool-complete-bg": "195 10% 19%",
			"tool-complete-fg": "68 60% 50%",
			"tool-complete-border": "68 60% 50% / 0.15",
			"tool-error-bg": "0 50% 18%",
			"tool-error-fg": "0 70% 50%",
			"tool-error-border": "0 70% 50% / 0.2",

			"diff-removed-bg": "0 50% 22% / 0.35",
			"diff-removed-fg": "0 60% 65%",
			"diff-added-bg": "68 50% 18% / 0.35",
			"diff-added-fg": "68 60% 55%",
			"diff-context-fg": "45 5% 50%",

			success: "68 60% 45%",
		},
	},
];

/** Apply a theme by setting CSS variables on the document root */
export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	const { vars } = theme;

	// Apply all CSS variable overrides
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(`--${key}`, value);
	}

	// Set data attribute for any theme-specific selectors
	root.setAttribute("data-theme", theme.id);
	root.setAttribute("data-theme-type", theme.type);

	// Persist to localStorage for instant load on next app start
	try {
		localStorage.setItem("zosma-theme", theme.id);
	} catch {
		// Ignore if localStorage is unavailable
	}
}

/** Load the saved theme from localStorage, or return the default */
export function getSavedTheme(): Theme {
	try {
		const saved = localStorage.getItem("zosma-theme");
		if (saved) {
			const found = THEMES.find((t) => t.id === saved);
			if (found) return found;
		}
	} catch {
		// Ignore
	}
	// Respect OS preference
	if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
		return THEMES.find((t) => t.id === "zosma-light") || THEMES[0];
	}
	return THEMES[0]; // Default: Zosma Dark
}
