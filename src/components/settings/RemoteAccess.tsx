import { RemoteAccessPanel } from "../RemoteAccessPanel";

export function RemoteAccess() {
	return (
		<section>
			<h2 className="text-sm font-semibold text-foreground mb-1">Remote Access</h2>
			<p className="text-xs text-muted-foreground mb-5">
				Connect to this agent from another device or editor.
			</p>
			<RemoteAccessPanel />
		</section>
	);
}
