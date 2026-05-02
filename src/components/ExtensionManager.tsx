/**
 * Extension Manager UI Component
 * Allows users to install, list, and uninstall extensions.
 */

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Download, Loader2, Package, Plus, Search, Trash2 } from "lucide-react";

import { useExtensions } from "@/hooks/useExtensions";

export function ExtensionManager() {
  const { extensions, loading, installing, uninstallingId, error, install, uninstall } = useExtensions();

  // Install state
  const [installSource, setInstallSource] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInstall = async () => {
    if (!installSource.trim()) return;
    try {
      setInstallError(null);
      await install({ source: installSource.trim() });
      setInstallSource("");
    } catch {
      setInstallError("Installation failed. Check the error message above.");
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      await uninstall(id);
    } catch {
      // Error is handled by the hook
    }
  };

  const sourceTypeBadge = (source?: string) => {
    if (!source) return null;
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return (
        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
          git
        </span>
      );
    }
    if (source.startsWith("npm:") || source.startsWith("@")) {
      return (
        <span className="inline-flex items-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          npm
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
        local
      </span>
    );
  };

  const formatSource = (source: string) => {
    if (source.startsWith("npm:")) return source.slice(4);
    if (source.endsWith(".git")) return source.slice(0, -4);
    return source;
  };

  return (
    <div className="space-y-6">
      {/* Install Section */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Install Extension</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Install extensions from npm packages, git repositories, or local paths.
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="npm:@zosmaai/zosma-slides or git URL or local path"
              value={installSource}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallSource(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleInstall()}
              className="flex h-9 w-full rounded-md border bg-background px-3 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={installing}
            />
          </div>
          <button type="button"
            onClick={handleInstall}
            disabled={installing || !installSource.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9"
          >
            {installing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Install
              </>
            )}
          </button>
        </div>

        {/* Advanced Options */}
        <button type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showAdvanced ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
            <p><strong>npm:</strong> @zosmaai/zosma-slides or npm:@scope/package</p>
            <p><strong>git:</strong> https://github.com/user/repo.git</p>
            <p><strong>local:</strong> /absolute/path/to/extension</p>
          </div>
        )}

        {installError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{installError}</p>
          </div>
        )}
      </div>

      {/* Installed Extensions */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Installed Extensions</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Manage your installed extensions.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : extensions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">No extensions installed yet.</p>
            <p className="text-xs mt-1">Install an extension from above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {extensions.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{ext.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>v{ext.version || "unknown"}</span>
                      {sourceTypeBadge(ext.source)}
                      {ext.path && (
                        <span className="text-xs truncate max-w-[200px]" title={ext.path}>
                          {formatSource(ext.path)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button type="button"
                  onClick={() => handleUninstall(ext.id)}
                  disabled={uninstallingId === ext.id}
                  className="inline-flex items-center justify-center rounded-md h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                >
                  {uninstallingId === ext.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
