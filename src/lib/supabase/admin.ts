import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";
import { getSupabaseSecretKey } from "./server-config";

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();

  return createClient(url, getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
