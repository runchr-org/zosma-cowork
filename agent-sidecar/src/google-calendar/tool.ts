/**
 * google_calendar — single action-dispatched tool for Google Calendar v3.
 *
 * Actions: list_calendars, list_events, get_event, create_event,
 *          update_event, delete_event, quick_add, freebusy, status.
 *
 * Mirrors the `gmail` tool's single-tool/action shape so the agent has one
 * coherent surface per Google product.
 */

import { type Static, Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { calendarConnectionStatus, CALENDAR_CONFIG_PATH } from "./auth.js";
import { calendarRequest, type JsonMap } from "./client.js";

export const CalendarParams = Type.Object({
	action: Type.Union(
		[
			Type.Literal("list_calendars"),
			Type.Literal("list_events"),
			Type.Literal("get_event"),
			Type.Literal("create_event"),
			Type.Literal("update_event"),
			Type.Literal("delete_event"),
			Type.Literal("quick_add"),
			Type.Literal("freebusy"),
			Type.Literal("status"),
		],
		{ description: "Calendar operation to perform" },
	),
	calendarId: Type.Optional(
		Type.String({
			description: "Calendar ID (default: 'primary'). Use list_calendars to discover IDs.",
		}),
	),
	eventId: Type.Optional(
		Type.String({ description: "Event ID (for get_event, update_event, delete_event)" }),
	),
	summary: Type.Optional(
		Type.String({ description: "Event title (create_event / update_event)" }),
	),
	description: Type.Optional(Type.String({ description: "Event description / notes" })),
	location: Type.Optional(Type.String({ description: "Event location" })),
	start: Type.Optional(
		Type.String({
			description:
				"Event start. RFC3339 timestamp ('2026-06-10T15:00:00-07:00') for timed events, or 'YYYY-MM-DD' for all-day.",
		}),
	),
	end: Type.Optional(
		Type.String({
			description: "Event end. Same formats as start. Defaults to 1h after start for timed events.",
		}),
	),
	timeZone: Type.Optional(
		Type.String({ description: "IANA time zone, e.g. 'America/Los_Angeles'." }),
	),
	attendees: Type.Optional(
		Type.Array(Type.String(), {
			description: "Attendee email addresses (create_event / update_event).",
		}),
	),
	timeMin: Type.Optional(
		Type.String({ description: "Lower bound (RFC3339) for list_events / freebusy window." }),
	),
	timeMax: Type.Optional(
		Type.String({ description: "Upper bound (RFC3339) for list_events / freebusy window." }),
	),
	query: Type.Optional(Type.String({ description: "Free-text search filter for list_events." })),
	maxResults: Type.Optional(
		Type.Number({ description: "Max events to return (list_events, default 20)." }),
	),
	text: Type.Optional(
		Type.String({
			description: "Natural-language event for quick_add, e.g. 'Lunch with Sam tomorrow 1pm'.",
		}),
	),
	sendUpdates: Type.Optional(
		Type.Union([Type.Literal("all"), Type.Literal("externalOnly"), Type.Literal("none")], {
			description: "Whether to send invitation emails (default 'none').",
		}),
	),
});

export type TCalendarParams = Static<typeof CalendarParams>;

function isAllDay(value?: string): boolean {
	return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function toEventTime(value: string, timeZone?: string): JsonMap {
	if (isAllDay(value)) return { date: value };
	return timeZone ? { dateTime: value, timeZone } : { dateTime: value };
}

function buildEventBody(p: TCalendarParams): JsonMap {
	const body: JsonMap = {};
	if (p.summary !== undefined) body.summary = p.summary;
	if (p.description !== undefined) body.description = p.description;
	if (p.location !== undefined) body.location = p.location;
	if (p.start) body.start = toEventTime(p.start, p.timeZone);
	if (p.end) {
		body.end = toEventTime(p.end, p.timeZone);
	} else if (p.start && !isAllDay(p.start)) {
		// Default timed events to a 1-hour duration.
		const startMs = Date.parse(p.start);
		if (!Number.isNaN(startMs)) {
			body.end = toEventTime(new Date(startMs + 60 * 60 * 1000).toISOString(), p.timeZone);
		}
	}
	if (p.attendees && p.attendees.length > 0) {
		body.attendees = p.attendees.map((email) => ({ email }));
	}
	return body;
}

function summarizeEvent(ev: JsonMap): string {
	const summary = (ev.summary as string) ?? "(no title)";
	const start = ev.start as JsonMap | undefined;
	const when = (start?.dateTime as string) ?? (start?.date as string) ?? "?";
	const id = (ev.id as string) ?? "?";
	const loc = ev.location ? ` @ ${ev.location as string}` : "";
	return `• ${when} — ${summary}${loc} [${id}]`;
}

function text(t: string, details: JsonMap = {}, isError = false) {
	return {
		content: [{ type: "text" as const, text: t }],
		details,
		...(isError ? { isError: true } : {}),
	};
}

export function createCalendarTool(): ToolDefinition<typeof CalendarParams> {
	return {
		name: "google_calendar",
		label: "Google Calendar",
		description: [
			"Manage Google Calendar events and availability.",
			"Actions: list_calendars, list_events, get_event, create_event, update_event,",
			"delete_event, quick_add, freebusy, status.",
			"",
			"Examples:",
			'  google_calendar({ action: "list_events", timeMin: "2026-06-07T00:00:00Z", maxResults: 10 })',
			'  google_calendar({ action: "create_event", summary: "1:1", start: "2026-06-10T15:00:00-07:00", attendees: ["sam@x.com"], sendUpdates: "all" })',
			'  google_calendar({ action: "quick_add", text: "Dentist friday 9am" })',
			'  google_calendar({ action: "freebusy", timeMin: "2026-06-10T00:00:00Z", timeMax: "2026-06-11T00:00:00Z" })',
		].join("\n"),
		promptSnippet: "Read and manage Google Calendar events, invites, and availability.",
		parameters: CalendarParams,
		execute: async (_toolCallId, params, signal) => {
			const cal = encodeURIComponent(params.calendarId ?? "primary");
			try {
				switch (params.action) {
					case "status": {
						const s = await calendarConnectionStatus();
						return text(
							s.connected
								? `✅ Google connected. Calendar scope: ${s.hasCalendarScope ? "granted" : "MISSING — reconnect with calendar permission"}.`
								: "⚠️ Google not connected. Open Cowork Settings → Integrations → Google.",
							{ ...s, configPath: CALENDAR_CONFIG_PATH },
							s.connected && !s.hasCalendarScope,
						);
					}

					case "list_calendars": {
						const data = await calendarRequest<JsonMap>("/users/me/calendarList", { signal });
						const items = (data.items as JsonMap[]) ?? [];
						const lines = items.map(
							(c) =>
								`• ${(c.summary as string) ?? "(unnamed)"}${c.primary ? " (primary)" : ""} [${c.id as string}]`,
						);
						return text(
							lines.length ? `Calendars (${lines.length}):\n${lines.join("\n")}` : "No calendars found.",
							{ count: lines.length, items },
						);
					}

					case "list_events": {
						const data = await calendarRequest<JsonMap>(`/calendars/${cal}/events`, {
							query: {
								timeMin: params.timeMin,
								timeMax: params.timeMax,
								q: params.query,
								maxResults: params.maxResults ?? 20,
								singleEvents: true,
								orderBy: "startTime",
							},
							signal,
						});
						const items = (data.items as JsonMap[]) ?? [];
						return text(
							items.length
								? `Events (${items.length}):\n${items.map(summarizeEvent).join("\n")}`
								: "No events in range.",
							{ count: items.length, items },
						);
					}

					case "get_event": {
						if (!params.eventId) return text("get_event requires eventId.", {}, true);
						const ev = await calendarRequest<JsonMap>(
							`/calendars/${cal}/events/${encodeURIComponent(params.eventId)}`,
							{ signal },
						);
						return text(
							[
								summarizeEvent(ev),
								ev.description ? `\n${ev.description as string}` : "",
								ev.hangoutLink ? `\nMeet: ${ev.hangoutLink as string}` : "",
							].join(""),
							{ event: ev },
						);
					}

					case "create_event": {
						if (!params.summary && !params.start) {
							return text("create_event requires at least summary and start.", {}, true);
						}
						const ev = await calendarRequest<JsonMap>(`/calendars/${cal}/events`, {
							method: "POST",
							query: { sendUpdates: params.sendUpdates ?? "none" },
							body: buildEventBody(params),
							signal,
						});
						return text(`✅ Created event:\n${summarizeEvent(ev)}`, { event: ev });
					}

					case "update_event": {
						if (!params.eventId) return text("update_event requires eventId.", {}, true);
						const ev = await calendarRequest<JsonMap>(
							`/calendars/${cal}/events/${encodeURIComponent(params.eventId)}`,
							{
								method: "PATCH",
								query: { sendUpdates: params.sendUpdates ?? "none" },
								body: buildEventBody(params),
								signal,
							},
						);
						return text(`✅ Updated event:\n${summarizeEvent(ev)}`, { event: ev });
					}

					case "delete_event": {
						if (!params.eventId) return text("delete_event requires eventId.", {}, true);
						await calendarRequest(`/calendars/${cal}/events/${encodeURIComponent(params.eventId)}`, {
							method: "DELETE",
							query: { sendUpdates: params.sendUpdates ?? "none" },
							signal,
						});
						return text(`✅ Deleted event ${params.eventId}.`, { eventId: params.eventId });
					}

					case "quick_add": {
						if (!params.text) return text("quick_add requires text.", {}, true);
						const ev = await calendarRequest<JsonMap>(`/calendars/${cal}/events/quickAdd`, {
							method: "POST",
							query: { text: params.text, sendUpdates: params.sendUpdates ?? "none" },
							signal,
						});
						return text(`✅ Added:\n${summarizeEvent(ev)}`, { event: ev });
					}

					case "freebusy": {
						if (!params.timeMin || !params.timeMax) {
							return text("freebusy requires timeMin and timeMax.", {}, true);
						}
						const data = await calendarRequest<JsonMap>("/freeBusy", {
							method: "POST",
							body: {
								timeMin: params.timeMin,
								timeMax: params.timeMax,
								items: [{ id: params.calendarId ?? "primary" }],
							},
							signal,
						});
						const cals = (data.calendars as JsonMap) ?? {};
						const target = (cals[params.calendarId ?? "primary"] as JsonMap) ?? {};
						const busy = (target.busy as JsonMap[]) ?? [];
						return text(
							busy.length
								? `Busy (${busy.length}):\n${busy.map((b) => `• ${b.start as string} → ${b.end as string}`).join("\n")}`
								: "Free for the entire window.",
							{ busy },
						);
					}

					default:
						return text(`Unknown action: ${String(params.action)}`, {}, true);
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				return text(`Calendar error: ${message}`, { error: message }, true);
			}
		},
	};
}
