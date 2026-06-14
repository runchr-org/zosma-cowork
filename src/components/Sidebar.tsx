import { ListChecks, MessageSquare, Settings } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ConversationSearch, type DeepSearchMatch } from "./ConversationSearch";

interface Session {
	id: string;
	title: string;
	lastMessage: string;
	timestamp: number;
	active?: boolean;
	/** Workspace folder this session ran in (drives folder grouping). */
	folder?: string;
	/** Pinned sessions float to the top of the list. */
	pinned?: boolean;
	/** Whether the title was manually set. */
	titleLocked?: boolean;
}

interface SidebarProps {
	view: string;
	sessions: Session[];
	activeSessionId?: string;
	onSessionSelect: (id: string) => void;
	onNewSession: () => void;
	onDeleteSession: (id: string) => void;
	/** Open the rename popup for a session. */
	onRequestRename?: (id: string) => void;
	/** Pin/unpin a session. */
	onPinSession?: (id: string, pinned: boolean) => void;
	/** Deep content search across message bodies. */
	onDeepSearch?: (query: string) => Promise<DeepSearchMatch[]>;
	onChangeView: (view: string) => void;
	/** The user's home dir, used to collapse session paths to `~`. */
	homeDir?: string;
}

const TABS = [
	{ id: "chats", label: "Cowork", Icon: MessageSquare },
	{ id: "tasks", label: "Tasks", Icon: ListChecks },
] as const;

// ease-out-expo
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function Sidebar({
	view,
	sessions,
	activeSessionId,
	onSessionSelect,
	onNewSession,
	onDeleteSession,
	onRequestRename,
	onPinSession,
	onDeepSearch,
	onChangeView,
	homeDir,
}: SidebarProps) {
	const reduced = useReducedMotion();
	const activeTab: "chats" | "tasks" = view === "tasks" ? "tasks" : "chats";

	return (
		<motion.div
			className="w-72 flex flex-col h-full bg-transparent"
			initial={reduced ? false : { x: -12, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			transition={{ duration: 0.32, ease: easeOutExpo }}
		>
			{/* ── Tab switcher ── */}
			<div className="px-3 pt-3 pb-0 shrink-0">
				<div
					className="relative flex items-center gap-px rounded-xl p-1"
					style={{ background: "hsl(var(--muted) / 0.5)" }}
				>
					{/* Sliding pill — always mounted, position driven by animate */}
					<motion.div
						className="absolute top-1 bottom-1 rounded-lg"
						animate={{
							left: activeTab === "chats" ? 4 : "50%",
							width: "calc(50% - 4px)",
						}}
						initial={false}
						transition={{ duration: reduced ? 0 : 0.22, ease: easeOutExpo }}
						style={{
							background: "hsl(var(--sidebar-background))",
							boxShadow: "0 1px 4px hsl(0 0% 0% / 0.12)",
						}}
					/>

					{TABS.map(({ id, label, Icon }) => (
						<button
							key={id}
							type="button"
							onClick={() => onChangeView(id)}
							className="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
							style={{
								color:
									activeTab === id
										? "hsl(var(--sidebar-foreground))"
										: "hsl(var(--sidebar-foreground) / 0.45)",
							}}
						>
							<Icon className="w-3.5 h-3.5 shrink-0" />
							{label}
						</button>
					))}
				</div>
			</div>

			{/* ── Content area ── */}
			<div className="flex-1 min-h-0 relative overflow-hidden">
				<AnimatePresence mode="wait" initial={false}>
					{activeTab === "tasks" ? (
						<motion.div
							key="tasks"
							className="absolute inset-0"
							initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
							animate={{ opacity: 1, x: 0 }}
							exit={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
							transition={{ duration: 0.2, ease: easeOutExpo }}
						>
							<TasksPanel />
						</motion.div>
					) : (
						<motion.div
							key="chats"
							className="absolute inset-0"
							initial={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
							animate={{ opacity: 1, x: 0 }}
							exit={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }}
							transition={{ duration: 0.2, ease: easeOutExpo }}
						>
							<ConversationSearch
								sessions={sessions}
								activeSessionId={activeSessionId}
								onSelect={onSessionSelect}
								onNewSession={onNewSession}
								onDeleteSession={onDeleteSession}
								onRequestRename={onRequestRename}
								onPinSession={onPinSession}
								onDeepSearch={onDeepSearch}
								homeDir={homeDir}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* ── Settings footer ── */}
			<div
				className="shrink-0 px-3 py-2"
				style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}
			>
				<motion.button
					type="button"
					onClick={() => onChangeView("settings")}
					className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
					style={{ color: "hsl(var(--sidebar-foreground) / 0.45)" }}
					whileHover={
						reduced
							? {}
							: {
									color: "hsl(var(--sidebar-foreground))",
									background: "hsl(var(--sidebar-accent) / 0.5)",
								}
					}
					whileTap={reduced ? {} : { scale: 0.97 }}
					transition={{ duration: 0.15, ease: easeOutExpo }}
				>
					<Settings className="w-3.5 h-3.5 shrink-0" />
					Settings
				</motion.button>
			</div>
		</motion.div>
	);
}

/**
 * TasksPanel — placeholder for the Tasks tab.
 *
 * The real scheduled-tasks list (backed by pi-routines via the sidecar
 * bridge) lands in #289. For the P1 IA scaffold (#287) this just shows an
 * empty state so the tab is selectable and renders cleanly.
 */
function TasksPanel() {
	return (
		<div className="flex h-full flex-col items-center justify-center px-6 text-center">
			<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<ListChecks className="h-5 w-5" />
			</div>
			<p className="text-sm font-medium text-sidebar-foreground">No tasks yet</p>
			<p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/50">
				Ask in a Cowork chat to schedule a task — for example, “every weekday at 9am summarize
				my unread email.” Scheduled tasks will show up here.
			</p>
		</div>
	);
}
