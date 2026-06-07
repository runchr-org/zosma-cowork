/**
 * Global external-link guard.
 *
 * Inside the Tauri webview, clicking a plain `<a href="https://…">`
 * navigates the app's OWN webview away from the UI — a jarring, broken
 * experience. This installs a single delegated, document-level click
 * handler that intercepts any anchor pointing at an external URL and
 * opens it in the system browser instead (via the Tauri `open_url`
 * command, with a `window.open` fallback in browser dev mode).
 *
 * It runs in the bubble phase and respects `event.defaultPrevented`, so
 * components that already handle their own links (e.g. the react-markdown
 * anchor override) win and this never double-opens.
 */
import { openExternalUrl } from "./utils";

function isExternalHref(href: string): boolean {
	if (!href) return false;
	// In-page anchors and non-navigational schemes are left alone.
	if (href.startsWith("#")) return false;
	if (href.startsWith("javascript:")) return false;
	if (href.startsWith("blob:") || href.startsWith("data:")) return false;
	// http(s), mailto, tel, and protocol-relative URLs go to the OS handler.
	return /^(https?:|mailto:|tel:|\/\/)/i.test(href);
}

let installed = false;

export function installExternalLinkHandler(): void {
	if (installed || typeof document === "undefined") return;
	installed = true;

	document.addEventListener(
		"click",
		(e) => {
			// Already handled by a more specific component handler.
			if (e.defaultPrevented) return;
			// Respect modifier-click / non-primary buttons — let the OS/webview decide.
			if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

			const target = e.target as Element | null;
			const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
			if (!anchor) return;

			const href = anchor.getAttribute("href") ?? "";
			if (!isExternalHref(href)) return;

			e.preventDefault();
			void openExternalUrl(anchor.href || href);
		},
		false,
	);
}
