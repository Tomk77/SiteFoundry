import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | null = null;

export function getSupabaseBrowserClient(): BrowserSupabaseClient | null {
  const rawUrl: unknown = import.meta.env.VITE_SUPABASE_URL;
  const rawPublishableKey: unknown = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = typeof rawUrl === "string" ? rawUrl : undefined;
  const publishableKey = typeof rawPublishableKey === "string" ? rawPublishableKey : undefined;

  if (!url || !publishableKey) {
    return null;
  }

  browserClient ??= createBrowserClient<Database>(url, publishableKey);

  return browserClient;
}

export function getSupabaseConfigError() {
  return new Error(
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.",
  );
}
