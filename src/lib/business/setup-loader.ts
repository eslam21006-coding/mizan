import "server-only";

import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveBusinessSetupReadiness,
  type BusinessSetupReadiness,
} from "./setup-readiness.ts";

export type LoadedBusinessSetup = {
  kind: "loaded";
  business: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
  };
  canManage: boolean;
  revenueSourceCount: number;
  latestSavedMonthKey: string | null;
  readiness: BusinessSetupReadiness;
};

export type BusinessSetupLoadResult =
  | LoadedBusinessSetup
  | { kind: "not_found" }
  | {
      kind: "load_error";
      business: LoadedBusinessSetup["business"];
      canManage: boolean;
      readiness: BusinessSetupReadiness;
    };

/**
 * Loads only authoritative Core Setup facts through the existing authenticated Supabase/RLS path.
 *
 * Expense item rows are deliberately not loaded: canonical Step 3 is complete only when the B02
 * explicit review timestamp exists.
 */
export async function loadBusinessSetup(
  businessId: string,
): Promise<BusinessSetupLoadResult> {
  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id,expense_setup_reviewed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business) {
    return { kind: "not_found" };
  }

  const businessContext = {
    id: business.id,
    name: business.name,
    baseCurrency: business.base_currency,
    timezone: business.timezone,
  };
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  const [streamsResult, latestPeriodResult] = await Promise.all([
    supabase
      .from("revenue_streams")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("monthly_periods")
      .select("month_start")
      .eq("business_id", businessId)
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (streamsResult.error || latestPeriodResult.error) {
    return {
      kind: "load_error",
      business: businessContext,
      canManage,
      readiness: resolveBusinessSetupReadiness({
        loadState: "load_error",
        revenueSourceCount: null,
        expenseSetupReviewedAt: business.expense_setup_reviewed_at,
        validMonthCount: null,
      }),
    };
  }

  const latestSavedMonthKey = latestPeriodResult.data?.month_start
    ? String(latestPeriodResult.data.month_start).slice(0, 7)
    : null;
  const revenueSourceCount = streamsResult.data?.length ?? 0;

  return {
    kind: "loaded",
    business: businessContext,
    canManage,
    revenueSourceCount,
    latestSavedMonthKey,
    readiness: resolveBusinessSetupReadiness({
      loadState: "loaded",
      revenueSourceCount,
      expenseSetupReviewedAt: business.expense_setup_reviewed_at,
      validMonthCount: latestSavedMonthKey === null ? 0 : 1,
    }),
  };
}
