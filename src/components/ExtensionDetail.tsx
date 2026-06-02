import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useState } from "react";
import type { NpmData, SkillResult } from "../lib/skillRegistry";
import {
	fetchNpmDataForSkill,
	formatDate,
	formatInstallCount,
	formatSize,
} from "../lib/skillRegistry";
import { openExternalUrl } from "../lib/utils";

interface ExtensionDetailProps {
	skill: SkillResult | null;
	open: boolean;
	onClose: () => void;
	installed: boolean;
	isInstalling: boolean;
	removable?: boolean;
	onInstall: (id: string) => void;
	onRemove: (id: string) => void;
}

export function ExtensionDetail({
	skill,
	open,
	onClose,
	installed,
	isInstalling,
	removable = true,
	onInstall,
	onRemove,
}: ExtensionDetailProps) {
	const [npmData, setNpmData] = useState<NpmData | null>(null);
	const [fetching, setFetching] = useState(true);
	const [error, setError] = useState(false);
	const reduced = useReducedMotion();
	const titleId = useId();
	const skillId = skill?.id ?? null;

	useEffect(() => {
		if (!open || !skillId) return;
		let cancelled = false;
		setFetching(true);
		setError(false);
		fetchNpmDataForSkill(skillId).then((data) => {
			if (!cancelled) {
				setNpmData(data);
				setFetching(false);
				if (!data) setError(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [open, skillId]);

	const handleInstall = useCallback(() => {
		if (skillId) onInstall(skillId);
	}, [skillId, onInstall]);

	const handleRemove = useCallback(() => {
		if (skillId) onRemove(skillId);
	}, [skillId, onRemove]);

	if (!skill) return null;

	const displayName = npmData?.name || skill.id;

	return (
		<Dialog open={open} onClose={onClose} size="md" labelledBy={titleId}>
			<DialogHeader
				title={displayName}
				description={npmData?.description}
				onClose={onClose}
				titleId={titleId}
			/>

			<DialogBody scrollable className="space-y-3">
				<AnimatePresence mode="wait">
					{fetching ? (
						<motion.div
							key="loading"
							initial={reduced ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
							className="flex items-center justify-center py-10"
						>
							<div className="flex flex-col items-center gap-2">
								<Loader2 className="w-5 h-5 text-primary animate-spin" />
								<p className="text-xs text-muted-foreground">Loading details…</p>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="content"
							initial={reduced ? false : { opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
							className="space-y-3"
						>
							{/* Package details grid */}
							<div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
								{npmData?.version && (
									<>
										<DetailRow label="Package" value={npmData.name} />
										<DetailRow label="Version" value={`v${npmData.version}`} />
									</>
								)}
								{npmData?.published && (
									<DetailRow label="Published" value={formatDate(npmData.published)} />
								)}
								<DetailRow
									label="Downloads"
									value={`${formatInstallCount(skill.installCount)} total`}
								/>
								{npmData?.author && <DetailRow label="Author" value={npmData.author} />}
								{npmData?.license && <DetailRow label="License" value={npmData.license} />}
								{npmData?.typeLabel && <DetailRow label="Types" value={npmData.typeLabel} />}
								{npmData?.unpackedSize ? (
									<DetailRow label="Size" value={formatSize(npmData.unpackedSize)} />
								) : (
									<DetailRow label="Size" value="—" />
								)}
								{npmData ? (
									<DetailRow
										label="Dependencies"
										value={`${npmData.deps} dependencies${npmData.peerDeps > 0 ? ` · ${npmData.peerDeps} peers` : ""}`}
									/>
								) : (
									<DetailRow label="Dependencies" value="—" />
								)}
							</div>

							{/* Links */}
							<div className="flex flex-col gap-1 pt-1">
								{skill.url && (
									<button
										type="button"
										onClick={async () => {
											try {
												await openExternalUrl(skill.url);
											} catch (e) {
												console.error("Failed to open URL:", e);
											}
										}}
										className="text-xs text-primary hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 self-start"
									>
										<ExternalLink className="w-3 h-3" />
										View on skills.sh
									</button>
								)}
								{npmData?.homepage && (
									<button
										type="button"
										onClick={async () => {
											try {
												await openExternalUrl(npmData.homepage);
											} catch (e) {
												console.error("Failed to open homepage:", e);
											}
										}}
										className="text-xs text-primary hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 self-start"
									>
										<Globe className="w-3 h-3" />
										Homepage
									</button>
								)}
							</div>

							{error && (
								<div className="py-3 text-center">
									<p className="text-xs text-muted-foreground">
										No npm registry data found for this skill.
									</p>
									<p className="text-[10px] text-muted-foreground/60 mt-1">
										Package ID: {skill.id}
									</p>
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</DialogBody>

			<DialogFooter>
				<button
					type="button"
					onClick={onClose}
					className="px-3 py-1.5 text-xs font-medium text-muted-foreground rounded-md hover:bg-muted/70 transition-colors active:scale-[0.97]"
				>
					Close
				</button>
				{installed && removable ? (
					<button
						type="button"
						onClick={handleRemove}
						className="px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md hover:bg-destructive/15 transition-colors active:scale-[0.97]"
					>
						Remove
					</button>
				) : installed && !removable ? (
					<span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md">
						System
					</span>
				) : (
					<button
						type="button"
						disabled={isInstalling}
						onClick={handleInstall}
						className="relative px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-md hover:brightness-110 disabled:opacity-50 transition-all active:scale-[0.97] min-w-[90px]"
					>
						<AnimatePresence mode="wait" initial={false}>
							{isInstalling ? (
								<motion.span
									key="installing"
									initial={reduced ? false : { opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.16 }}
									className="flex items-center justify-center gap-1.5"
								>
									<Loader2 className="w-3 h-3 animate-spin" />
									Installing…
								</motion.span>
							) : (
								<motion.span
									key="install"
									initial={reduced ? false : { opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.16 }}
									className="block"
								>
									Install
								</motion.span>
							)}
						</AnimatePresence>
					</button>
				)}
			</DialogFooter>
		</Dialog>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
			<p className="text-xs text-foreground truncate mt-0.5">{value}</p>
		</div>
	);
}
