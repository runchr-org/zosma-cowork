/**
 * Thin Google Calendar API v3 client built on the shared OAuth config.
 * Handles auth header injection and a single transparent retry on 401
 * (token refreshed by getValidConfig).
 */

import { getValidConfig } from "./auth.js";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export type JsonMap = Record<string, unknown>;

export interface CalendarRequestOptions {
	method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	query?: Record<string, string | number | boolean | undefined>;
	body?: unknown;
	signal?: AbortSignal;
}

function buildUrl(path: string, query?: CalendarRequestOptions["query"]): string {
	const url = new URL(`${CALENDAR_BASE}${path}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined) continue;
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
}

async function doFetch(
	accessToken: string,
	path: string,
	opts: CalendarRequestOptions,
): Promise<Response> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
	};
	let body: string | undefined;
	if (opts.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(opts.body);
	}
	return fetch(buildUrl(path, opts.query), {
		method: opts.method ?? "GET",
		headers,
		body,
		signal: opts.signal,
	});
}

/**
 * Perform an authenticated Calendar API request. Returns parsed JSON (or {}
 * for empty 204 responses like delete). Throws on non-2xx with the API's
 * error message surfaced.
 */
export async function calendarRequest<T = JsonMap>(
	path: string,
	opts: CalendarRequestOptions = {},
): Promise<T> {
	let config = await getValidConfig(opts.signal);
	let res = await doFetch(config.tokens.access_token, path, opts);

	// One retry if the token was rejected (e.g. revoked then re-granted).
	if (res.status === 401) {
		config = await getValidConfig(opts.signal);
		res = await doFetch(config.tokens.access_token, path, opts);
	}

	if (res.status === 204) return {} as T;

	const text = await res.text();
	let data: JsonMap = {};
	if (text) {
		try {
			data = JSON.parse(text) as JsonMap;
		} catch {
			data = { raw: text };
		}
	}

	if (!res.ok) {
		const errObj = data.error as JsonMap | string | undefined;
		const message =
			typeof errObj === "object" && errObj && typeof errObj.message === "string"
				? errObj.message
				: typeof errObj === "string"
					? errObj
					: `Calendar API error (HTTP ${res.status})`;
		throw new Error(message);
	}

	return data as T;
}
