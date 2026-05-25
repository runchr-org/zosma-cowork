import { Menu, Settings, X } from "lucide-react";

interface MobileTopBarProps {
	title: string;
	subtitle?: string;
	open: boolean;
	onToggle: () => void;
	onSettings: () => void;
}

export function MobileTopBar({ title, subtitle, open, onToggle, onSettings }: MobileTopBarProps) {
	return (
		<header className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
			<button
				type="button"
				onClick={onToggle}
				className="p-2 rounded-lg text-foreground hover:bg-muted/50 transition-colors -ml-1"
				aria-label={open ? "Close menu" : "Open menu"}
				style={{ minWidth: 44, minHeight: 44 }}
			>
				{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
			</button>

			<div className="flex-1 text-center min-w-0 px-2">
				<h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
				{subtitle && (
					<p className="text-[10px] text-muted-foreground/50 truncate -mt-0.5">{subtitle}</p>
				)}
			</div>

			<button
				type="button"
				onClick={onSettings}
				className="p-2 rounded-lg text-foreground hover:bg-muted/50 transition-colors -mr-1"
				aria-label="Open settings"
				style={{ minWidth: 44, minHeight: 44 }}
			>
				<Settings className="w-5 h-5" />
			</button>
		</header>
	);
}
