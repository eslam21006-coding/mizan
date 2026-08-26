import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const E2E_STATE_PATH = resolve("test-results/e2e-live-state.json");

type LiveE2eState = {
  userId: string;
  baselineBusinessIds: string[];
};

type CleanupInput = {
  supabaseUrl: string;
  secretKey: string;
  userId: string;
  businessIds: string[];
};

const BUSINESS_DEPENDENT_TABLES = [
  "customer_cohort_cost_allocations",
  "customer_transaction_duplicate_resolutions",
  "customer_transactions",
  "customer_transaction_sources",
  "funnel_monthly_entries",
  "funnel_monthly_periods",
  "funnels",
  "monthly_front_end_expense_allocations",
] as const;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is required for isolated authenticated E2E cleanup.`);
  }
  return value;
}

async function readPreviousState() {
  try {
    return JSON.parse(await readFile(E2E_STATE_PATH, "utf8")) as LiveE2eState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function cleanupE2eBusinesses({
  supabaseUrl,
  secretKey,
  userId,
  businessIds,
}: CleanupInput) {
  if (businessIds.length === 0) return;

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  for (const table of BUSINESS_DEPENDENT_TABLES) {
    const { error } = await adminClient.from(table).delete().in("business_id", businessIds);
    if (error) {
      throw new Error(`E2E cleanup failed for ${table}: ${error.message}`);
    }
  }

  const { error: deleteBusinessError } = await adminClient
    .from("businesses")
    .delete()
    .eq("owner_user_id", userId)
    .in("id", businessIds);
  if (deleteBusinessError) {
    throw new Error(`E2E cleanup failed for businesses: ${deleteBusinessError.message}`);
  }

  const { data: leftovers, error: verifyError } = await adminClient
    .from("businesses")
    .select("id")
    .in("id", businessIds);
  if (verifyError) {
    throw new Error(`Could not verify E2E cleanup: ${verifyError.message}`);
  }
  if ((leftovers ?? []).length > 0) {
    throw new Error("E2E cleanup verification found test businesses that were not removed.");
  }
}

export default async function globalSetup() {
  const email = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
  const password = process.env.MIZAN_E2E_PASSWORD ?? "";
  const inviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
  const hasLiveAuth = Boolean(inviteTokenHash || (email && password));

  if (!hasLiveAuth) return;

  if (!email || !password) {
    throw new Error(
      "Authenticated Mizan E2E mutates business data, so invite-token-only runs are blocked. Use a dedicated reusable E2E email/password account so created businesses can be identified and removed after the suite.",
    );
  }

  if (process.env.MIZAN_E2E_DEDICATED_ACCOUNT !== "true") {
    throw new Error(
      "Refusing to run authenticated Mizan E2E against an ordinary account. Set MIZAN_E2E_DEDICATED_ACCOUNT=true only for a dedicated disposable test account.",
    );
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requiredEnv("SUPABASE_SECRET_KEY");

  if (supabaseUrl.includes("ci-placeholder.supabase.co")) {
    throw new Error("Authenticated E2E cannot use the CI placeholder Supabase project.");
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    throw new Error(`Could not authenticate the dedicated E2E account: ${authError?.message ?? "missing user"}`);
  }

  const previousState = await readPreviousState();
  if (previousState) {
    if (previousState.userId !== authData.user.id) {
      throw new Error("Pending E2E cleanup belongs to a different user. Refusing to overwrite cleanup ownership.");
    }

    const { data: currentBusinesses, error: currentBusinessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", authData.user.id);
    if (currentBusinessError) {
      throw new Error(`Could not enumerate pending E2E cleanup targets: ${currentBusinessError.message}`);
    }

    const previousBaseline = new Set(previousState.baselineBusinessIds);
    const pendingBusinessIds = (currentBusinesses ?? [])
      .map((business) => String(business.id))
      .filter((businessId) => !previousBaseline.has(businessId));

    await cleanupE2eBusinesses({ supabaseUrl, secretKey, userId: authData.user.id, businessIds: pendingBusinessIds });
    await rm(E2E_STATE_PATH, { force: true });
  }

  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", authData.user.id);
  if (businessError) {
    throw new Error(`Could not capture the E2E business baseline: ${businessError.message}`);
  }

  const state: LiveE2eState = {
    userId: authData.user.id,
    baselineBusinessIds: (businesses ?? []).map((business) => String(business.id)),
  };

  await mkdir(dirname(E2E_STATE_PATH), { recursive: true });
  await writeFile(E2E_STATE_PATH, JSON.stringify(state), "utf8");
  await supabase.auth.signOut();
}
