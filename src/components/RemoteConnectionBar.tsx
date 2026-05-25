import { useEffect, useState } from "react";

/**
 * Detect if we're running in remote (browser) mode vs Tauri desktop.
 * In Tauri, `window.__TAURI__` is available. In the browser via remote
 * server (port 8765 by default), we're in a regular web context.
 */
function isRemoteMode(): boolean {
	try {
		return !(window as unknown as { __TAURI__?: Record<string, unknown> }).__TAURI__;
	} catch {
		return true;
	}
}

interface RemoteConnectionBarProps {
	onReconnect?: () => void;
	serverUrl?: string;
}

export function RemoteConnectionBar({ onReconnect, serverUrl }: RemoteConnectionBarProps) {
	const [connected, setConnected] = useState<boolean>(true);
	const [retryCount, setRetryCount] = useState(0);

	useEffect(() => {
		if (!isRemoteMode()) return;

		// Check connectivity by fetching /api/status periodically
		function checkConnection() {
			fetch("/api/status")
				.then((res) => {
					if (res.ok) {
						setConnected(true);
						setRetryCount(0);
					} else {
						setConnected(false);
					}
				})
				.catch(() => {
					setConnected(false);
				});
		}

		// Initial check
		checkConnection();

		// Retry logic: check every 5s if disconnected, every 30s if connected
		const interval = setInterval(
			checkConnection,
			connected ? 30_000 : 5_000,
		);

		return () => clearInterval(interval);
	}, [connected]);

	// Don't show anything in Tauri desktop mode or when connected without errors
	if (!isRemoteMode()) return null;

	const handleReconnect = () => {
		setRetryCount((c) => c + 1);
		window.location.reload();
		onReconnect?.();
	};

	return (
		<div
			className={`flex items-center justify-center gap-2 px-3 py-1 text-xs shrink-0 ${
				connected
					? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					: "bg-red-500/10 text-red-600 dark:text-red-400"
			}`}
		>
			<span
				className={`inline-block w-1.5 h-1.5 rounded-full ${
					connected ? "bg-emerald-500" : "bg-red-500 animate-pulse"
				}`}
			/>
			<span>
				{connected
					? `Connected${serverUrl ? ` — ${serverUrl}` : ""}`
					: `Connection lost${retryCount > 0 ? ` (retry #${retryCount})` : ""}`}
			</span>
			{!connected && (
				<button
					type="button"
					onClick={handleReconnect}
					className="underline hover:no-underline text-red-600 dark:text-red-400 ml-1"
				>
					Reconnect
				</button>
			)}
		</div>
	);
}
