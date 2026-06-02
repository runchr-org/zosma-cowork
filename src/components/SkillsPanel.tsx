import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InstalledSkill, SkillResult } from "../lib/skillRegistry";
import { ExtensionCard } from "./ExtensionCard";
import { ExtensionDetail } from "./ExtensionDetail";

export function SkillsPanel() {
	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SkillResult[]>([]);
	const [installed, setInstalled] = useState<InstalledSkill[]>([]);
	const [searching, setSearching] = useState(false);
	const [installingSet, setInstallingSet] = useState<string[]>([]);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [detailSkill, setDetailSkill] = useState<SkillResult | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showError = useCallback((msg: string) => {
		setErrorMsg(msg);
		if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
		errorTimerRef.current = setTimeout(() => setErrorMsg(null), 5000);
	}, []);

	const loadInstalled = useCallback(async () => {
		try {
			const skills = await invoke<unknown>("list_skills");
			setInstalled(Array.isArray(skills) ? (skills as InstalledSkill[]) : []);
		} catch {
			setInstalled([]);
		}
	}, []);

	// Load installed skills on mount
	useEffect(() => {
		loadInstalled().catch(() => {});
	}, [loadInstalled]);

	// Debounced search
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!query.trim()) {
			setSearchResults([]);
			setSearching(false);
			return;
		}

		setSearching(true);
		debounceRef.current = setTimeout(async () => {
			try {
				const result = await invoke<unknown>("search_skills", {
					query: query.trim(),
				});
				// Rust returns bare array (unwrap_or strips the results wrapper)
				const arr = Array.isArray(result)
					? (result as SkillResult[])
					: Array.isArray((result as Record<string, unknown>)?.results)
						? ((result as Record<string, unknown>).results as SkillResult[])
						: [];
				setSearchResults(arr);
			} catch {
				setSearchResults([]);
			} finally {
				setSearching(false);
			}
		}, 500);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	const handleInstall = async (skillId: string) => {
		setInstallingSet((prev) => [...prev, skillId]);
		try {
			await invoke("install_skill", { source: skillId });
			await loadInstalled();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			showError(`Failed to install: ${msg}`);
		} finally {
			setInstallingSet((prev) => prev.filter((id) => id !== skillId));
		}
	};

	const handleRemove = async (skillId: string) => {
		const name = resolveSkillName(skillId);
		try {
			await invoke("remove_skill", { name });
			await loadInstalled();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			showError(`Failed to remove: ${msg}`);
		}
	};

	const isInstalled = (skillId: string): boolean => {
		// Extract the skill name from the ID
		// Handles: "owner/repo@name" → "name", "owner/repo/name" → "name", "name" → "name"
		let candidate = skillId.split("@").pop() || skillId;
		// If it still looks like a path, extract last segment
		if (candidate.includes("/")) {
			candidate = candidate.split("/").pop() || candidate;
		}
		return installed.some((s) => s.name === candidate);
	};

	// Resolve a skill ID to the actual installed directory name for removal
	const resolveSkillName = (skillId: string): string => {
		let candidate = skillId.split("@").pop() || skillId;
		if (candidate.includes("/")) {
			candidate = candidate.split("/").pop() || candidate;
		}
		// If we have an exact match in installed, use that
		const exact = installed.find((s) => s.name === candidate);
		if (exact) return exact.name;
		// Fallback: find by substring match
		const fuzzy = installed.find((s) => skillId.includes(s.name));
		if (fuzzy) return fuzzy.name;
		return candidate;
	};

	// Determine if the detail skill is removable (look up in installed list)
	const detailSkillRemovable = detailSkill
		? (installed.find((s) => {
				const candidate = detailSkill.id.split("@").pop() || detailSkill.id;
				const name = candidate.includes("/") ? candidate.split("/").pop() || candidate : candidate;
				return s.name === name;
			})?.removable ?? true)
		: true;

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 border-b border-border">
				<p className="text-xs text-muted-foreground">
					Discover and install agent skills from skills.sh
				</p>
			</div>

			{/* Search */}
			<div className="px-4 py-2.5">
				<div className="relative">
					<svg
						className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
						role="img"
					>
						<title>Search</title>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						type="text"
						placeholder="Search skills by name or keyword..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="w-full pl-8 pr-3 py-2 text-xs bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-all"
					/>
				</div>
			</div>

			{/* Error banner */}
			{errorMsg && (
				<div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
					<p className="text-xs text-destructive">{errorMsg}</p>
				</div>
			)}

			{/* Scrollable results */}
			<div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
				{/* Search Results */}
				{query.trim() && (
					<section>
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-xs font-semibold text-foreground">Search results</h3>
							{!searching && searchResults.length > 0 && (
								<span className="text-[10px] text-muted-foreground/50">
									{searchResults.length} skill{searchResults.length !== 1 ? "s" : ""}
								</span>
							)}
						</div>
						{searching ? (
							<div className="flex items-center justify-center py-8">
								<div className="flex flex-col items-center gap-2">
									<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
									<p className="text-xs text-muted-foreground/60">Searching skills...</p>
								</div>
							</div>
						) : searchResults.length === 0 ? (
							<div className="py-8 text-center">
								<svg
									className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									aria-hidden="true"
									role="img"
								>
									<title>No results</title>
									<circle cx="11" cy="11" r="8" />
									<path d="m21 21-4.3-4.3" />
								</svg>
								<p className="text-xs text-muted-foreground/50">
									No skills found for &ldquo;{query}&rdquo;
								</p>
								<p className="text-[10px] text-muted-foreground/30 mt-1">
									Try a different search term
								</p>
							</div>
						) : (
							<div className="space-y-1.5">
								{searchResults.map((skill) => (
									<ExtensionCard
										key={skill.id}
										skill={skill}
										installed={isInstalled(skill.id)}
										isInstalling={installingSet.includes(skill.id)}
										onInstall={handleInstall}
										onRemove={handleRemove}
										onShowDetail={setDetailSkill}
									/>
								))}
							</div>
						)}
					</section>
				)}

				{/* Installed Skills */}
				<section>
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-xs font-semibold text-foreground">Installed Skills</h3>
						{installed.length > 0 && (
							<span className="text-[10px] text-muted-foreground/50">
								{installed.length} skill{installed.length !== 1 ? "s" : ""}
							</span>
						)}
					</div>
					{installed.length === 0 ? (
						<div className="py-6 text-center">
							<svg
								className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								aria-hidden="true"
								role="img"
							>
								<title>No skills</title>
								<path d="M12 2L2 7l10 5 10-5-10-5z" />
								<path d="M2 17l10 5 10-5" />
								<path d="M2 12l10 5 10-5" />
							</svg>
							<p className="text-xs text-muted-foreground/50">No skills installed yet</p>
							<p className="text-[10px] text-muted-foreground/30 mt-1">
								Search above to discover and install skills
							</p>
						</div>
					) : (
						<div className="space-y-1.5">
							{installed.map((skill) => {
								// Create a slim SkillResult for the card
								const skillResult: SkillResult = {
									id: skill.name,
									installCount: 0,
									url: "",
								};
								return (
									<ExtensionCard
										key={skill.name}
										skill={skillResult}
										installed={true}
										isInstalling={installingSet.includes(skill.name)}
										removable={skill.removable ?? true}
										onInstall={handleInstall}
										onRemove={handleRemove}
										onShowDetail={setDetailSkill}
									/>
								);
							})}
						</div>
					)}
				</section>
			</div>

			{/* Detail modal */}
			<ExtensionDetail
				skill={detailSkill}
				open={detailSkill !== null}
				onClose={() => setDetailSkill(null)}
				installed={detailSkill ? isInstalled(detailSkill.id) : false}
				isInstalling={installingSet.includes(detailSkill?.id ?? "")}
				removable={detailSkillRemovable}
				onInstall={handleInstall}
				onRemove={handleRemove}
			/>
		</div>
	);
}
