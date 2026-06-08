/**
 * steering — mid-turn message-queue command handlers.
 *
 * Wraps pi-mono's `AgentSession.steer()` / `AgentSession.followUp()` so the
 * desktop UI can:
 *  - **steer** the agent mid-turn ("stop and do this instead"), delivered
 *    after the current assistant turn finishes its tool calls but before
 *    the next LLM call, and
 *  - **follow_up** ("after you're done, also do X"), delivered only when
 *    the agent has no more tool calls or steering messages pending.
 *
 * The protocol mirrors pi's RPC contract (`pi --mode rpc`) — see
 * `docs/rpc.md` in pi-coding-agent for the original spec. Cowork's wire
 * format is internal and reuses the existing `result` / `error` envelopes
 * (so the new commands route through `pending_requests` on the Rust side
 * with no new transport layer).
 *
 * Architectural rules these handlers enforce:
 *  1. Steering / follow-up commands DO NOT go through the prompt-scheduler.
 *     They queue *into* the running session via the SDK, not behind it.
 *  2. They emit at most one envelope per command id. Post-acceptance
 *     failures (e.g. the agent rejects the queued message after delivery)
 *     surface through the normal agent event stream — never as a second
 *     `result` / `error` for the same id.
 *  3. Validation failures (missing text) and synchronous SDK rejections
 *     (e.g. extension commands) are both surfaced as `error` envelopes
 *     before acceptance, per pi's "success: false = rejected" contract.
 */

/** Image attachment shape, matching pi-coding-agent's `ImageContent`. */
export interface ImageAttachment {
	type: "image";
	data: string;
	mimeType: string;
}

/**
 * The minimal slice of `AgentSession` these handlers depend on. Keeping it
 * narrow makes the handlers trivially mockable and decouples them from the
 * full SDK surface (which churns across pi releases).
 */
export interface SteerableSession {
	steer(text: string, images?: ImageAttachment[]): Promise<void>;
	followUp(text: string, images?: ImageAttachment[]): Promise<void>;
}

/** Inbound steer command from the desktop UI (via Tauri stdin). */
export interface SteerCommand {
	type: "steer";
	id: string;
	text: string;
	images?: ImageAttachment[];
}

/** Inbound follow-up command from the desktop UI (via Tauri stdin). */
export interface FollowUpCommand {
	type: "follow_up";
	id: string;
	text: string;
	images?: ImageAttachment[];
}

/**
 * Outgoing envelopes this module emits to stdout. Intentionally a subset
 * of the sidecar's full envelope vocabulary — these handlers only ever
 * emit `result` (acceptance) or `error` (rejection).
 */
export type SidecarOutgoing =
	| {
			type: "result";
			id: string;
			data: { accepted: true; command: "steer" | "follow_up" };
	  }
	| { type: "error"; id: string; message: string };

type Send = (msg: SidecarOutgoing) => void;

/** Reject obviously-bad shapes before we touch the SDK. */
function validateText(text: unknown): string | null {
	if (typeof text !== "string" || text.trim().length === 0) {
		return "Missing 'text' field";
	}
	return null;
}

function errMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

/**
 * Queue a steering message on the running session.
 *
 * Emits exactly one envelope:
 *  - `{type:"result", id, data:{accepted:true, command:"steer"}}` on success
 *  - `{type:"error", id, message}` on rejected-before-acceptance
 */
export async function handleSteerCommand(
	session: SteerableSession,
	cmd: SteerCommand,
	send: Send,
): Promise<void> {
	const badShape = validateText(cmd.text);
	if (badShape) {
		send({ type: "error", id: cmd.id, message: badShape });
		return;
	}

	try {
		await session.steer(cmd.text, cmd.images);
		send({
			type: "result",
			id: cmd.id,
			data: { accepted: true, command: "steer" },
		});
	} catch (err) {
		send({ type: "error", id: cmd.id, message: errMessage(err) });
	}
}

/**
 * Queue a follow-up message on the running session. Same contract as
 * {@link handleSteerCommand}, just bound to `session.followUp()`.
 */
export async function handleFollowUpCommand(
	session: SteerableSession,
	cmd: FollowUpCommand,
	send: Send,
): Promise<void> {
	const badShape = validateText(cmd.text);
	if (badShape) {
		send({ type: "error", id: cmd.id, message: badShape });
		return;
	}

	try {
		await session.followUp(cmd.text, cmd.images);
		send({
			type: "result",
			id: cmd.id,
			data: { accepted: true, command: "follow_up" },
		});
	} catch (err) {
		send({ type: "error", id: cmd.id, message: errMessage(err) });
	}
}
