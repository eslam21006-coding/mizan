import { type NextRequest, NextResponse } from "next/server";
import { getRoleFromAppMetadata } from "@/lib/auth/role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupportedEmailOtpType = "invite" | "recovery";

function getSupportedEmailOtpType(value: string | null): SupportedEmailOtpType | null {
  return value === "invite" || value === "recovery" ? value : null;
}

function invalidLinkError(type: string | null) {
  return type === "recovery" ? "invalid-recovery" : "invalid-invite";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const type = getSupportedEmailOtpType(rawType);

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(`/login?error=${invalidLinkError(rawType)}`, request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${invalidLinkError(type)}`, request.url));
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
