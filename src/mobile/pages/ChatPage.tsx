import { ChatView } from "@/chat/ChatView";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { useCallback } from "react";
import { useRemoteChat } from "../hooks/useRemoteChat";

interface ChatPageProps {
	pin: string;
	token: string;
	onDisconnect: () => void;
}

export function ChatPage({ pin, token, onDisconnect }: ChatPageProps) {
	const {
		messages,
		streamingMessage,
		isRunning,
		status,
		error,
		sendMessage,
		abort,
		retry,
		isConnected,
		models,
		currentModelId,
		switchModel,
	} = useRemoteChat({ pin, token });

	const handleSend = useCallback(
		(text: string) => {
			sendMessage(text);
		},
		[sendMessage],
	);

	const handleBack = useCallback(() => {
		onDisconnect();
	}, [onDisconnect]);

	const handleModelSelect = useCallback(
		(provider: string, modelId: string) => {
			switchModel(provider, modelId);
		},
		[switchModel],
	);

	return (
		<div className="chat-page">
			{/* Status bar */}
			<div className={`chat-status-bar ${isConnected ? "connected" : "disconnected"}`}>
				<div className="chat-status-left">
					<button type="button" className="chat-back-btn" onClick={handleBack} title="Disconnect">
						<ArrowLeft className="chat-back-icon" />
					</button>
					<div className="chat-status-indicator">
						{isConnected ? (
							<Wifi className="chat-status-icon connected" />
						) : (
							<WifiOff className="chat-status-icon disconnected" />
						)}
						<span className="chat-status-label">
							{isConnected ? "Connected" : "Reconnecting..."}
						</span>
					</div>
				</div>
			</div>

			{/* Chat view */}
			<div className="chat-page-content">
				<ChatView
					messages={messages}
					streamingMessage={streamingMessage}
					isRunning={isRunning}
					status={status}
					error={error}
					onSend={handleSend}
					onAbort={abort}
					onRetry={retry}
					models={models}
					currentModelId={currentModelId}
					onModelSelect={handleModelSelect}
				/>
			</div>
		</div>
	);
}
