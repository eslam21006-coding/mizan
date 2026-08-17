import "server-only";

import { parseMizanSiteUrl } from "@/lib/auth/site-url";

export function getSupabaseSecretKey() {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing.");
  }

  return secretKey;
}

export function getMizanSiteUrl() {
  const value = process.env.MIZAN_SITE_URL?.trim() ?? "";
  if (!value) {
    throw new Error("MIZAN_SITE_URL is missing.");
  }

  return parseMizanSiteUrl(value);
}
