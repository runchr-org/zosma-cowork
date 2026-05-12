/**
 * useExtensions — React hook for extension management
 *
 * Bridges the ZEM extension system in the sidecar to React state.
 * Provides loading, install, uninstall, enable/disable, and config operations.
 */

import type { ZemExtension } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

interface UseExtensionsReturn {
	/** Currently installed extensions */
	extensions: ZemExtension[];
	/** Loading state */
	loading: boolean;
	/** Error message, if any */
	error: string | null;
	/** Package source currently being installed, or null */
	installing: string | null;

	/** Refresh extension list from backend */
	refresh: () => Promise<void>;
	/** Install an extension from a source string */
	install: (source: string, ref?: string) => Promise<void>;
	/** Uninstall an extension by ID */
	uninstall: (extensionId: string) => Promise<void>;
	/** Enable or disable an extension */
	setEnabled: (extensionId: string, enabled: boolean) => Promise<void>;
	/** Set extension config */
	setConfig: (extensionId: string, config: Record<string, unknown>) => Promise<void>;
	/** Search npm registry for discoverable packages */
	searchDiscover: (query: string) => Promise<NpmSearchResult[]>;
	/** Exposed for components to clear errors */
	clearError: () => void;
}

export interface NpmSearchResult {
	name: string;
	description: string;
	version: string;
	score: number;
}

export function useExtensions(): UseExtensionsReturn {
	const [extensions, setExtensions] = useState<ZemExtension[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [installing, setInstalling] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await invoke<{ extensions?: ZemExtension[] } | ZemExtension[]>(
				"list_extensions",
			);
			// Handle both array response and {extensions: [...]} response
			const list = Array.isArray(result)
				? result
				: (result as { extensions?: ZemExtension[] }).extensions || [];
			setExtensions(list);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const install = useCallback(
		async (source: string, ref?: string) => {
			setInstalling(source);
			setError(null);
			try {
				await invoke<{ extension?: ZemExtension }>("install_extension", {
					source,
					refName: ref || null,
				});
				await refresh();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
				throw err;
			} finally {
				setInstalling(null);
			}
		},
		[refresh],
	);

	const uninstall = useCallback(
		async (extensionId: string) => {
			setError(null);
			try {
				await invoke("uninstall_extension", { extensionId });
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[refresh],
	);

	const setEnabled = useCallback(async (extensionId: string, enabled: boolean) => {
		setError(null);
		try {
			await invoke("set_extension_enabled", { extensionId, enabled });
			// Optimistic update
			setExtensions((prev) =>
				prev.map((ext) => (ext.id === extensionId ? { ...ext, enabled } : ext)),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	const setConfig = useCallback(async (extensionId: string, config: Record<string, unknown>) => {
		setError(null);
		try {
			await invoke("set_extension_config", { extensionId, config });
			setExtensions((prev) =>
				prev.map((ext) => (ext.id === extensionId ? { ...ext, config } : ext)),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	const searchDiscover = useCallback(async (query: string): Promise<NpmSearchResult[]> => {
		setError(null);
		try {
			const result = await invoke<{ packages?: NpmSearchResult[] } | NpmSearchResult[]>(
				"search_discover",
				{ query },
			);
			const list = Array.isArray(result)
				? result
				: (result as { packages?: NpmSearchResult[] }).packages || [];
			return list;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return [];
		}
	}, []);

	const clearError = useCallback(() => setError(null), []);

	return {
		extensions,
		loading,
		error,
		installing,
		refresh,
		install,
		uninstall,
		setEnabled,
		setConfig,
		searchDiscover,
		clearError,
	};
}
