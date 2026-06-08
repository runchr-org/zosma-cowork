import { describe, expect, it, vi } from "vitest";
import {
	handleFollowUpCommand,
	handleSteerCommand,
	type FollowUpCommand,
	type ImageAttachment,
	type SidecarOutgoing,
	type SteerableSession,
	type SteerCommand,
} from "./steering.js";

/**
 * Steering / follow-up command handlers wrap pi-mono's
 * `AgentSession.steer()` / `AgentSession.followUp()` for mid-turn message
 * queueing.
 *
 * Pi's RPC contract (docs/rpc.md):
 *   - `success: true` means the message was accepted / queued / handled
 *     immediately.
 *   - `success: false` means the message was rejected before acceptance
 *     (e.g. extension command, bad shape).
 *   - Failures AFTER acceptance go through the normal event stream, not as
 *     a second response.
 *
 * Cowork's existing sidecar protocol uses `{type:"result"|"error"}`
 * envelopes routed by Tauri's `pending_requests` map (see
 * src-tauri/src/lib.rs scmd_r / read_stdout). To keep the new commands
 * routable without a new Rust path, the handlers below emit `result` /
 * `error` envelopes, NOT pi's `response` envelope.
 *
 * These handlers must NOT touch the prompt-scheduler. The whole point of
 * steer/follow_up is to queue *into* the running session via the SDK —
 * not behind it via the serializing chain.
 */
describe("steering command handlers", () => {
	function makeSession(
		overrides: Partial<SteerableSession> = {},
	): SteerableSession {
		return {
			steer: vi.fn().mockResolvedValue(undefined),
			followUp: vi.fn().mockResolvedValue(undefined),
			...overrides,
		};
	}

	function capture() {
		const sent: SidecarOutgoing[] = [];
		return { sent, send: (msg: SidecarOutgoing) => sent.push(msg) };
	}

	// ───────────────────────────────── steer ─────────────────────────────────

	describe("handleSteerCommand", () => {
		it("calls session.steer(text) exactly once with the command text", async () => {
			const session = makeSession();
			const { send } = capture();
			const cmd: SteerCommand = {
				type: "steer",
				id: "s-1",
				text: "stop and look at the test output",
			};

			await handleSteerCommand(session, cmd, send);

			expect(session.steer).toHaveBeenCalledTimes(1);
			expect(session.steer).toHaveBeenCalledWith(
				"stop and look at the test output",
				undefined,
			);
		});

		it("emits a result envelope with accepted:true on success", async () => {
			const session = makeSession();
			const { sent, send } = capture();
			const cmd: SteerCommand = { type: "steer", id: "s-2", text: "hi" };

			await handleSteerCommand(session, cmd, send);

			expect(sent).toEqual([
				{
					type: "result",
					id: "s-2",
					data: { accepted: true, command: "steer" },
				},
			]);
		});

		it("passes through optional images to session.steer", async () => {
			const session = makeSession();
			const { send } = capture();
			const images: ImageAttachment[] = [
				{ type: "image", data: "AAA=", mimeType: "image/png" },
			];
			const cmd: SteerCommand = {
				type: "steer",
				id: "s-3",
				text: "see this",
				images,
			};

			await handleSteerCommand(session, cmd, send);

			expect(session.steer).toHaveBeenCalledWith("see this", images);
		});

		it("emits an error envelope when session.steer rejects (rejected before acceptance)", async () => {
			// The SDK throws synchronously-ish when steering an extension
			// command. Pi's contract treats this as rejected-before-acceptance,
			// which on cowork's wire is an `error` envelope.
			const session = makeSession({
				steer: vi
					.fn()
					.mockRejectedValue(new Error("Extension commands cannot be steered")),
			});
			const { sent, send } = capture();
			const cmd: SteerCommand = { type: "steer", id: "s-4", text: "/foo" };

			await handleSteerCommand(session, cmd, send);

			expect(sent).toEqual([
				{
					type: "error",
					id: "s-4",
					message: "Extension commands cannot be steered",
				},
			]);
		});

		it("rejects a missing-text command WITHOUT calling session.steer", async () => {
			const session = makeSession();
			const { sent, send } = capture();
			// Bad shape from a misbehaving caller.
			const bad = { type: "steer", id: "s-5" } as unknown as SteerCommand;

			await handleSteerCommand(session, bad, send);

			expect(session.steer).not.toHaveBeenCalled();
			expect(sent).toEqual([
				{ type: "error", id: "s-5", message: "Missing 'text' field" },
			]);
		});

		it("rejects an empty-text command WITHOUT calling session.steer", async () => {
			const session = makeSession();
			const { sent, send } = capture();
			const cmd: SteerCommand = {
				type: "steer",
				id: "s-6",
				text: "   \n  ",
			};

			await handleSteerCommand(session, cmd, send);

			expect(session.steer).not.toHaveBeenCalled();
			expect(sent).toEqual([
				{ type: "error", id: "s-6", message: "Missing 'text' field" },
			]);
		});

		it("falls back to a generic error message when session.steer throws a non-Error", async () => {
			const session = makeSession({
				steer: vi.fn().mockRejectedValue("kaboom"),
			});
			const { sent, send } = capture();
			const cmd: SteerCommand = { type: "steer", id: "s-7", text: "hi" };

			await handleSteerCommand(session, cmd, send);

			expect(sent).toEqual([
				{ type: "error", id: "s-7", message: "kaboom" },
			]);
		});
	});

	// ─────────────────────────────── follow_up ────────────────────────────────

	describe("handleFollowUpCommand", () => {
		it("calls session.followUp(text) exactly once with the command text", async () => {
			const session = makeSession();
			const { send } = capture();
			const cmd: FollowUpCommand = {
				type: "follow_up",
				id: "f-1",
				text: "after you finish, also run the linter",
			};

			await handleFollowUpCommand(session, cmd, send);

			expect(session.followUp).toHaveBeenCalledTimes(1);
			expect(session.followUp).toHaveBeenCalledWith(
				"after you finish, also run the linter",
				undefined,
			);
		});

		it("emits a result envelope with accepted:true on success", async () => {
			const session = makeSession();
			const { sent, send } = capture();
			const cmd: FollowUpCommand = {
				type: "follow_up",
				id: "f-2",
				text: "later",
			};

			await handleFollowUpCommand(session, cmd, send);

			expect(sent).toEqual([
				{
					type: "result",
					id: "f-2",
					data: { accepted: true, command: "follow_up" },
				},
			]);
		});

		it("passes through optional images to session.followUp", async () => {
			const session = makeSession();
			const { send } = capture();
			const images: ImageAttachment[] = [
				{ type: "image", data: "BBB=", mimeType: "image/jpeg" },
			];
			const cmd: FollowUpCommand = {
				type: "follow_up",
				id: "f-3",
				text: "and look at this",
				images,
			};

			await handleFollowUpCommand(session, cmd, send);

			expect(session.followUp).toHaveBeenCalledWith("and look at this", images);
		});

		it("emits an error envelope when session.followUp rejects", async () => {
			const session = makeSession({
				followUp: vi
					.fn()
					.mockRejectedValue(
						new Error("Extension commands cannot be follow-ups"),
					),
			});
			const { sent, send } = capture();
			const cmd: FollowUpCommand = {
				type: "follow_up",
				id: "f-4",
				text: "/foo",
			};

			await handleFollowUpCommand(session, cmd, send);

			expect(sent).toEqual([
				{
					type: "error",
					id: "f-4",
					message: "Extension commands cannot be follow-ups",
				},
			]);
		});

		it("rejects an empty-text command WITHOUT calling session.followUp", async () => {
			const session = makeSession();
			const { sent, send } = capture();
			const cmd: FollowUpCommand = { type: "follow_up", id: "f-5", text: "" };

			await handleFollowUpCommand(session, cmd, send);

			expect(session.followUp).not.toHaveBeenCalled();
			expect(sent).toEqual([
				{ type: "error", id: "f-5", message: "Missing 'text' field" },
			]);
		});
	});

	// ───────────────────────────── isolation ──────────────────────────────────

	it("handlers are independent — calling steer must not trigger followUp", async () => {
		const session = makeSession();
		const { send } = capture();
		const cmd: SteerCommand = { type: "steer", id: "iso-1", text: "x" };

		await handleSteerCommand(session, cmd, send);

		expect(session.steer).toHaveBeenCalledTimes(1);
		expect(session.followUp).not.toHaveBeenCalled();
	});

	it("handlers are independent — calling followUp must not trigger steer", async () => {
		const session = makeSession();
		const { send } = capture();
		const cmd: FollowUpCommand = { type: "follow_up", id: "iso-2", text: "y" };

		await handleFollowUpCommand(session, cmd, send);

		expect(session.followUp).toHaveBeenCalledTimes(1);
		expect(session.steer).not.toHaveBeenCalled();
	});
});
