/**
 * HomeView — Branded splash screen + onboarding
 *
 * Shows a polished splash with logo, tagline, and either the setup flow
 * or a brief "ready" state depending on auth status.
 */

import { useCallback, useState } from "react";

interface OnboardingProps {
	onComplete: (apiKey: string) => Promise<void>;
}

type Step = "splash" | "api-key";

export function HomeView({ onComplete }: OnboardingProps) {
	const [step, setStep] = useState<Step>("splash");
	const [apiKey, setApiKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = useCallback(async () => {
		const trimmed = apiKey.trim();
		if (!trimmed) return;
		setSaving(true);
		setError(null);
		try {
			await onComplete(trimmed);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save API key");
		} finally {
			setSaving(false);
		}
	}, [apiKey, onComplete]);

	// ── Splash ──────────────────────────────────────────────────
	if (step === "splash") {
		return (
			<div className="flex flex-col items-center justify-center h-full px-8 py-12 max-w-lg mx-auto">
				{/* Logo */}
				<div className="mb-6">
					<div
						className="w-20 h-20 rounded-2xl flex items-center justify-center"
						style={{
							background:
								"linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))",
							boxShadow: "0 0 40px hsl(var(--primary) / 0.1)",
						}}
					>
						<span className="text-4xl font-bold" style={{ color: "hsl(var(--primary))" }}>
							Z
						</span>
					</div>
				</div>

				{/* Tagline */}
				<h1
					className="text-3xl font-bold text-center mb-2"
					style={{ color: "hsl(var(--foreground))" }}
				>
					Zosma Cowork
				</h1>
				<p className="text-base text-center mb-8" style={{ color: "hsl(var(--muted-foreground))" }}>
					Your AI pair programmer, always in sync.
				</p>

				{/* Feature highlights */}
				<div className="w-full space-y-2.5 mb-8">
					<FeatureRow icon="⚡" text="Powered by top open-source coding models" />
					<FeatureRow icon="🧩" text="Extensible with tools, skills & themes" />
					<FeatureRow icon="🔒" text="Your code stays local — no data leaves your machine" />
				</div>

				{/* CTA */}
				<div className="w-full space-y-3">
					<button
						type="button"
						onClick={() => setStep("api-key")}
						className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
						style={{
							background: "hsl(var(--primary))",
							color: "hsl(var(--primary-foreground))",
						}}
					>
						Get Started
					</button>
					<button
						type="button"
						onClick={async () => {
							const { invoke } = await import("@tauri-apps/api/core");
							invoke("open_url", { url: "https://zosma.ai" }).catch(() => {
								window.open("https://zosma.ai", "_blank");
							});
						}}
						className="block w-full text-center text-xs py-1.5 cursor-pointer"
						style={{ color: "hsl(var(--muted-foreground))" }}
					>
						Learn more at zosma.ai →
					</button>
				</div>
			</div>
		);
	}

	// ── API Key Entry ────────────────────────────────────────────
	return (
		<div className="flex flex-col items-center justify-center h-full px-8 py-12 max-w-lg mx-auto">
			<div className="mb-6">
				<div
					className="w-14 h-14 rounded-xl flex items-center justify-center"
					style={{
						background: "hsl(var(--primary) / 0.1)",
					}}
				>
					<span className="text-xl">🔑</span>
				</div>
			</div>

			<h1 className="text-xl font-bold mb-2" style={{ color: "hsl(var(--foreground))" }}>
				Enter your API Key
			</h1>
			<p className="text-sm mb-6 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
				Paste your OpenCode Go API key. It stays on your machine.
			</p>

			<div className="w-full space-y-4">
				<input
					type="password"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					placeholder="sk-..."
					className="w-full px-4 py-2.5 rounded-xl border bg-transparent text-sm outline-none transition-colors"
					style={{
						borderColor: "hsl(var(--border))",
						color: "hsl(var(--foreground))",
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && apiKey.trim() && !saving) {
							handleSave();
						}
					}}
				/>
				{error && (
					<p className="text-xs" style={{ color: "hsl(var(--destructive))" }}>
						{error}
					</p>
				)}

				<button
					type="button"
					disabled={!apiKey.trim() || saving}
					onClick={handleSave}
					className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
					style={{
						background: "hsl(var(--primary))",
						color: "hsl(var(--primary-foreground))",
					}}
				>
					{saving ? "Saving..." : "Start Chatting"}
				</button>

				<button
					type="button"
					onClick={() => setStep("splash")}
					className="block w-full text-center text-xs cursor-pointer"
					style={{ color: "hsl(var(--muted-foreground))" }}
				>
					← Back
				</button>
			</div>
		</div>
	);
}

/** A single feature highlight row */
function FeatureRow({ icon, text }: { icon: string; text: string }) {
	return (
		<div
			className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
			style={{
				background: "hsl(var(--muted) / 0.4)",
			}}
		>
			<span className="text-lg shrink-0">{icon}</span>
			<span className="text-sm" style={{ color: "hsl(var(--foreground) / 0.85)" }}>
				{text}
			</span>
		</div>
	);
}
