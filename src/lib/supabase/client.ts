import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicConfig();

  return createBrowserClient(url, publishableKey);
}
