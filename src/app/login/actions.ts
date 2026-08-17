"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRoleFromAppMetadata } from "@/lib/auth/role";
import { safeLocalPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeLocalPath(String(formData.get("next") ?? ""), "/");

  if (!email || !password) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !getRoleFromAppMetadata(user.app_metadata)) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?error=not-invited");
  }

  revalidatePath("/", "layout");
  redirect(next);
}
