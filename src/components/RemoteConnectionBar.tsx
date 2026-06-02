import { useEffect, useState } from "react";

function isRemoteMode(): boolean {
	try {
		return !(window as unknown as { __TAURI__?: Record<string, unknown> }).__TAURI__;
	} catch {
		return true;
	}
}

interface RemoteConnectionBarProps {
	onReconnect?: () => void;
}

export function RemoteConnectionBar({ onReconnect }: RemoteConnectionBarProps) {
	const [connected, setConnected] = useState<boolean>(true);

	useEffect(() => {
		if (!isRemoteMode()) return;

		function checkConnection() {
			fetch("/api/status")
				.then((res) => {
					if (res.ok) {
						setConnected(true);
					} else {
						setConnected(false);
					}
				})
				.catch(() => {
					setConnected(false);
				});
		}

		checkConnection();

		const interval = setInterval(checkConnection, connected ? 30_000 : 5_000);

		return () => clearInterval(interval);
	}, [connected]);

	if (!isRemoteMode()) return null;
	if (connected) return null;

	const handleReconnect = () => {
		window.location.reload();
		onReconnect?.();
	};

	return (
		<div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs shrink-0 text-muted-foreground/60 bg-muted/30">
			<span>You seem to be offline</span>
			<button
				type="button"
				onClick={handleReconnect}
				className="underline hover:no-underline text-muted-foreground/80 ml-1"
			>
				Reconnect
			</button>
		</div>
	);
}
