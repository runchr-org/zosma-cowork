/**
 * Shared auth types — mirror of the sidecar's `get_auth_status` response.
 *
 * Kept here (rather than re-declared in each consumer) so adding a field
 * on the sidecar only needs one frontend update.
 */

export type AuthStatusEntry = {
	id: string;
	type: "api_key" | "oauth" | "unknown";
	expires?: number;
};

export type ApiKeyProvider = {
	/** Provider id used by pi-mono's `AuthStorage` and `ModelRegistry`. */
	id: string;
	/** Human-friendly label from `ModelRegistry.getProviderDisplayName()`. */
	displayName: string;
};

export type AuthStatus = {
	/** Currently configured credentials, one per provider id. */
	providers: AuthStatusEntry[];
	/** OAuth-capable provider ids the SDK supports. */
	supported: string[];
	/**
	 * Every provider pi-mono knows about, deduped, sorted by display name.
	 * The UI uses this to populate the API-key provider picker (issue #150).
	 *
	 * Optional because older sidecar builds did not return it — UI must
	 * treat absence as "no picker, freeform input".
	 */
	apiKeyProviders?: ApiKeyProvider[];
};
