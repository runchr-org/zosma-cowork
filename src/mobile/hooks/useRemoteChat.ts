import type { ChatMessage, ModelInfo, ToolCallInfo } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStateStatus = "idle" | "thinking" | "tool_call" | "responding" | "error";

export interface RemoteChatState {
	messages: ChatMessage[];
	streamingMessage: ChatMessage | null;
	isRunning: boolean;
	status: StreamStateStatus;
	error: string | null;
	sendMessage: (text: string) => void;
	abort: () => void;
	retry: () => void;
	isConnected: boolean;
	models: ModelInfo[];
	currentModelId: string | undefined;
	switchModel: (provider: string, modelId: string) => void;
}

interface UseRemoteChatOptions {
	pin: string;
	token: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(
	role: ChatMessage["role"],
	content: string,
	extra?: Partial<ChatMessage>,
): ChatMessage {
	return {
		id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		role,
		content,
		timestamp: Date.now(),
		...extra,
	};
}

/** Extract text content from an AgentMessage's content array. */
function extractText(message: { content?: Array<{ type?: string; text?: string }> }): string {
	if (!message.content) return "";
	return message.content
		.filter((c) => c.type === "text" || !c.type)
		.map((c) => c.text || "")
		.join("");
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages a chat session via the remote server's HTTP + SSE API.
 *
 * Replaces `usePiStream` for browser-based mobile clients that cannot
 * access Tauri's `invoke()`.
 *
 * Handles the actual AgentEvent format emitted by the sidecar's
 * `session.subscribe()` callback plus top-level BusEvent types (`done`,
 * `error`, `result`).
 */
export function useRemoteChat({ pin }: UseRemoteChatOptions): RemoteChatState {
	const messagesRef = useRef<ChatMessage[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [status, setStatus] = useState<StreamStateStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [currentModelId, setCurrentModelId] = useState<string | undefined>(undefined);
	const eventSourceRef = useRef<EventSource | null>(null);
	const lastPromptRef = useRef<string>("");

	const base = window.location.origin;
	const auth = `?pin=${pin}`;

	// ── SSE event stream ──────────────────────────────────────────────
	useEffect(() => {
		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let mounted = true;

		function connect() {
			if (!mounted) return;
			if (eventSource) eventSource.close();

			eventSource = new EventSource(`${base}/api/events${auth}`);
			eventSourceRef.current = eventSource;

			eventSource.onopen = () => {
				if (mounted) setIsConnected(true);
			};

			eventSource.onmessage = (event) => {
				if (!mounted) return;
				try {
					const data = JSON.parse(event.data);
					handleBusEvent(data);
				} catch {
					// Ignore parse errors
				}
			};

			eventSource.onerror = () => {
				if (!mounted) return;
				setIsConnected(false);
				eventSource?.close();
				reconnectTimer = setTimeout(connect, 5000);
			};
		}

		connect();

		return () => {
			mounted = false;
			if (eventSource) eventSource.close();
			if (reconnectTimer) clearTimeout(reconnectTimer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [base, auth]);

	// ── Bus event handler ─────────────────────────────────────────────
	function handleBusEvent(busEvent: Record<string, unknown>) {
		// Top-level BusEvent from the sidecar send() function.
		// Types: "event" | "done" | "error" | "result"
		switch (busEvent.type) {
			case "connected":
				setIsConnected(true);
				return;

			case "event": {
				// Wraps an AgentEvent: busEvent.data = { type: "event", event: AgentEvent }
				const wrapper = busEvent.data as Record<string, unknown> | undefined;
				const agentEvent = wrapper?.event as Record<string, unknown> | undefined;
				if (!agentEvent?.type) return;
				handleAgentEvent(agentEvent);
				return;
			}

			case "done":
				setIsRunning(false);
				setStatus("idle");
				setStreamingMessage(null);
				return;

			case "error":
				setIsRunning(false);
				setStatus("error");
				setError((busEvent.message as string) || "An error occurred");
				return;

			case "result": {
				// Results from sidecar commands (get_models, etc.)
				const data = busEvent.data as Record<string, unknown> | undefined;
				if (data?.models && Array.isArray(data.models)) {
					const modelList = data.models as ModelInfo[];
					setModels(modelList);
				}
				if (data?.success && busEvent.id === "set-model") {
					// Model switch confirmed — currentModelId already set optimistically
				}
				return;
			}
		}
	}

	// ── Agent event handler ───────────────────────────────────────────
	function handleAgentEvent(agentEvent: Record<string, unknown>) {
		switch (agentEvent.type) {
			// ── Lifecycle ───────────────────────────────────────────
			case "agent_start":
				setIsRunning(true);
				return;

			case "agent_end":
				// Agent finished producing all messages for this prompt.
				return;

			case "turn_start":
				return;

			case "turn_end": {
				// Turn ended — tools may have results.
				// The assistant message should already be finalized.
				// Flush any lingering streaming state.
				setStreamingMessage((prev) => {
					if (prev) {
						const finalized: ChatMessage = { ...prev, isStreaming: false };
						messagesRef.current = [...messagesRef.current, finalized];
						setMessages(messagesRef.current);
					}
					return null;
				});
				return;
			}

			// ── Messages ───────────────────────────────────────────
			case "message_start": {
				const msg = agentEvent.message as Record<string, unknown> | undefined;
				if (!msg) return;

				const role = msg.role as string;
				const text = extractText(msg as { content?: Array<{ type?: string; text?: string }> });

				if (role === "user") {
					// Add user message to the list
					const userMsg = makeMessage("user", text);
					messagesRef.current = [...messagesRef.current, userMsg];
					setMessages(messagesRef.current);
				} else if (role === "assistant") {
					// Start assistant streaming
					setIsRunning(true);
					setStatus("thinking");
					setError(null);
				}
				return;
			}

			case "message_update": {
				// Contains assistantMessageEvent with streaming details
				const streamEvent = agentEvent.assistantMessageEvent as Record<string, unknown> | undefined;
				if (!streamEvent?.type) return;

				setIsRunning(true);

				switch (streamEvent.type) {
					case "text_delta": {
						setStatus("responding");
						const delta = (streamEvent.delta as string) || "";
						setStreamingMessage((prev) => {
							if (prev) {
								return { ...prev, content: prev.content + delta, isStreaming: true };
							}
							return makeMessage("assistant", delta, { isStreaming: true });
						});
						return;
					}

					case "thinking_delta": {
						setStatus("thinking");
						const delta = (streamEvent.delta as string) || "";
						setStreamingMessage((prev) => {
							if (prev) {
								return {
									...prev,
									thinking: (prev.thinking || "") + delta,
									isStreaming: true,
								};
							}
							return makeMessage("assistant", "", {
								thinking: delta,
								isStreaming: true,
							});
						});
						return;
					}

					case "thinking_start": {
						setStatus("thinking");
						return;
					}

					case "thinking_end": {
						// Thinking block finished — transition to responding
						setStatus("responding");
						return;
					}

					case "toolcall_start": {
						setStatus("tool_call");
						const toolName = (streamEvent.toolName as string) || "unknown";
						setStreamingMessage((prev) => {
							const existing = prev || makeMessage("assistant", "", { isStreaming: true });
							const toolCall: ToolCallInfo = {
								id: `tool-${Date.now()}`,
								name: toolName,
								args: {},
								status: "running",
							};
							return {
								...existing,
								toolCalls: [...(existing.toolCalls || []), toolCall],
							};
						});
						return;
					}

					case "toolcall_delta": {
						// Accumulate tool call arguments
						const delta = (streamEvent.delta as string) || "";
						setStreamingMessage((prev) => {
							if (!prev) return null;
							const toolCalls = [...(prev.toolCalls || [])];
							const lastTool = toolCalls[toolCalls.length - 1];
							if (lastTool) {
								lastTool.args = {
									...(lastTool.args as Record<string, unknown>),
									_partial:
										(((lastTool.args as Record<string, unknown>)?._partial as string) || "") +
										delta,
								};
							}
							return { ...prev, toolCalls };
						});
						return;
					}

					case "toolcall_end": {
						setStreamingMessage((prev) => {
							if (!prev) return null;
							const toolCalls = (prev.toolCalls || []).map((tc) => ({
								...tc,
								status: "completed" as const,
							}));
							return { ...prev, toolCalls };
						});
						return;
					}

					case "text_start":
					case "text_end":
						// No-op — text_delta handles content
						return;
				}
				return;
			}

			case "message_end": {
				// Finalize the streaming message into the messages array.
				// The message object has the complete content.
				setStreamingMessage((prev) => {
					if (prev) {
						const finalized: ChatMessage = { ...prev, isStreaming: false };
						messagesRef.current = [...messagesRef.current, finalized];
						setMessages(messagesRef.current);
					}
					return null;
				});
				return;
			}

			// ── Tool execution ─────────────────────────────────────
			case "tool_execution_start": {
				setStatus("tool_call");
				const toolCallId = (agentEvent.toolCallId as string) || `tool-${Date.now()}`;
				const toolName = (agentEvent.toolName as string) || "unknown";
				const args = (agentEvent.args as Record<string, unknown>) || {};
				setStreamingMessage((prev) => {
					const existing = prev || makeMessage("assistant", "", { isStreaming: true });
					const toolCall: ToolCallInfo = {
						id: toolCallId,
						name: toolName,
						args,
						status: "running",
					};
					return {
						...existing,
						toolCalls: [...(existing.toolCalls || []), toolCall],
					};
				});
				return;
			}

			case "tool_execution_end": {
				const toolCallId = agentEvent.toolCallId as string;
				const result = String(agentEvent.result ?? "");
				setStreamingMessage((prev) => {
					if (!prev) return null;
					const toolCalls = (prev.toolCalls || []).map((tc) =>
						tc.id === toolCallId ? { ...tc, status: "completed" as const, result } : tc,
					);
					return { ...prev, toolCalls };
				});
				return;
			}
		}
	}

	// ── Send message ─────────────────────────────────────────────────
	const sendMessage = useCallback(
		async (text: string) => {
			if (!text.trim() || isRunning) return;

			lastPromptRef.current = text;
			setError(null);

			try {
				const res = await fetch(`${base}/api/command${auth}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ type: "prompt", text }),
				});

				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					setError((data.message as string) || `Server error (${res.status})`);
					setStatus("error");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send message");
				setStatus("error");
			}
		},
		[base, auth, isRunning],
	);

	// ── Abort ────────────────────────────────────────────────────────
	const abort = useCallback(() => {
		fetch(`${base}/api/command${auth}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "abort" }),
		}).catch(() => {});
		setIsRunning(false);
		setStatus("idle");
		setStreamingMessage(null);
	}, [base, auth]);

	// ── Retry ─────────────────────────────────────────────────────────
	const retry = useCallback(() => {
		if (lastPromptRef.current) {
			sendMessage(lastPromptRef.current);
		}
	}, [sendMessage]);

	// ── Switch model ─────────────────────────────────────────────────
	const switchModel = useCallback(
		async (provider: string, modelId: string) => {
			setCurrentModelId(modelId);
			try {
				const res = await fetch(`${base}/api/command${auth}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "set_model",
						provider,
						model: modelId,
						id: "set-model",
					}),
				});
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					setError((data.message as string) || "Failed to switch model");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to switch model");
			}
		},
		[base, auth],
	);

	return {
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
	};
}
