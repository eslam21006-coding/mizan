import { notFound } from "next/navigation";
import { AdminBusinessViewingBanner } from "@/components/admin-business-viewing-banner";
import { resolveAdminViewingMentee } from "@/lib/admin-business-viewing";
import type { MenteeDirectoryRow } from "@/lib/admin/mentee-directory";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BusinessRouteLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}>;

/** Adds verified Admin→Mentee ownership context across every route nested under one business. */
export default async function BusinessRouteLayout({
  children,
  params,
}: BusinessRouteLayoutProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  let menteeUserId: string | null = null;
  if (auth.role === "admin" && business.owner_user_id !== auth.userId) {
    const { data: directoryRows, error: directoryError } = await supabase.rpc(
      "admin_mentee_directory",
    );
    if (!directoryError) {
      menteeUserId =
        resolveAdminViewingMentee(
          auth.role,
          auth.userId,
          business.owner_user_id,
          (directoryRows ?? []) as MenteeDirectoryRow[],
        )?.userId ?? null;
    }
  }

  return (
    <>
      {menteeUserId && <AdminBusinessViewingBanner menteeUserId={menteeUserId} />}
      {children}
    </>
  );
}
