/**
 * ExtensionTile — app-store style tile for a pi extension, plus the
 * FeaturedExtensionTile wrapper that resolves live npm metadata for the
 * curated browse set.
 */

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { extensionDisplayName } from "../../lib/extensionBrowse";
import { type NpmData, fetchNpmData } from "../../lib/skillRegistry";
import { TileAvatar } from "./StoreUI";

export function ExtensionTile({
	seed,
	name,
	subtitle,
	version,
	description,
	category,
	onOpen,
	action,
}: {
	seed: string;
	name: string;
	subtitle?: string;
	version?: string;
	description?: string;
	category?: string;
	onOpen?: () => void;
	action: ReactNode;
}) {
	const clickable = !!onOpen;
	return (
		<div
			role={clickable ? "button" : undefined}
			tabIndex={clickable ? 0 : undefined}
			onClick={onOpen}
			onKeyDown={
				clickable
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onOpen?.();
							}
						}
					: undefined
			}
			aria-label={clickable ? `Open ${name}` : undefined}
			className={cn(
				"group relative flex flex-col gap-2.5 p-3.5 rounded-2xl border border-border/70 bg-card/40 transition-all",
				clickable &&
					"cursor-pointer hover:bg-card hover:border-border hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
			)}
		>
			<div className="flex items-start gap-3">
				<TileAvatar seed={seed} label={name} className="w-11 h-11 text-base" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<p className="text-sm font-semibold text-foreground truncate leading-tight">{name}</p>
						{version && (
							<span className="text-[10px] text-muted-foreground/50 shrink-0">v{version}</span>
						)}
					</div>
					{subtitle && (
						<p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
					)}
				</div>
			</div>

			{description && (
				<p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2">
					{description}
				</p>
			)}

			<div className="flex items-center justify-between gap-2 mt-auto pt-0.5">
				{category ? (
					<span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground/80">
						{category}
					</span>
				) : (
					<span />
				)}
				<div className="shrink-0">{action}</div>
			</div>
		</div>
	);
}

/** Resolves npm metadata for a curated package, then renders an ExtensionTile. */
export function FeaturedExtensionTile({
	pkg,
	label,
	category,
	blurb,
	installed,
	installing,
	onInstall,
	onOpenExternal,
}: {
	pkg: string;
	label: string;
	category: string;
	blurb: string;
	installed: boolean;
	installing: boolean;
	onInstall: (pkg: string) => void;
	onOpenExternal: (pkg: string) => void;
}) {
	const [npm, setNpm] = useState<NpmData | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchNpmData(pkg).then((d) => {
			if (!cancelled) setNpm(d);
		});
		return () => {
			cancelled = true;
		};
	}, [pkg]);

	return (
		<ExtensionTile
			seed={pkg}
			name={label || extensionDisplayName(pkg)}
			subtitle={pkg}
			version={npm?.version}
			description={npm?.description || blurb}
			category={category}
			onOpen={() => onOpenExternal(pkg)}
			action={
				installed ? (
					<span className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-primary/10 text-primary">
						Installed
					</span>
				) : (
					<button
						type="button"
						title={`Install ${label}`}
						disabled={installing}
						onClick={(e) => {
							e.stopPropagation();
							onInstall(pkg);
						}}
						className={cn(
							"px-3 py-1 text-[11px] font-semibold rounded-lg transition-all",
							installing
								? "bg-muted text-muted-foreground"
								: "bg-primary text-primary-foreground hover:brightness-110",
						)}
					>
						{installing ? "…" : "Install"}
					</button>
				)
			}
		/>
	);
}
