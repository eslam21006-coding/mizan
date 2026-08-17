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
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowsHttp = url.protocol === "http:" && isLocalHost;
  if (url.protocol !== "https:" && !allowsHttp) {
    throw new Error("MIZAN_SITE_URL must use HTTPS outside local development.");
  }

  return url;
}
