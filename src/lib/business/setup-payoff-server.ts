import "server-only";

import { requireAuthContext } from "@/lib/auth/context";
import { loadBusinessSetup } from "./setup-loader";
import { loadDashboardMonth } from "./dashboard-month";
import { resolveSetupPayoffResult } from "./setup-payoff-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Requires an authenticated session before any business-specific eligibility or financial read. */
export async function loadAuthenticatedSetupPayoff(
  businessId: string,
  requestedMonth: string | readonly string[] | undefined,
) {
  await requireAuthContext();
  return resolveSetupPayoffResult(businessId, requestedMonth, {
    loadSetup: loadBusinessSetup,
    loadMonth: async (authorizedBusinessId, monthStart) =>
      loadDashboardMonth(
        await createSupabaseServerClient(),
        authorizedBusinessId,
        monthStart,
      ),
  });
}
