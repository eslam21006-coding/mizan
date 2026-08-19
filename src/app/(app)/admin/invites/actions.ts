"use server";

import { redirect } from "next/navigation";
import { requireFreshAdmin } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMizanSiteUrl } from "@/lib/supabase/server-config";

function normalizeEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return null;
  }

  return email;
}

export async function inviteMentee(formData: FormData) {
  await requireFreshAdmin();
  const email = normalizeEmail(formData.get("email"));
  if (!email) {
    redirect("/admin/invites?status=invalid-email");
  }

  const admin = createSupabaseAdminClient();
  const inviteCallback = new URL("/auth/callback", getMizanSiteUrl());
  inviteCallback.searchParams.set("next", "/set-password");
  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteCallback.toString(),
  });

  if (inviteError || !data.user) {
    redirect("/admin/invites?status=invite-failed");
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: {
      ...data.user.app_metadata,
      role: "mentee",
    },
  });

  if (roleError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/admin/invites?status=${cleanupError ? "cleanup-failed" : "role-failed"}`);
  }

  redirect("/admin/invites?status=sent");
}
