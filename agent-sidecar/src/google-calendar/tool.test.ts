import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the network + auth layers so we assert request shaping, not HTTP.
const calendarRequest = vi.fn();
vi.mock("./client.js", () => ({ calendarRequest: (...a: unknown[]) => calendarRequest(...a) }));
vi.mock("./auth.js", () => ({
	CALENDAR_CONFIG_PATH: "/tmp/oauth.json",
	calendarConnectionStatus: vi.fn(async () => ({
		connected: true,
		hasCalendarScope: true,
		configPath: "/tmp/oauth.json",
	})),
}));

import { createCalendarTool } from "./tool.js";

const tool = createCalendarTool();
// biome-ignore lint/suspicious/noExplicitAny: test harness invokes execute directly
const run = (params: any) => (tool.execute as any)("call-1", params, undefined);

beforeEach(() => calendarRequest.mockClear());

describe("google_calendar tool", () => {
	it("is named google_calendar", () => {
		expect(tool.name).toBe("google_calendar");
	});

	it("list_events passes singleEvents+orderBy and default maxResults", async () => {
		calendarRequest.mockResolvedValue({ items: [] });
		await run({ action: "list_events" });
		const [path, opts] = calendarRequest.mock.calls[0];
		expect(path).toBe("/calendars/primary/events");
		expect(opts.query).toMatchObject({ singleEvents: true, orderBy: "startTime", maxResults: 20 });
	});

	it("create_event builds dateTime start and defaults a 1h end", async () => {
		calendarRequest.mockResolvedValue({ id: "e1", summary: "1:1", start: { dateTime: "x" } });
		await run({ action: "create_event", summary: "1:1", start: "2026-06-10T15:00:00Z" });
		const [path, opts] = calendarRequest.mock.calls[0];
		expect(path).toBe("/calendars/primary/events");
		expect(opts.method).toBe("POST");
		expect(opts.body.start).toEqual({ dateTime: "2026-06-10T15:00:00Z" });
		// default end = start + 1h
		expect(opts.body.end.dateTime).toBe(new Date(Date.parse("2026-06-10T15:00:00Z") + 3600000).toISOString());
	});

	it("create_event treats YYYY-MM-DD as an all-day event", async () => {
		calendarRequest.mockResolvedValue({ id: "e2" });
		await run({ action: "create_event", summary: "Holiday", start: "2026-12-25" });
		const body = calendarRequest.mock.calls[0][1].body;
		expect(body.start).toEqual({ date: "2026-12-25" });
		expect(body.end).toBeUndefined(); // no auto-duration for all-day
	});

	it("create_event maps attendees to {email} objects and honors sendUpdates", async () => {
		calendarRequest.mockResolvedValue({ id: "e3" });
		await run({
			action: "create_event",
			summary: "sync",
			start: "2026-06-10T15:00:00Z",
			attendees: ["a@x.com", "b@x.com"],
			sendUpdates: "all",
		});
		const [, opts] = calendarRequest.mock.calls[0];
		expect(opts.body.attendees).toEqual([{ email: "a@x.com" }, { email: "b@x.com" }]);
		expect(opts.query.sendUpdates).toBe("all");
	});

	it("uses a custom calendarId (URL-encoded) when provided", async () => {
		calendarRequest.mockResolvedValue({ items: [] });
		await run({ action: "list_events", calendarId: "team@group.calendar.google.com" });
		expect(calendarRequest.mock.calls[0][0]).toBe(
			"/calendars/team%40group.calendar.google.com/events",
		);
	});

	it("delete_event requires an eventId (returns isError without calling API)", async () => {
		const res = await run({ action: "delete_event" });
		expect(res.isError).toBe(true);
		expect(calendarRequest).not.toHaveBeenCalled();
	});

	it("freebusy posts the window and summarizes busy blocks", async () => {
		calendarRequest.mockResolvedValue({
			calendars: { primary: { busy: [{ start: "s", end: "e" }] } },
		});
		const res = await run({
			action: "freebusy",
			timeMin: "2026-06-10T00:00:00Z",
			timeMax: "2026-06-11T00:00:00Z",
		});
		expect(calendarRequest.mock.calls[0][0]).toBe("/freeBusy");
		expect(res.details.busy).toHaveLength(1);
	});

	it("surfaces API errors as isError results", async () => {
		calendarRequest.mockImplementationOnce(() =>
			Promise.reject(new Error("insufficientPermissions")),
		);
		await expect(run({ action: "list_events" })).resolves.toMatchObject({
			isError: true,
			content: [{ text: expect.stringContaining("insufficientPermissions") }],
		});
	});
});
