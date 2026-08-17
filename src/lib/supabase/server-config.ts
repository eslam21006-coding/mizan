import "server-only";

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

  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("MIZAN_SITE_URL must use HTTPS outside local development.");
  }

  return url;
}
