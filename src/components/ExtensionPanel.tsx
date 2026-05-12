/**
 * ExtensionPanel — Extensions management UI for the sidebar
 *
 * Shows installed extensions, allows install/uninstall/enable/disable.
 * Installed extensions are discovered from ~/.zosmaai/agent/extensions/
 * and pi's settings.json packages.
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { useExtensions } from "@/hooks/useExtensions";
import type { ZemExtension } from "@/types";
import {
	AlertCircle,
	Loader2,
	Package,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";

interface ExtensionPanelProps {
	onReload: () => void;
}

export function ExtensionPanel({ onReload }: ExtensionPanelProps) {
	const { extensions, loading, error, refresh, install, uninstall, setEnabled, searchDiscover, installing } =
		useExtensions();
	const [selectedExt, setSelectedExt] = useState<string | null>(null);

	// Discover / search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<Array<{
		name: string;
		description: string;
		version: string;
		score: number;
	}>>([]);
	const [searching, setSearching] = useState(false);

	async function handleSearch() {
		if (!searchQuery.trim()) return;
		setSearching(true);
		try {
			const results = await searchDiscover(searchQuery.trim());
			setSearchResults(results);
		} catch {
			// Error is handled by the hook's error state
		} finally {
			setSearching(false);
		}
	}

	async function handleUninstall(ext: ZemExtension) {
		if (!confirm(`Uninstall "${ext.name}"?`)) return;
		await uninstall(ext.id);
		if (selectedExt === ext.id) setSelectedExt(null);
		onReload();
	}

	async function handleToggle(ext: ZemExtension) {
		await setEnabled(ext.id, !ext.enabled);
		onReload();
	}

	const selected = extensions.find((e) => e.id === selectedExt);

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2">
				<span className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
					Extensions
				</span>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={refresh}
						className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
						aria-label="Refresh"
					>
						<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
					</button>
				</div>
			</div>

			<ScrollArea className="flex-1 px-2">
				{error && (
					<div
						className="mx-2 px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 mb-2"
						style={{
							background: "hsl(var(--tool-error-bg))",
							color: "hsl(var(--tool-error-fg))",
						}}
					>
						<AlertCircle className="w-3 h-3 shrink-0" />
						{error}
					</div>
				)}

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="w-5 h-5 animate-spin text-sidebar-foreground/30" />
					</div>
				) : extensions.length === 0 ? (
					<div className="px-2 py-8 text-center">
						<div className="w-10 h-10 rounded-full bg-sidebar-accent mx-auto mb-2 flex items-center justify-center">
							<Package className="w-5 h-5 text-sidebar-foreground/50" />
						</div>
						<p className="text-xs text-sidebar-foreground/50 mb-2">No extensions installed</p>
						<p className="text-[10px] text-sidebar-foreground/30 mb-3">
							Search and install from the Discover section below
						</p>
					</div>
				) : selected ? (
					<ExtensionDetail
						ext={selected}
						onBack={() => setSelectedExt(null)}
						onToggle={() => handleToggle(selected)}
						onUninstall={() => handleUninstall(selected)}
					/>
				) : (
					<div className="space-y-0.5 py-1">
						{extensions.map((ext) => (
							<ExtensionCard
								key={ext.id}
								extension={ext}
								onSelect={() => setSelectedExt(ext.id)}
								onToggle={() => handleToggle(ext)}
								onUninstall={() => handleUninstall(ext)}
							/>
						))}
					</div>
				)}



				{/* ── Discover section ── */}
				<div className="px-1 py-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
					<div className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-2">
						Discover
					</div>

					<div className="space-y-2">
							{/* Search input */}
							<div className="flex gap-1.5">
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSearch()}
									placeholder="Search pi extensions..."
									className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent outline-none transition-colors"
									style={{
										borderColor: "hsl(var(--border))",
										color: "hsl(var(--foreground))",
									}}
								/>
								<button
									type="button"
									onClick={handleSearch}
									disabled={searching || !searchQuery.trim()}
									className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
									style={{
										background: "hsl(var(--primary))",
										color: "hsl(var(--primary-foreground))",
									}}
								>
									{searching ? (
										<Loader2 className="w-3 h-3 animate-spin" />
									) : (
										"Search"
									)}
								</button>
							</div>

							{/* Quick search tags */}
							<div className="flex flex-wrap gap-1">
								{[{ label: "pi extensions", query: "keywords:pi" }, { label: "@zosmaai", query: "scope:@zosmaai" }, { label: "pi tools", query: "pi agent extension" }].map(
									(tag) => (
										<button
											key={tag.label}
											type="button"
											onClick={() => {
												setSearchQuery(tag.query);
												handleSearch();
											}}
											className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
											style={{
												background: "hsl(var(--muted))",
												color: "hsl(var(--muted-foreground))",
											}}
										>
											{tag.label}
										</button>
									),
								)}
							</div>

							{/* Search results */}
							{searchResults.length > 0 && (
								<div className="space-y-1 mt-2">
									<p className="text-[10px] text-sidebar-foreground/50">
										{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
									</p>
									{searchResults.map((pkg) => {
										const isInstalled = extensions.some((e) => e.id === pkg.name || e.source.value === pkg.name);
										return (
											<div
												key={pkg.name}
												className="rounded-lg border p-2"
												style={{
													borderColor: "hsl(var(--border))",
													background: "hsl(var(--card))",
												}}
											>
												<div className="flex items-center justify-between gap-2">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span
																className="text-xs font-medium truncate"
																style={{ color: "hsl(var(--foreground))" }}
															>
																{pkg.name}
															</span>
															<span className="text-[9px] text-muted-foreground/50 shrink-0">
																v{pkg.version}
															</span>
															{pkg.score > 50 && (
																<span className="text-[9px] shrink-0" style={{ color: "hsl(var(--success))" }}>
																	★ {pkg.score}
																</span>
															)}
														</div>
														{pkg.description && (
															<p className="text-[10px] text-muted-foreground truncate mt-0.5">
																{pkg.description}
															</p>
														)}
													</div>
													<button
														type="button"
														onClick={() => install(pkg.name)}
														disabled={isInstalled || installing === pkg.name}
														className="text-[10px] px-2 py-1 rounded shrink-0 transition-colors disabled:opacity-30"
														style={{
															background: isInstalled
																? "hsl(var(--muted))"
																: installing === pkg.name
																	? "hsl(var(--muted))"
																	: "hsl(var(--primary))",
															color: isInstalled
																? "hsl(var(--muted-foreground))"
																: "hsl(var(--primary-foreground))",
														}}
													>
														{installing === pkg.name ? (
															<Loader2 className="w-3 h-3 animate-spin" />
														) : isInstalled ? (
															"Installed"
														) : (
															"Install"
														)}
													</button>
												</div>
											</div>
										);
									})}
								</div>
							)}

							{searchResults.length === 0 && searchQuery && !searching && (
								<p className="text-[10px] text-sidebar-foreground/40 text-center py-4">
									No results found for "{searchQuery}" try a different search
								</p>
							)}
						</div>
					</div>
			</ScrollArea>
		</>
	);
}

// ─── Extension Card ─────────────────────────────────────────────────

function ExtensionCard({
	extension: ext,
	onSelect,
	onToggle,
	onUninstall,
}: {
	extension: ZemExtension;
	onSelect: () => void;
	onToggle: () => void;
	onUninstall: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="w-full text-left px-2.5 py-2 rounded-md transition-colors relative flex items-start gap-2"
			style={{ color: "hsl(var(--sidebar-foreground))" }}
		>
			{/* Icon */}
			<div
				className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
				style={{
					background: ext.enabled
						? "hsl(var(--primary) / 0.15)"
						: "hsl(var(--muted))",
					color: ext.enabled
						? "hsl(var(--primary))"
						: "hsl(var(--muted-foreground))",
				}}
			>
				{ext.icon || ext.name.charAt(0).toUpperCase()}
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="text-sm font-medium truncate">{ext.name}</span>
					<span className="text-[10px] text-sidebar-foreground/40 truncate shrink-0">
						v{ext.version}
					</span>
				</div>
				{ext.description && (
					<p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
						{ext.description}
					</p>
				)}
			</div>

			{/* Toggle — always visible */}
			<label
				className="relative inline-flex items-center shrink-0 cursor-pointer"
				onClick={(e) => e.stopPropagation()}
			>
				<input
					type="checkbox"
					checked={ext.enabled}
					onChange={onToggle}
					className="sr-only peer"
				/>
				<div
					className="w-7 h-4 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:rounded-full after:h-3 after:w-3 after:transition-all"
					style={{
						background: ext.enabled ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
					}}
				/>
			</label>

			{/* Uninstall — always visible */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onUninstall();
				}}
				className="p-1 rounded hover:bg-sidebar-accent/80 transition-colors shrink-0"
				aria-label="Uninstall"
				title="Uninstall"
			>
				<Trash2 className="w-3 h-3" style={{ color: "hsl(var(--destructive))" }} />
			</button>
		</button>
	);
}

// ─── Extension Detail View ──────────────────────────────────────────

function ExtensionDetail({
	ext,
	onBack,
	onToggle,
	onUninstall,
}: {
	ext: ZemExtension;
	onBack: () => void;
	onToggle: () => void;
	onUninstall: () => void;
}) {
	return (
		<div className="p-2 space-y-3">
			{/* Back button */}
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-1 text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
			>
				<ChevronLeft className="w-3 h-3" />
				Back to Extensions
			</button>

			{/* Header */}
			<div className="flex items-start gap-2.5">
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
					style={{
						background: "hsl(var(--primary) / 0.15)",
						color: "hsl(var(--primary))",
					}}
				>
					{ext.icon || ext.name.charAt(0).toUpperCase()}
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-sm font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
						{ext.name}
					</h3>
					<p className="text-[10px] text-muted-foreground">
						v{ext.version}
						{ext.author && <> · by {ext.author}</>}
					</p>
					{ext.description && (
						<p className="text-xs text-muted-foreground mt-1">{ext.description}</p>
					)}
				</div>
			</div>

			{/* Source info */}
			<div
				className="rounded-lg p-2 text-[10px]"
				style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
			>
				<div className="flex items-center gap-1.5">
					<Package className="w-3 h-3" />
					<span className="font-medium">Source:</span>
					<span className="font-mono">{ext.source.value}</span>
				</div>
				{ext.installPath && (
					<div className="flex items-center gap-1.5 mt-1">
						<span className="font-medium">Path:</span>
						<span className="font-mono truncate">{ext.installPath}</span>
					</div>
				)}
				<div className="flex items-center gap-1.5 mt-1">
					<span className="font-medium">Runtime:</span>
					<span className="uppercase">{ext.runtime}</span>
				</div>
			</div>

			{/* Capabilities */}
			{ext.capabilities.tools && ext.capabilities.tools.length > 0 && (
				<div>
					<h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
						Tools
					</h4>
					<div className="space-y-1">
						{ext.capabilities.tools.map((tool) => (
							<div
								key={tool.name}
								className="rounded-lg p-1.5"
								style={{ background: "hsl(var(--muted))" }}
							>
								<p className="text-xs font-mono" style={{ color: "hsl(var(--foreground))" }}>
									{tool.name}
								</p>
								{tool.description && (
									<p className="text-[10px] text-muted-foreground">{tool.description}</p>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{ext.capabilities.skills && ext.capabilities.skills.length > 0 && (
				<div>
					<h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
						Skills
					</h4>
					<div className="flex flex-wrap gap-1">
						{ext.capabilities.skills.map((skill) => (
							<span
								key={skill}
								className="text-[10px] px-1.5 py-0.5 rounded-md"
								style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
							>
								{skill}
							</span>
						))}
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={onToggle}
					className="flex-1 text-xs px-3 py-1.5 rounded-lg border transition-colors"
					style={{
						borderColor: "hsl(var(--border))",
						color: "hsl(var(--foreground))",
					}}
				>
					{ext.enabled ? "Disable" : "Enable"}
				</button>
				<button
					type="button"
					onClick={onUninstall}
					className="flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors"
					style={{
						borderColor: "hsl(var(--destructive) / 0.3)",
						color: "hsl(var(--destructive))",
					}}
				>
					<Trash2 className="w-3 h-3" />
					Uninstall
				</button>
			</div>
		</div>
	);
}

// Missing icon
function ChevronLeft({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<path d="M15 18l-6-6 6-6" />
		</svg>
	);
}
