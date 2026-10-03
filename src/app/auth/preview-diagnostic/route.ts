/** Temporary preview-only diagnostic. Returns configuration status, never credentials or user data. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const url = configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let authEndpointStatus: number | "unreachable" | "not_configured" = "not_configured";
  if (url && publishableKey) {
    try {
      const response = await fetch(url + "/auth/v1/settings", {
        headers: { apikey: publishableKey },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      authEndpointStatus = response.status;
    } catch {
      authEndpointStatus = "unreachable";
    }
  }
  return Response.json({
    preview: true,
    supabaseUrlPresent: Boolean(url),
    expectedMizanProject: url === "https://zpfacvowigsscrnyceqh.supabase.co",
    publishableKeyPresent: Boolean(publishableKey),
    authEndpointStatus,
  }, { headers: { "Cache-Control": "no-store" } });
}
