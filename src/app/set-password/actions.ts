"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRoleFromAppMetadata } from "@/lib/auth/role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 12 || password.length > 128 || password !== confirmation) {
    redirect("/set-password?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  if (!getRoleFromAppMetadata(user.app_metadata)) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/access-denied");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/set-password?error=update");
  }

  revalidatePath("/", "layout");
  redirect("/");
}
