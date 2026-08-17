import { type NextRequest, NextResponse } from "next/server";
import { getRoleFromAppMetadata } from "@/lib/auth/role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || type !== "invite") {
    return NextResponse.redirect(new URL("/login?error=invalid-invite", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid-invite", request.url));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !getRoleFromAppMetadata(user.app_metadata)) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.redirect(new URL("/set-password", request.url));
}
