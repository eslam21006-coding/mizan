import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessSettingsView } from "./business-settings-view";

type BusinessSettingsPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads one accessible business and renders its authoritative Settings hierarchy. */
export default async function BusinessSettingsPage({ params }: BusinessSettingsPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  return (
    <BusinessSettingsView
      business={{
        id: business.id,
        name: business.name,
        baseCurrency: business.base_currency,
        timezone: business.timezone,
      }}
      canDelete={auth.role === "admin" || business.owner_user_id === auth.userId}
    />
  );
}
