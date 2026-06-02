import type { ModelInfo } from "@/types";
import { Check, ChevronUp, Search, Sparkles, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModelSelectorProps {
	models: ModelInfo[];
	currentModelId?: string;
	onSelect: (provider: string, modelId: string) => void;
}

/** Short readable provider label */
function providerShort(provider: string): string {
	return provider.replace(/-?(api|ai|platform|provider)$/i, "").split("-")[0];
}

export function ModelSelector({ models, currentModelId, onSelect }: ModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
	const triggerRef = useRef<HTMLButtonElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	const current = models.find((m) => m.id === currentModelId);
	const label = current ? current.name : currentModelId || "Default";
	const shortProvider = current ? providerShort(current.provider) : "";

	// Position the portal dropdown; prefer above since input sits at the bottom
	const recalcPosition = useCallback(() => {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const DROPDOWN_H = 320;
		const DROPDOWN_W = 264;
		const placeAbove = rect.top > DROPDOWN_H || rect.top > window.innerHeight - rect.bottom;
		const left = Math.min(rect.left, window.innerWidth - DROPDOWN_W - 8);

		if (placeAbove) {
			setDropdownStyle({
				position: "fixed",
				left,
				bottom: window.innerHeight - rect.top + 6,
				width: DROPDOWN_W,
				zIndex: 9999,
			});
		} else {
			setDropdownStyle({
				position: "fixed",
				left,
				top: rect.bottom + 6,
				width: DROPDOWN_W,
				zIndex: 9999,
			});
		}
	}, []);

	const handleOpen = useCallback(() => {
		recalcPosition();
		setOpen(true);
		setQuery("");
	}, [recalcPosition]);

	useEffect(() => {
		if (!open) return;
		function close(e: MouseEvent) {
			if (
				triggerRef.current &&
				!triggerRef.current.contains(e.target as Node) &&
				!(e.target as HTMLElement).closest("[data-model-dropdown]")
			)
				setOpen(false);
		}
		function onScroll() {
			recalcPosition();
		}
		document.addEventListener("mousedown", close);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("mousedown", close);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [open, recalcPosition]);

	useEffect(() => {
		if (open) requestAnimationFrame(() => searchRef.current?.focus());
	}, [open]);

	const grouped = useMemo(() => {
		const q = query.toLowerCase().trim();
		const filtered = q
			? models.filter(
					(m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
				)
			: models;
		const map = new Map<string, ModelInfo[]>();
		for (const m of filtered) {
			if (!map.has(m.provider)) map.set(m.provider, []);
			map.get(m.provider)?.push(m);
		}
		return map;
	}, [models, query]);

	const totalFiltered = useMemo(() => [...grouped.values()].flat().length, [grouped]);

	return (
		<>
			{/* ── Trigger ── */}
			<button
				ref={triggerRef}
				type="button"
				onClick={open ? () => setOpen(false) : handleOpen}
				className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors
				           text-muted-foreground hover:text-foreground hover:bg-accent/60"
			>
				<Sparkles className="w-3 h-3 shrink-0 text-primary/70" />
				<span className="max-w-[110px] truncate">{label}</span>
				{shortProvider && (
					<span
						className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider
					                 bg-primary/10 text-primary"
					>
						{shortProvider}
					</span>
				)}
				<ChevronUp
					className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{/* ── Portal dropdown ── */}
			{createPortal(
				<AnimatePresence>
					{open && (
						<motion.div
							data-model-dropdown=""
							initial={{ opacity: 0, y: 6, scale: 0.97 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 6, scale: 0.97 }}
							transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
							className="rounded-xl border overflow-hidden flex flex-col"
							style={{
								...dropdownStyle,
								background: "hsl(var(--popover))",
								borderColor: "hsl(var(--border))",
								boxShadow: "0 16px 48px hsl(0 0% 0% / 0.35), 0 2px 8px hsl(0 0% 0% / 0.2)",
							}}
						>
							{/* Search */}
							<div className="flex items-center gap-2 px-3 py-2 border-b border-border">
								<Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
								<input
									ref={searchRef}
									type="text"
									placeholder="Search models…"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
									className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
								/>
								{query && (
									<span className="text-[10px] text-muted-foreground/50 tabular-nums">
										{totalFiltered}
									</span>
								)}
							</div>

							{/* List */}
							<div className="overflow-y-auto" style={{ maxHeight: 272 }}>
								{grouped.size === 0 ? (
									<p className="px-3 py-6 text-center text-xs text-muted-foreground/50">
										No models found
									</p>
								) : (
									[...grouped.entries()].map(([provider, providerModels]) => (
										<div key={provider}>
											{/* Provider heading */}
											<div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
												<span className="text-[9px] font-bold uppercase tracking-widest text-primary/80">
													{providerShort(provider)}
												</span>
												<div className="flex-1 h-px bg-primary/15" />
											</div>

											{/* Models */}
											{providerModels.map((model) => {
												const isActive = model.id === currentModelId;
												return (
													<button
														key={model.id}
														type="button"
														onClick={() => {
															onSelect(model.provider, model.id);
															setOpen(false);
														}}
														className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
														            ${
																					isActive
																						? "bg-primary/10 text-foreground"
																						: "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
																				}`}
													>
														{/* Icon: reasoning = sparkle (primary), fast = zap (muted) */}
														{model.reasoning ? (
															<Sparkles className="w-3 h-3 shrink-0 text-primary/70" />
														) : (
															<Zap className="w-3 h-3 shrink-0 text-muted-foreground/40" />
														)}

														{/* Name + context window */}
														<div className="flex-1 min-w-0">
															<span
																className={`text-xs truncate block ${isActive ? "font-semibold text-foreground" : ""}`}
															>
																{model.name}
															</span>
															{model.contextWindow > 0 && (
																<span className="text-[10px] text-muted-foreground/50 block">
																	{model.contextWindow >= 1000
																		? `${Math.round(model.contextWindow / 1000)}k ctx`
																		: `${model.contextWindow} ctx`}
																</span>
															)}
														</div>

														{/* Active tick */}
														{isActive && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
													</button>
												);
											})}
										</div>
									))
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</>
	);
}
