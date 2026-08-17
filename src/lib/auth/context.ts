import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoleFromAppMetadata, getRoleFromClaims, type MizanRole } from "./role";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: MizanRole;
};

type ClaimsRecord = Record<string, unknown>;

function readStringClaim(claims: ClaimsRecord, key: string) {
  const value = claims[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as ClaimsRecord | undefined;

  if (error || !claims) {
    return null;
  }

  const role = getRoleFromClaims(claims);
  const userId = readStringClaim(claims, "sub");
  if (!role || !userId) {
    return null;
  }

  return {
    userId,
    email: readStringClaim(claims, "email"),
    role,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as ClaimsRecord | undefined;

  if (error || !claims) {
    redirect("/login");
  }

  const role = getRoleFromClaims(claims);
  const userId = readStringClaim(claims, "sub");
  if (!role || !userId) {
    redirect("/access-denied");
  }

  return {
    userId,
    email: readStringClaim(claims, "email"),
    role,
  };
}

export async function requireFreshAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  if (getRoleFromAppMetadata(user.app_metadata) !== "admin") {
    redirect("/access-denied");
  }

  return { supabase, user };
}
