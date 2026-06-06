/**
 * SkillsPanel — app-store style marketplace for agent skills (skills.sh).
 *
 * Top search → live results. A "Discover / Installed" switch toggles between a
 * curated featured set (filterable by category, paginated) and the user's
 * installed skills. Every tile opens a SKILL.md reader; remote skills are
 * fetched best-effort, installed skills are read from disk.
 */

import { invoke } from "@tauri-apps/api/core";
import { Package, Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	FEATURED_CATEGORIES,
	FEATURED_SKILLS,
	fetchRemoteSkillMd,
	pageCount,
	paginate,
	parseSkillId,
	readInstalledSkillMd,
} from "../lib/skillBrowse";
import type { InstalledSkill, SkillResult } from "../lib/skillRegistry";
import { type ReaderTarget, SkillReader } from "./store/SkillReader";
import { SkillTile, type SkillTileData } from "./store/SkillTile";
import {
	FilterChips,
	Pagination,
	SectionHeader,
	StoreEmpty,
	StoreLoading,
	StoreSearch,
	StoreTabs,
} from "./store/StoreUI";

type View = "discover" | "installed";
const PER_PAGE = 9;

export function SkillsPanel() {
	const [query, setQuery] = useState("");
	const [view, setView] = useState<View>("discover");
	const [category, setCategory] = useState("All");
	const [searchResults, setSearchResults] = useState<SkillResult[]>([]);
	const [installed, setInstalled] = useState<InstalledSkill[]>([]);
	const [searching, setSearching] = useState(false);
	const [installingSet, setInstallingSet] = useState<string[]>([]);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [reader, setReader] = useState<ReaderTarget | null>(null);

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

	useEffect(() => {
		loadInstalled().catch(() => {});
	}, [loadInstalled]);

	// Debounced skills.sh search
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
				const result = await invoke<unknown>("search_skills", { query: query.trim() });
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
		}, 450);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query]);

	// Reset pagination when the active dataset changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset keyed on view inputs
	useEffect(() => {
		setPage(0);
	}, [view, category, query]);

	// Typing a query implies the user wants to discover
	useEffect(() => {
		if (query.trim()) setView("discover");
	}, [query]);

	const installedNames = useMemo(() => new Set(installed.map((s) => s.name)), [installed]);

	const isInstalled = useCallback(
		(id: string): boolean => installedNames.has(parseSkillId(id).skillName),
		[installedNames],
	);

	const findInstalled = useCallback(
		(id: string): InstalledSkill | undefined =>
			installed.find((s) => s.name === parseSkillId(id).skillName),
		[installed],
	);

	const handleInstall = useCallback(
		async (id: string) => {
			setInstallingSet((p) => [...p, id]);
			try {
				await invoke("install_skill", { source: id });
				await loadInstalled();
			} catch (err) {
				showError(`Failed to install: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				setInstallingSet((p) => p.filter((x) => x !== id));
			}
		},
		[loadInstalled, showError],
	);

	const handleRemove = useCallback(
		async (id: string) => {
			const name = findInstalled(id)?.name ?? parseSkillId(id).skillName;
			try {
				await invoke("remove_skill", { name });
				await loadInstalled();
				setReader((r) => (r && r.id === id ? null : r));
			} catch (err) {
				showError(`Failed to remove: ${err instanceof Error ? err.message : String(err)}`);
			}
		},
		[findInstalled, loadInstalled, showError],
	);

	// Build the reader target (carries local path when installed)
	const openReader = useCallback(
		(id: string) => {
			const inst = findInstalled(id);
			const parsed = parseSkillId(id);
			setReader({
				id,
				displayName: parsed.displayName,
				source: parsed.source,
				url: `https://skills.sh/${id}`,
				path: inst?.path,
				installed: !!inst,
				removable: inst?.removable ?? true,
			});
		},
		[findInstalled],
	);

	const loadMd = useCallback(async (t: ReaderTarget): Promise<string | null> => {
		if (t.path) {
			const local = await readInstalledSkillMd(t.path);
			if (local) return local;
		}
		return fetchRemoteSkillMd(t.id);
	}, []);

	// ── Build the active dataset ──────────────────────────────────────
	const discoverItems: SkillTileData[] = useMemo(() => {
		if (query.trim()) {
			return searchResults.map((s) => {
				const p = parseSkillId(s.id);
				return {
					id: s.id,
					displayName: p.displayName,
					source: p.source,
					installCount: s.installCount,
				};
			});
		}
		const list =
			category === "All" ? FEATURED_SKILLS : FEATURED_SKILLS.filter((s) => s.category === category);
		return list.map((s) => ({
			id: s.id,
			displayName: parseSkillId(s.id).displayName,
			source: s.source,
			category: s.category,
			installCount: s.installCount,
		}));
	}, [query, searchResults, category]);

	const installedItems: SkillTileData[] = useMemo(
		() =>
			installed.map((s) => ({
				id: s.path ? `${s.path}` : s.name,
				displayName: parseSkillId(s.name).displayName,
				source: s.scope === "global" ? "global" : s.scope,
			})),
		[installed],
	);

	const activeItems = view === "discover" ? discoverItems : installedItems;
	const totalPages = pageCount(activeItems.length, PER_PAGE);
	const pageItems = paginate(activeItems, Math.min(page, totalPages - 1), PER_PAGE);

	return (
		<div className="flex flex-col">
			{/* Intro */}
			<div className="mb-4">
				<p className="text-xs text-muted-foreground">
					Discover and install agent skills from{" "}
					<span className="font-medium text-foreground/80">skills.sh</span> — click any skill to
					read its SKILL.md.
				</p>
			</div>

			{/* Search — top, prominent */}
			<StoreSearch
				value={query}
				onChange={setQuery}
				busy={searching}
				placeholder="Search skills by name or keyword..."
			/>

			{/* View switch + filters */}
			<div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-4">
				<StoreTabs<View>
					value={view}
					onChange={setView}
					tabs={[
						{ value: "discover", label: "Discover" },
						{ value: "installed", label: "Installed", count: installed.length },
					]}
				/>
				{view === "discover" && !query.trim() && (
					<FilterChips
						options={FEATURED_CATEGORIES.map((c) => ({ value: c, label: c }))}
						value={category}
						onChange={setCategory}
					/>
				)}
			</div>

			{errorMsg && (
				<div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
					<p className="text-xs text-destructive">{errorMsg}</p>
				</div>
			)}

			{/* Content */}
			{view === "discover" ? (
				<section>
					<SectionHeader
						title={query.trim() ? "Search results" : "Featured skills"}
						count={query.trim() ? (searching ? undefined : activeItems.length) : undefined}
					/>
					{searching && query.trim() ? (
						<StoreLoading label="Searching skills.sh…" />
					) : activeItems.length === 0 ? (
						<StoreEmpty
							icon={<SearchIcon className="w-5 h-5" />}
							title={query.trim() ? `No skills found for "${query}"` : "No skills in this category"}
							hint={query.trim() ? "Try a different search term." : undefined}
						/>
					) : (
						<>
							<SkillGrid
								items={pageItems}
								isInstalled={isInstalled}
								installingSet={installingSet}
								findInstalled={findInstalled}
								onOpen={openReader}
								onInstall={handleInstall}
								onRemove={handleRemove}
							/>
							<Pagination
								page={Math.min(page, totalPages - 1)}
								pageCount={totalPages}
								onPage={setPage}
							/>
						</>
					)}
				</section>
			) : (
				<section>
					<SectionHeader title="Installed skills" count={installed.length} />
					{installed.length === 0 ? (
						<StoreEmpty
							icon={<Package className="w-5 h-5" />}
							title="No skills installed yet"
							hint="Discover and install skills to sharpen the agent for specific tasks."
						/>
					) : (
						<>
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
								{pageItems.map((item) => {
									const inst = installed.find((s) => (s.path || s.name) === item.id);
									return (
										<SkillTile
											key={item.id}
											skill={item}
											installed
											installing={false}
											removable={inst?.removable ?? true}
											onOpen={() => {
												if (inst) {
													setReader({
														id: inst.path || inst.name,
														displayName: item.displayName,
														source: item.source,
														url: `https://skills.sh/${inst.name}`,
														path: inst.path,
														installed: true,
														removable: inst.removable ?? true,
													});
												}
											}}
											onInstall={() => {}}
											onRemove={() => inst && handleRemove(inst.path || inst.name)}
										/>
									);
								})}
							</div>
							<Pagination
								page={Math.min(page, totalPages - 1)}
								pageCount={totalPages}
								onPage={setPage}
							/>
						</>
					)}
				</section>
			)}

			<SkillReader
				target={reader}
				open={reader !== null}
				loadMd={loadMd}
				installing={reader ? installingSet.includes(reader.id) : false}
				onClose={() => setReader(null)}
				onInstall={handleInstall}
				onRemove={handleRemove}
			/>
		</div>
	);
}

function SkillGrid({
	items,
	isInstalled,
	installingSet,
	findInstalled,
	onOpen,
	onInstall,
	onRemove,
}: {
	items: SkillTileData[];
	isInstalled: (id: string) => boolean;
	installingSet: string[];
	findInstalled: (id: string) => InstalledSkill | undefined;
	onOpen: (id: string) => void;
	onInstall: (id: string) => void;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
			{items.map((item) => (
				<SkillTile
					key={item.id}
					skill={item}
					installed={isInstalled(item.id)}
					installing={installingSet.includes(item.id)}
					removable={findInstalled(item.id)?.removable ?? true}
					onOpen={onOpen}
					onInstall={onInstall}
					onRemove={onRemove}
				/>
			))}
		</div>
	);
}
