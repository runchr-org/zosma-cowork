import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

import { Check, Clock, Info, Key, MessageSquare, Package, Palette, Plus, Settings, Trash2 } from "lucide-react";
import { ExtensionPanel } from "./ExtensionPanel";
import { THEMES, applyTheme, getSavedTheme } from "@/lib/themes";
import type { Theme } from "@/lib/themes";

interface Session {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: number;
	active?: boolean;
}

interface SidebarProps {
	view: string;
	sessions: Session[];
	activeSessionId?: string;
	onSessionSelect: (id: string) => void;
	onNewSession: () => void;
	onDeleteSession: (id: string) => void;
	onChangeView: (view: string) => void;
	onShowKeyEntry?: () => void;
}

export function Sidebar({
	view,
	sessions,
	activeSessionId,
	onSessionSelect,
	onNewSession,
	onDeleteSession,
	onChangeView,
	onShowKeyEntry,
}: SidebarProps) {
	const isSettings = view === "settings";
	const isExtensions = view === "extensions";

	return (
		<div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
			{/* Content area */}
			{isSettings ? (
				<SettingsPanel onShowKeyEntry={onShowKeyEntry} />
			) : isExtensions ? (
				<ExtensionPanel onReload={() => {}} />
			) : (
				<SessionsPanel
					sessions={sessions}
					activeSessionId={activeSessionId}
					onSessionSelect={onSessionSelect}
					onNewSession={onNewSession}
					onDeleteSession={onDeleteSession}
				/>
			)}

			{/* Bottom tab bar */}
			<div className="shrink-0 border-t border-sidebar-border flex items-center justify-around px-2 py-1.5">
				<TabButton
					icon={MessageSquare}
					label="Chats"
					active={view === "chats"}
					onClick={() => onChangeView("chats")}
				/>
				<TabButton
					icon={Package}
					label="Exts"
					active={isExtensions}
					onClick={() => onChangeView("extensions")}
				/>
				<TabButton
					icon={Settings}
					label="Settings"
					active={isSettings}
					onClick={() => onChangeView("settings")}
				/>
			</div>
		</div>
	);
}

// ─── Sessions Panel ─────────────────────────────────────────────────

function SessionsPanel({
	sessions,
	activeSessionId,
	onSessionSelect,
	onNewSession,
	onDeleteSession,
}: {
	sessions: Session[];
	activeSessionId?: string;
	onSessionSelect: (id: string) => void;
	onNewSession: () => void;
	onDeleteSession: (id: string) => void;
}) {
	return (
		<>
			<div className="flex items-center justify-between px-3 py-2">
				<span className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
					Sessions
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onNewSession}
					aria-label="New session"
					className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>
			<ScrollArea className="flex-1 px-2">
				<div className="space-y-0.5 py-1">
					{sessions.length === 0 ? (
						<div className="px-2 py-4 text-center">
							<div className="w-10 h-10 rounded-full bg-sidebar-accent mx-auto mb-2 flex items-center justify-center">
								<MessageSquare className="w-5 h-5 text-sidebar-foreground/50" />
							</div>
							<p className="text-xs text-sidebar-foreground/50">No sessions yet</p>
							<Button variant="ghost" size="sm" onClick={onNewSession} className="mt-2 text-xs">
								Start a session
							</Button>
						</div>
					) : (
						sessions.map((session) => (
							<button
								key={session.id}
								type="button"
								onClick={() => onSessionSelect(session.id)}
								className={cn(
									"w-full text-left px-2.5 py-2 rounded-md group transition-colors relative",
									activeSessionId === session.id
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "hover:bg-sidebar-accent/50 text-sidebar-foreground/80",
								)}
							>
								<div className="flex items-start gap-2">
									<MessageSquare className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="text-sm font-medium truncate">{session.title}</span>
											{activeSessionId === session.id && (
												<Badge
													variant="outline"
													className="text-[10px] px-1 py-0 h-4 shrink-0 border-primary/30 text-primary"
												>
													Active
												</Badge>
											)}
										</div>
										<p className="text-xs text-sidebar-foreground/50 truncate mt-0.5">
											{session.lastMessage}
										</p>
										<div className="flex items-center gap-1 mt-1">
											<Clock className="w-3 h-3 text-sidebar-foreground/30" />
											<span className="text-[10px] text-sidebar-foreground/40">
												{formatTime(session.timestamp)}
											</span>
										</div>
									</div>
								</div>
								<button
									type="button"
									aria-label={`Delete session ${session.title}`}
									onClick={(e) => {
										e.stopPropagation();
										onDeleteSession(session.id);
									}}
									className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sidebar-accent/80 transition-opacity"
								>
									<Trash2 className="w-3 h-3 text-sidebar-foreground/50 hover:text-destructive" />
								</button>
							</button>
						))
					)}
				</div>
			</ScrollArea>
		</>
	);
}

// ─── Settings Panel ─────────────────────────────────────────────────

function SettingsPanel({ onShowKeyEntry }: { onShowKeyEntry?: () => void }) {
	const [appVersion, setAppVersion] = useState<string | null>(null);
	const [currentTheme, setCurrentTheme] = useState(getSavedTheme);

	useEffect(() => {
		import("@tauri-apps/api/app")
			.then(({ getVersion }) => getVersion().then(setAppVersion))
			.catch(() => {});
	}, []);

	function handleThemeChange(theme: Theme) {
		applyTheme(theme);
		setCurrentTheme(theme);
	}

	return (
		<>
			<div className="flex items-center px-3 py-2">
				<span className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
					Settings
				</span>
			</div>
			<ScrollArea className="flex-1 px-3 py-2">
				<div className="space-y-5">
					{/* ── Authentication ── */}
					<div>
						<div className="flex items-center gap-1.5 mb-2">
							<Key className="w-3.5 h-3.5 text-sidebar-foreground/50" />
							<span className="text-xs font-medium text-sidebar-foreground/70">
								Authentication
							</span>
						</div>
						<div className="rounded-lg border p-2.5" style={{
							borderColor: "hsl(var(--sidebar-border))",
							background: "hsl(var(--sidebar-background) / 0.5)",
						}}>
							<p className="text-[10px] text-sidebar-foreground/50 mb-2">
								API keys are required to connect to LLM providers.
							</p>
							<button
								type="button"
								onClick={onShowKeyEntry}
								className="w-full text-xs px-3 py-1.5 rounded-lg transition-colors text-center"
								style={{
									background: "hsl(var(--sidebar-accent))",
									color: "hsl(var(--sidebar-accent-foreground))",
								}}
							>
								Change API Key
							</button>
						</div>
					</div>

					{/* ── Themes ── */}
					<div>
						<div className="flex items-center gap-1.5 mb-2">
							<Palette className="w-3.5 h-3.5 text-sidebar-foreground/50" />
							<span className="text-xs font-medium text-sidebar-foreground/70">
								Theme
							</span>
						</div>
						<div className="space-y-1.5">
							{THEMES.map((theme) => {
								const isActive = currentTheme.id === theme.id;
								// Extract accent color sample
								const accentSample = theme.vars.primary || "255 70% 65%";
								const bgSample = theme.vars.background || "215 20% 8%";
								return (
									<button
										key={theme.id}
										type="button"
										onClick={() => handleThemeChange(theme)}
										className="w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center gap-2.5"
										style={{
											background: isActive ? "hsl(var(--sidebar-accent))" : "transparent",
										}}
									>
										{/* Theme preview swatch */}
										<div
											className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border"
											style={{
												background: `hsl(${bgSample})`,
												borderColor: `hsl(${theme.vars.border || "215 15% 20%"})`,
											}}
										>
											<div
												className="w-3 h-3 rounded-full"
												style={{ background: `hsl(${accentSample})` }}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<span
													className="text-xs font-medium truncate"
													style={{ color: "hsl(var(--sidebar-foreground))" }}
												>
													{theme.name}
												</span>
												<span className="text-[10px] uppercase text-sidebar-foreground/30">
													{theme.type}
												</span>
												{isActive && (
													<Check className="w-3 h-3 ml-auto shrink-0" style={{ color: "hsl(var(--primary))" }} />
												)}
											</div>
											<p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
												{theme.description}
											</p>
										</div>
									</button>
								);
							})}
						</div>
					</div>

					{/* ── About ── */}
					<div>
						<div className="flex items-center gap-1.5 mb-2">
							<Info className="w-3.5 h-3.5 text-sidebar-foreground/50" />
							<span className="text-xs font-medium text-sidebar-foreground/70">
								About
							</span>
						</div>
						<div className="rounded-lg border p-2.5" style={{
							borderColor: "hsl(var(--sidebar-border))",
							background: "hsl(var(--sidebar-background) / 0.5)",
						}}>
						<div className="flex items-center gap-2 mb-1">
							<div
								className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
								style={{
									background: "hsl(var(--primary) / 0.15)",
									color: "hsl(var(--primary))",
								}}
							>
								Z
							</div>
							<div>
								<div className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground))" }}>
									Zosma Cowork
								</div>
								<div className="text-[10px] text-sidebar-foreground/50">
									{appVersion ? `v${appVersion}` : "..."} · Built with pi-mono
								</div>
							</div>
						</div>
						<p className="text-[10px] text-sidebar-foreground/40 mt-1">
							AI-powered coding assistant by Zosma AI
						</p>
						</div>
					</div>
				</div>
			</ScrollArea>
		</>
	);
}

// ─── Tab Button ─────────────────────────────────────────────────────

function TabButton({
	icon: Icon,
	label,
	active,
	onClick,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors",
				active
					? "text-sidebar-accent-foreground bg-sidebar-accent"
					: "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30",
			)}
		>
			<Icon className="w-4 h-4" />
			<span className="text-[10px]">{label}</span>
		</button>
	);
}

function formatTime(ts: number): string {
	const now = Date.now();
	const diff = now - ts;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return new Date(ts).toLocaleDateString();
}
