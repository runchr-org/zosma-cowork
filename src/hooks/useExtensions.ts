import type { ExtensionInfo } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Result of an install operation (from backend) */
export interface InstallResult {
  id: string;
  name: string;
  version: string;
  sourceType: string;
  path: string;
  settingsUpdated: boolean;
}

/** Payload for installing an extension */
export interface InstallPayload {
  source: string;
  refName?: string;
}

// Convert backend InstallResult to frontend ExtensionInfo
function toExtensionInfo(result: InstallResult): ExtensionInfo {
  return {
    id: result.id,
    name: result.name,
    version: result.version,
    source: result.sourceType as ExtensionInfo["source"],
    path: result.path,
  };
}

export function useExtensions() {
  const [rawExtensions, setRawExtensions] = useState<InstallResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Memoized conversion to ExtensionInfo[]
  const extensions: ExtensionInfo[] = useMemo(
    () => rawExtensions.map(toExtensionInfo),
    [rawExtensions],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<InstallResult[]>("list_extensions_v2");
      setRawExtensions(list);
    } catch (err) {
      console.error("Failed to load extensions:", err);
      setError(err instanceof Error ? err.message : "Failed to load extensions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = useCallback(async (payload: InstallPayload) => {
    setInstalling(true);
    setError(null);
    try {
      const result = await invoke<InstallResult>("install_extension", {
        source: payload.source,
        refName: payload.refName,
      });
      await refresh();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Installation failed";
      setError(msg);
      throw err;
    } finally {
      setInstalling(false);
    }
  }, [refresh]);

  const uninstall = useCallback(async (id: string) => {
    setUninstallingId(id);
    setError(null);
    try {
      await invoke("uninstall_extension", { id });
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Uninstallation failed";
      setError(msg);
      throw err;
    } finally {
      setUninstallingId(null);
    }
  }, [refresh]);

  return { extensions, loading, installing, uninstallingId, error, refresh, install, uninstall };
}
