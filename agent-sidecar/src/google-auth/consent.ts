/**
 * google-auth/consent — loopback redirect + PKCE consent for the Zosma Google
 * broker. Returns the raw token response + resolved account email; the caller
 * (broker.fanOutCredentials) writes them to the real package config files.
 *
 * Flow (Google installed-app / loopback, RFC 8252 + PKCE S256):
 *   1. Bind an ephemeral http server on 127.0.0.1 → redirect_uri.
 *   2. Open the consent URL (browser) via the injected `onAuthUrl` callback —
 *      mirrors the existing start_oauth handler which emits an
 *      `oauth_open_url` event the frontend opens.
 *   3. Receive ?code=…&state=… on the loopback callback, verify state.
 *   4. Exchange code (+ code_verifier + client_secret) for tokens.
 *   5. Resolve the account email from the userinfo endpoint.
 *
 * Cancellation: pass an AbortSignal; aborting closes the loopback server and
 * rejects with an AbortError so re-entrant connect attempts can't get stuck on
 * a bound port (same hazard the start_oauth handler documents).
 */

import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { type EmbeddedClient, type OAuthTokenResponse, UNION_SCOPES } from "./broker.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export interface ConsentResult {
	tokens: OAuthTokenResponse;
	email: string;
	redirectUri: string;
}

export interface ConsentOptions {
	client: EmbeddedClient;
	/** Called with the consent URL so the caller can open the user's browser. */
	onAuthUrl: (url: string) => void;
	signal?: AbortSignal;
	/** Fixed loopback port (0 = OS-assigned ephemeral). Default 0. */
	port?: number;
}

function base64Url(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makePkce(): { verifier: string; challenge: string } {
	const verifier = base64Url(randomBytes(32));
	const challenge = base64Url(createHash("sha256").update(verifier).digest());
	return { verifier, challenge };
}

function listen(server: Server, port: number): Promise<number> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => {
			const addr = server.address();
			if (addr && typeof addr === "object") resolve(addr.port);
			else reject(new Error("failed to bind loopback server"));
		});
	});
}

function abortError(): Error {
	const err = new Error("Google consent cancelled");
	err.name = "AbortError";
	return err;
}

/** Run the full consent flow and return tokens + email. */
export async function runConsent(opts: ConsentOptions): Promise<ConsentResult> {
	if (!opts.client.clientId || !opts.client.clientSecret) {
		throw new Error(
			"Zosma Google OAuth client not configured (set ZOSMA_GOOGLE_CLIENT_ID / ZOSMA_GOOGLE_CLIENT_SECRET).",
		);
	}
	if (opts.signal?.aborted) throw abortError();

	const { verifier, challenge } = makePkce();
	const state = base64Url(randomBytes(16));

	const server = createServer();
	const port = await listen(server, opts.port ?? 0);
	const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

	// Wait for the loopback callback (or abort).
	const code = await new Promise<string>((resolve, reject) => {
		const onAbort = () => {
			server.close();
			reject(abortError());
		};
		opts.signal?.addEventListener("abort", onAbort, { once: true });

		server.on("request", (req, res) => {
			const url = new URL(req.url ?? "/", redirectUri);
			if (url.pathname !== "/oauth2callback") {
				res.writeHead(404).end();
				return;
			}
			const err = url.searchParams.get("error");
			const returnedState = url.searchParams.get("state");
			const returnedCode = url.searchParams.get("code");

			const finish = (status: number, body: string) => {
				res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" }).end(body);
				opts.signal?.removeEventListener("abort", onAbort);
				server.close();
			};

			if (err) {
				finish(400, htmlPage("Connection failed", `Google returned: ${escapeHtml(err)}`));
				reject(new Error(`Google consent error: ${err}`));
				return;
			}
			if (!returnedState || returnedState !== state) {
				finish(400, htmlPage("Connection failed", "State mismatch — please try again."));
				reject(new Error("OAuth state mismatch"));
				return;
			}
			if (!returnedCode) {
				finish(400, htmlPage("Connection failed", "No authorization code returned."));
				reject(new Error("No authorization code returned"));
				return;
			}
			finish(
				200,
				htmlPage("Google connected", "You can close this tab and return to Zosma Cowork."),
			);
			resolve(returnedCode);
		});

		// Build + open the consent URL.
		const authParams = new URLSearchParams({
			client_id: opts.client.clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: UNION_SCOPES.join(" "),
			access_type: "offline",
			prompt: "consent",
			include_granted_scopes: "true",
			code_challenge: challenge,
			code_challenge_method: "S256",
			state,
		});
		opts.onAuthUrl(`${AUTH_URL}?${authParams.toString()}`);
	});

	// Exchange the code for tokens (client_secret + PKCE verifier).
	const tokens = await exchangeCode(opts.client, code, redirectUri, verifier, opts.signal);
	const email = await fetchEmail(tokens.access_token, opts.signal);
	return { tokens, email, redirectUri };
}

async function exchangeCode(
	client: EmbeddedClient,
	code: string,
	redirectUri: string,
	verifier: string,
	signal?: AbortSignal,
): Promise<OAuthTokenResponse> {
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: client.clientId,
			client_secret: client.clientSecret,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
			code_verifier: verifier,
		}),
		signal,
	});
	const text = await res.text();
	let data: Record<string, unknown> = {};
	try {
		data = JSON.parse(text) as Record<string, unknown>;
	} catch {
		// fall through to the error path below
	}
	if (!res.ok || typeof data.access_token !== "string") {
		const msg =
			typeof data.error_description === "string"
				? data.error_description
				: `Token exchange failed (HTTP ${res.status})`;
		throw new Error(msg);
	}
	return data as unknown as OAuthTokenResponse;
}

async function fetchEmail(accessToken: string, signal?: AbortSignal): Promise<string> {
	try {
		const res = await fetch(USERINFO_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
			signal,
		});
		if (!res.ok) return "unknown";
		const data = (await res.json()) as { email?: string };
		return data.email ?? "unknown";
	} catch {
		return "unknown";
	}
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
}

function htmlPage(title: string, message: string): string {
	return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
		title,
	)}</title><style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e8e8ea;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center;max-width:28rem;padding:2rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{opacity:.7}</style></head><body><main><h1>${escapeHtml(
		title,
	)}</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}
