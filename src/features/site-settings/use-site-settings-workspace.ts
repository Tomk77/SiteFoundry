import { useCallback, useEffect, useState } from "react";

import { loadSiteSettingsWorkspace, type SiteSettingsWorkspace } from "@/lib/site-settings";

export function useSiteSettingsWorkspace(userId?: string) {
  const [workspace, setWorkspace] = useState<SiteSettingsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      setWorkspace(await loadSiteSettingsWorkspace());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Site Settings.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { workspace, loading, error, reload };
}
