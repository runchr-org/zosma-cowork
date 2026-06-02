import { ExtensionPanel } from "../ExtensionPanel";

export function Extensions() {
	return (
		<section>
			<h2 className="text-sm font-semibold text-foreground mb-1">Extensions</h2>
			<p className="text-xs text-muted-foreground mb-5">
				Add tools and integrations from the pi ecosystem.
			</p>
			<ExtensionPanel onReload={() => {}} />
		</section>
	);
}
