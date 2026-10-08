import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Loads RLS-visible businesses once and provides persistent business context to the app shell. */
export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  const businesses = (businessesData ?? []).map((business) => ({
    id: business.id,
    name: business.name,
    baseCurrency: business.base_currency,
    timezone: business.timezone,
  }));

  return (
    <AppShell
      role={auth.role}
      email={auth.email}
      businesses={businesses}
      businessesLoadFailed={Boolean(businessesError)}
    >
      {children}
    </AppShell>
  );
}
