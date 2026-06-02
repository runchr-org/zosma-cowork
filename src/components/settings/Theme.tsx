import { getThemeMode, toggleTheme } from "@/lib/themes";
import { Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export function Theme() {
	const [themeMode, setThemeMode] = useState<"dark" | "light">(getThemeMode());
	const reduced = useReducedMotion();
	const isDark = themeMode === "dark";

	function handleToggle() {
		const next = toggleTheme();
		setThemeMode(next);
	}

	return (
		<section>
			<h2 className="text-sm font-semibold text-foreground mb-1">Appearance</h2>
			<p className="text-xs text-muted-foreground mb-5">Choose how Zosma looks on this device.</p>

			<motion.button
				type="button"
				onClick={handleToggle}
				className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border"
				whileHover={reduced ? {} : { background: "hsl(var(--muted) / 0.3)" }}
				whileTap={reduced ? {} : { scale: 0.99 }}
				transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
				style={{ background: "transparent" }}
			>
				<div className="flex items-center gap-3">
					<div
						className="flex items-center justify-center w-8 h-8 rounded-lg"
						style={{ background: "hsl(var(--muted) / 0.6)" }}
					>
						{isDark ? (
							<Moon className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
						) : (
							<Sun className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
						)}
					</div>
					<div className="text-left">
						<p className="text-[13px] font-medium text-foreground">
							{isDark ? "Dark mode" : "Light mode"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{isDark ? "Easy on the eyes at night" : "Best in bright environments"}
						</p>
					</div>
				</div>

				{/* Animated toggle */}
				<div
					className="relative w-10 h-[22px] rounded-full shrink-0"
					style={{
						background: isDark ? "hsl(var(--primary))" : "hsl(var(--muted))",
						transition: "background 200ms",
					}}
				>
					<motion.div
						className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
						animate={{ x: isDark ? 20 : 2 }}
						transition={
							reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35, mass: 0.8 }
						}
					/>
				</div>
			</motion.button>
		</section>
	);
}
