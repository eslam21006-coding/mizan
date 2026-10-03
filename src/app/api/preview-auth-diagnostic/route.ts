/** Temporary verification-only endpoint; reports public configuration booleans, never credentials. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new Response(null, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\\/$/, "") ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  return Response.json({
    preview: true,
    supabaseUrlPresent: Boolean(url),
    expectedMizanProject: url === "https://zpfacvowigsscrnyceqh.supabase.co",
    publishableKeyPresent: Boolean(publishableKey),
  }, { headers: { "Cache-Control": "no-store" } });
}
