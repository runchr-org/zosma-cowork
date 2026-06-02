import { QrCode, Smartphone, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface OtpPageProps {
	initialPin: string;
	onSuccess: (pin: string, token: string) => void;
}

type OtpPhase = "scanning" | "validating" | "error" | "expired";

export function OtpPage({ initialPin, onSuccess }: OtpPageProps) {
	const [pin, setPin] = useState(initialPin);
	const [phase, setPhase] = useState<OtpPhase>(initialPin ? "validating" : "scanning");
	const [message, setMessage] = useState("");
	const [attempted, setAttempted] = useState(false);
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pinInputRef = useRef<HTMLInputElement>(null);

	// Auto-focus PIN input on mount (replaces autoFocus for a11y compliance)
	useEffect(() => {
		const timer = setTimeout(() => pinInputRef.current?.focus(), 300);
		return () => clearTimeout(timer);
	}, []);

	// ── Validate PIN ──────────────────────────────────────────────────
	const validatePin = useCallback(
		async (pinToValidate: string) => {
			if (!pinToValidate || pinToValidate.length !== 6) return;
			setPhase("validating");
			setAttempted(true);

			try {
				// Determine base URL (same origin as this page)
				const base = window.location.origin;

				const res = await fetch(`${base}/api/verify-pin`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pin: pinToValidate }),
				});

				const data = await res.json();

				if (res.ok && data.success && data.token) {
					setPhase("scanning");
					onSuccess(pinToValidate, data.token);
				} else if (res.status === 401) {
					setPhase("expired");
					setMessage("PIN expired or invalid. Scan the QR again to get a new one.");
					startPolling();
				} else {
					setPhase("error");
					setMessage(data.message || "Connection failed. Please try again.");
				}
			} catch {
				setPhase("error");
				setMessage("Could not reach desktop. Make sure you're on the same network.");
			}
		},
		[onSuccess],
	);

	// ── Auto-validate PIN from URL ────────────────────────────────────
	useEffect(() => {
		if (initialPin && !attempted) {
			validatePin(initialPin);
		}
	}, [initialPin, validatePin, attempted]);

	// ── Poll server for status when expired ────────────────────────────
	const startPolling = useCallback(() => {
		if (pollTimerRef.current) return;
		pollTimerRef.current = setInterval(async () => {
			try {
				const res = await fetch(`${window.location.origin}/api/status`);
				const data = await res.json();
				if (data.pin) {
					// New PIN available — try it (but don't auto-submit, show to user)
					setPhase("scanning");
					setMessage(`New PIN available from desktop: ${data.pin}`);
					setPin(data.pin);
					if (pollTimerRef.current) {
						clearInterval(pollTimerRef.current);
						pollTimerRef.current = null;
					}
				}
			} catch {
				// Server unreachable
			}
		}, 5000);
	}, []);

	// Cleanup polling
	useEffect(() => {
		return () => {
			if (pollTimerRef.current) {
				clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
			}
		};
	}, []);

	// ── Manual PIN submit ─────────────────────────────────────────────
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (pin.length === 6) {
			validatePin(pin);
		}
	};

	// ── Glowing lines background ──────────────────────────────────────
	return (
		<div className="otp-page">
			{/* Animated background orbs */}
			<div className="otp-bg-orbs">
				<div className="orb orb-1" />
				<div className="orb orb-2" />
				<div className="orb orb-3" />
			</div>

			<div className="otp-content">
				{/* Brand header */}
				<div className="otp-brand">
					<div className="otp-logo">
						<Zap className="otp-logo-icon" />
					</div>
					<h1 className="otp-title">Zosma Cowork</h1>
					<p className="otp-subtitle">Your AI coworker, on the go</p>
				</div>

				{/* Glossy card */}
				<div className="otp-card">
					{/* Scanning phase */}
					{phase === "scanning" && !attempted && (
						<div className="otp-card-inner">
							<div className="otp-icon-circle">
								<QrCode className="otp-icon" />
							</div>
							<h2 className="otp-card-title">Scan to Connect</h2>
							<p className="otp-card-text">
								Open the Remote Access panel on your desktop and scan the QR code to automatically
								connect.
							</p>

							{/* Divider */}
							<div className="otp-divider">
								<span className="otp-divider-line" />
								<span className="otp-divider-text">or enter PIN manually</span>
								<span className="otp-divider-line" />
							</div>

							<form onSubmit={handleSubmit} className="otp-form">
								<div className="otp-input-group">
									<input
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={6}
										placeholder="000000"
										value={pin}
										onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
										className="otp-input"
										ref={pinInputRef}
									/>
								</div>
								<button type="submit" disabled={pin.length !== 6} className="otp-btn">
									Connect
								</button>
							</form>

							<div className="otp-hint">
								<Smartphone className="otp-hint-icon" />
								<span>Same Wi-Fi network required</span>
							</div>
						</div>
					)}

					{/* Scanning phase (after initial auto-attempt failed or no PIN) */}
					{phase === "scanning" && attempted && (
						<div className="otp-card-inner">
							<div className="otp-icon-circle">
								<QrCode className="otp-icon" />
							</div>
							<h2 className="otp-card-title">Connect to Desktop</h2>
							{message && <p className="otp-card-text otp-card-info">{message}</p>}
							<p className="otp-card-text">
								Open Remote Access on your desktop to get a new PIN, or type it below.
							</p>

							<form onSubmit={handleSubmit} className="otp-form">
								<div className="otp-input-group">
									<input
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={6}
										placeholder="000000"
										value={pin}
										onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
										className="otp-input"
									/>
								</div>
								<button type="submit" disabled={pin.length !== 6} className="otp-btn">
									Connect
								</button>
							</form>
						</div>
					)}

					{/* Validating phase */}
					{phase === "validating" && (
						<div className="otp-card-inner">
							<div className="otp-icon-circle validating">
								<div className="otp-spinner" />
							</div>
							<h2 className="otp-card-title">Connecting</h2>
							<p className="otp-card-text">
								Validating your PIN and establishing a secure connection...
							</p>
						</div>
					)}

					{/* Error phase */}
					{phase === "error" && (
						<div className="otp-card-inner">
							<div className="otp-icon-circle error">
								<span className="otp-error-icon">!</span>
							</div>
							<h2 className="otp-card-title">Connection Failed</h2>
							<p className="otp-card-text otp-card-error">{message}</p>
							<button
								type="button"
								onClick={() => {
									setPhase("scanning");
									setMessage("");
								}}
								className="otp-btn otp-btn-secondary"
							>
								Try Again
							</button>
						</div>
					)}

					{/* Expired phase */}
					{phase === "expired" && (
						<div className="otp-card-inner">
							<div className="otp-icon-circle expired">
								<span className="otp-error-icon">!</span>
							</div>
							<h2 className="otp-card-title">PIN Expired</h2>
							<p className="otp-card-text otp-card-error">{message}</p>
							<button
								type="button"
								onClick={() => {
									setPhase("scanning");
									setMessage("");
								}}
								className="otp-btn otp-btn-secondary"
							>
								Enter PIN Manually
							</button>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="otp-footer">
					<p className="otp-footer-text">
						Need help? Enable Remote Access in your desktop app's settings
					</p>
				</div>
			</div>
		</div>
	);
}
