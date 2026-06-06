/**
 * StoreUI — shared, app-store-style primitives for the Extensions & Skills
 * marketplaces. Provides a prominent search bar, segmented view switch,
 * filter chips, a responsive tile grid, pagination, and empty/loading states.
 *
 * These are intentionally presentational and engine-agnostic so both the
 * Extensions store (pi npm packages) and the Skills store (skills.sh) share a
 * consistent look and feel.
 */

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { ReactNode } from "react";

// ─── Search bar ─────────────────────────────────────────────────────

export function StoreSearch({
	value,
	onChange,
	placeholder,
	busy,
	autoFocus,
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	busy?: boolean;
	autoFocus?: boolean;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
			<input
				// biome-ignore lint/a11y/noAutofocus: store search is the primary action of the view
				autoFocus={autoFocus}
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
				className="w-full h-11 pl-10 pr-10 text-sm rounded-xl bg-muted/60 border border-border/70 text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:bg-background focus:border-ring focus:ring-2 focus:ring-ring/25"
			/>
			{busy ? (
				<span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			) : value ? (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => onChange("")}
					className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			) : null}
		</div>
	);
}

// ─── Segmented view switch (Discover / Installed) ───────────────────

export function StoreTabs<T extends string>({
	tabs,
	value,
	onChange,
}: {
	tabs: { value: T; label: string; count?: number }[];
	value: T;
	onChange: (v: T) => void;
}) {
	return (
		<div className="inline-flex items-center bg-muted/70 rounded-lg p-0.5 gap-0.5">
			{tabs.map((t) => {
				const active = t.value === value;
				return (
					<button
						key={t.value}
						type="button"
						onClick={() => onChange(t.value)}
						className={cn(
							"px-3.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
							active
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{t.label}
						{typeof t.count === "number" && (
							<span
								className={cn(
									"text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
									active
										? "bg-primary/15 text-primary"
										: "bg-muted-foreground/10 text-muted-foreground/70",
								)}
							>
								{t.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

// ─── Filter chips ───────────────────────────────────────────────────

export function FilterChips({
	options,
	value,
	onChange,
}: {
	options: { value: string; label: string }[];
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={o.value}
						type="button"
						onClick={() => onChange(o.value)}
						className={cn(
							"px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors",
							active
								? "bg-primary/10 border-primary/30 text-primary"
								: "bg-transparent border-border/70 text-muted-foreground hover:text-foreground hover:border-border",
						)}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

// ─── Tile grid ──────────────────────────────────────────────────────

export function TileGrid({ children }: { children: ReactNode }) {
	return <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>;
}

// ─── Section header ─────────────────────────────────────────────────

export function SectionHeader({
	title,
	count,
	action,
}: {
	title: string;
	count?: number;
	action?: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between mb-3">
			<div className="flex items-baseline gap-2">
				<h3 className="text-sm font-semibold text-foreground">{title}</h3>
				{typeof count === "number" && (
					<span className="text-[11px] text-muted-foreground/60 tabular-nums">{count}</span>
				)}
			</div>
			{action}
		</div>
	);
}

// ─── Pagination ─────────────────────────────────────────────────────

export function Pagination({
	page,
	pageCount,
	onPage,
}: {
	page: number;
	pageCount: number;
	onPage: (p: number) => void;
}) {
	if (pageCount <= 1) return null;

	// Compact windowed page numbers
	const pages: (number | "…")[] = [];
	const push = (p: number | "…") => pages.push(p);
	const window = 1;
	for (let p = 0; p < pageCount; p++) {
		if (p === 0 || p === pageCount - 1 || (p >= page - window && p <= page + window)) {
			push(p);
		} else if (pages[pages.length - 1] !== "…") {
			push("…");
		}
	}

	return (
		<nav className="flex items-center justify-center gap-1 pt-5" aria-label="Pagination">
			<button
				type="button"
				disabled={page === 0}
				onClick={() => onPage(page - 1)}
				className="flex items-center justify-center w-8 h-8 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
				aria-label="Previous page"
			>
				<ChevronLeft className="w-4 h-4" />
			</button>
			{pages.map((p, i) =>
				p === "…" ? (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: ellipsis positions are stable for a given page count
						key={`e${i}`}
						className="w-8 h-8 flex items-center justify-center text-muted-foreground/50 text-xs"
					>
						…
					</span>
				) : (
					<button
						key={p}
						type="button"
						onClick={() => onPage(p)}
						aria-current={p === page ? "page" : undefined}
						className={cn(
							"min-w-8 h-8 px-2 rounded-lg text-xs font-medium tabular-nums transition-colors",
							p === page
								? "bg-primary text-primary-foreground"
								: "border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted",
						)}
					>
						{p + 1}
					</button>
				),
			)}
			<button
				type="button"
				disabled={page >= pageCount - 1}
				onClick={() => onPage(page + 1)}
				className="flex items-center justify-center w-8 h-8 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
				aria-label="Next page"
			>
				<ChevronRight className="w-4 h-4" />
			</button>
		</nav>
	);
}

// ─── States ─────────────────────────────────────────────────────────

export function StoreEmpty({
	icon,
	title,
	hint,
}: {
	icon: ReactNode;
	title: string;
	hint?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center text-center py-16">
			<div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/50 mb-3">
				{icon}
			</div>
			<p className="text-sm text-muted-foreground">{title}</p>
			{hint && <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">{hint}</p>}
		</div>
	);
}

export function StoreLoading({ label }: { label?: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-16 gap-3">
			<span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			{label && <p className="text-xs text-muted-foreground/60">{label}</p>}
		</div>
	);
}

// ─── Avatar (deterministic gradient from a seed) ────────────────────

const GRADIENTS = [
	"from-violet-500/80 to-fuchsia-500/80",
	"from-sky-500/80 to-cyan-400/80",
	"from-emerald-500/80 to-teal-400/80",
	"from-amber-500/80 to-orange-500/80",
	"from-rose-500/80 to-pink-500/80",
	"from-indigo-500/80 to-blue-500/80",
	"from-lime-500/80 to-green-500/80",
	"from-purple-500/80 to-violet-500/80",
];

export function gradientFor(seed: string): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return GRADIENTS[h % GRADIENTS.length];
}

export function TileAvatar({
	seed,
	label,
	className,
}: {
	seed: string;
	label: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-semibold shadow-sm",
				gradientFor(seed),
				className,
			)}
		>
			{label.charAt(0).toUpperCase()}
		</div>
	);
}
