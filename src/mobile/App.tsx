import { useCallback, useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { OtpPage } from "./pages/OtpPage";

type MobileView = "otp" | "chat";

interface MobileAppState {
	view: MobileView;
	pin: string;
	token: string | null;
}

export function MobileApp() {
	const [state, setState] = useState<MobileAppState>(() => {
		// Read PIN from URL query params on mount
		const params = new URLSearchParams(window.location.search);
		const pin = params.get("pin") || "";
		return {
			view: pin ? "otp" : "otp",
			pin,
			token: null,
		};
	});

	const handleOtpSuccess = useCallback((pin: string, token: string) => {
		setState({ view: "chat", pin, token });
		// Remove PIN from URL without reloading
		const url = new URL(window.location.href);
		url.searchParams.delete("pin");
		window.history.replaceState({}, "", url.pathname);
	}, []);

	const handleDisconnect = useCallback(() => {
		setState({ view: "otp", pin: "", token: null });
	}, []);

	return (
		<div className="mobile-app">
			{state.view === "otp" && <OtpPage initialPin={state.pin} onSuccess={handleOtpSuccess} />}
			{state.view === "chat" && state.token && (
				<ChatPage pin={state.pin} token={state.token} onDisconnect={handleDisconnect} />
			)}
		</div>
	);
}
