export function parseMizanSiteUrl(value: string) {
  const url = new URL(value);
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowsHttp = url.protocol === "http:" && isLocalHost;

  if (url.protocol !== "https:" && !allowsHttp) {
    throw new Error("MIZAN_SITE_URL must use HTTPS outside local development.");
  }

  return url;
}
