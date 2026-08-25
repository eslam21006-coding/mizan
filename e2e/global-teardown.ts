import { readFile, rm } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { E2E_STATE_PATH } from "./global-setup";

type LiveE2eState = {
  userId: string;
  baselineBusinessIds: string[];
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export default async function globalTeardown() {
  let state: LiveE2eState;
  try {
    state = JSON.parse(await readFile(E2E_STATE_PATH, "utf8")) as LiveE2eState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY");
  const email = env("MIZAN_E2E_EMAIL");
  const password = process.env.MIZAN_E2E_PASSWORD ?? "";

  if (!supabaseUrl || !publishableKey || !secretKey || !email || !password) {
    throw new Error("Authenticated E2E cleanup credentials disappeared before global teardown.");
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || authData.user?.id !== state.userId) {
    throw new Error(
      `Could not authenticate the same dedicated E2E account during cleanup: ${authError?.message ?? "user mismatch"}`,
    );
  }

  const { data: currentBusinesses, error: businessError } = await userClient
    .from("businesses")
    .select("id")
    .eq("owner_user_id", state.userId);
  if (businessError) {
    throw new Error(`Could not enumerate E2E-created businesses during cleanup: ${businessError.message}`);
  }

  const baseline = new Set(state.baselineBusinessIds);
  const createdBusinessIds = (currentBusinesses ?? [])
    .map((business) => String(business.id))
    .filter((businessId) => !baseline.has(businessId));

  await userClient.auth.signOut();

  if (createdBusinessIds.length > 0) {
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const deleteByBusinessIds = async (table: string) => {
      const { error } = await adminClient.from(table).delete().in("business_id", createdBusinessIds);
      if (error) {
        throw new Error(`E2E cleanup failed for ${table}: ${error.message}`);
      }
    };

    for (const table of [
      "customer_transaction_duplicate_resolutions",
      "customer_transactions",
      "customer_transaction_sources",
      "funnel_monthly_entries",
      "funnel_monthly_periods",
      "funnels",
      "monthly_front_end_expense_allocations",
    ]) {
      await deleteByBusinessIds(table);
    }

    const { error: deleteBusinessError } = await adminClient
      .from("businesses")
      .delete()
      .eq("owner_user_id", state.userId)
      .in("id", createdBusinessIds);
    if (deleteBusinessError) {
      throw new Error(`E2E cleanup failed for businesses: ${deleteBusinessError.message}`);
    }

    const { data: leftovers, error: verifyError } = await adminClient
      .from("businesses")
      .select("id")
      .in("id", createdBusinessIds);
    if (verifyError) {
      throw new Error(`Could not verify E2E cleanup: ${verifyError.message}`);
    }
    if ((leftovers ?? []).length > 0) {
      throw new Error("E2E cleanup verification found test businesses that were not removed.");
    }
  }

  await rm(E2E_STATE_PATH, { force: true });
}
