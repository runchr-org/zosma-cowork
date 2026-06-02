/**
 * Zosma Cowork — Telemetry consent dialog
 *
 * Full-screen overlay shown on first launch, asking users to opt in to
 * anonymous usage data and crash reports.
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogStagger, DialogStaggerItem } from "@/components/ui/dialog";
import { Check, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

interface TelemetryConsentDialogProps {
	onEnable: () => void;
	onDismiss: () => void;
}

const bulletPoints = [
	"No personal data collected",
	"No user IDs or cookies",
	"Anonymous feature usage only",
	"Crash reports to help fix bugs",
];

export function TelemetryConsentDialog({ onEnable, onDismiss }: TelemetryConsentDialogProps) {
	const titleId = useId();
	const reduced = useReducedMotion();

	return (
		<Dialog open onClose={onDismiss} size="sm" closeOnBackdrop={false} labelledBy={titleId}>
			<div className="px-7 pt-8 pb-6">
				{/* Animated shield icon */}
				<div className="flex justify-center mb-5">
					<motion.div
						className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
						style={{ background: "hsl(var(--primary) / 0.12)" }}
						initial={reduced ? false : { scale: 0.6, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{
							type: "spring",
							stiffness: 320,
							damping: 22,
							delay: 0.12,
						}}
					>
						{/* Subtle pulse halo */}
						{!reduced && (
							<motion.div
								className="absolute inset-0 rounded-2xl"
								style={{ background: "hsl(var(--primary) / 0.18)" }}
								initial={{ scale: 1, opacity: 0.6 }}
								animate={{ scale: 1.6, opacity: 0 }}
								transition={{
									duration: 1.6,
									repeat: Number.POSITIVE_INFINITY,
									repeatDelay: 0.4,
									ease: "easeOut",
								}}
							/>
						)}
						<ShieldCheck className="w-7 h-7 text-primary relative" />
					</motion.div>
				</div>

				<DialogStagger className="text-center" delayChildren={0.18} stagger={0.05}>
					<DialogStaggerItem>
						<h2 id={titleId} className="text-base font-semibold text-card-foreground mb-1.5">
							Help improve Zosma Cowork
						</h2>
					</DialogStaggerItem>

					<DialogStaggerItem>
						<p className="text-sm text-muted-foreground leading-relaxed mb-5 px-1">
							Zosma is free and open-source. Opting in helps us build a better product — completely
							anonymously.
						</p>
					</DialogStaggerItem>

					{/* Bullet points */}
					<DialogStaggerItem>
						<ul className="space-y-2 mb-6 text-left">
							{bulletPoints.map((point, i) => (
								<motion.li
									key={point}
									className="flex items-center gap-2.5 text-[13px] text-foreground/85"
									initial={reduced ? false : { opacity: 0, x: -6 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{
										duration: 0.28,
										delay: 0.32 + i * 0.06,
										ease: [0.16, 1, 0.3, 1],
									}}
								>
									<span
										className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
										style={{ background: "hsl(var(--primary) / 0.15)" }}
									>
										<Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
									</span>
									<span>{point}</span>
								</motion.li>
							))}
						</ul>
					</DialogStaggerItem>

					{/* Buttons */}
					<DialogStaggerItem>
						<div className="space-y-2">
							<Button
								variant="default"
								className="w-full active:scale-[0.98] transition-transform"
								onClick={onEnable}
							>
								Enable telemetry
							</Button>
							<Button
								variant="ghost"
								className="w-full text-muted-foreground hover:text-foreground active:scale-[0.98] transition-transform"
								onClick={onDismiss}
							>
								Not now
							</Button>
						</div>
					</DialogStaggerItem>

					<DialogStaggerItem>
						<p className="text-[11px] text-muted-foreground/70 mt-4">
							You can change this anytime in Settings.
						</p>
					</DialogStaggerItem>
				</DialogStagger>
			</div>
		</Dialog>
	);
}
