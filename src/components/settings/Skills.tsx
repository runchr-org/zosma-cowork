import { SkillsPanel } from "../SkillsPanel";

export function Skills() {
	return (
		<section>
			<h2 className="text-sm font-semibold text-foreground mb-1">Skills</h2>
			<p className="text-xs text-muted-foreground mb-5">
				Specialized instruction sets that sharpen the agent for specific tasks.
			</p>
			<SkillsPanel />
		</section>
	);
}
