import { readFile, rm } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { cleanupE2eBusinesses, E2E_STATE_PATH } from "./global-setup";

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

  await cleanupE2eBusinesses({
    supabaseUrl,
    secretKey,
    userId: state.userId,
    businessIds: createdBusinessIds,
  });

  await rm(E2E_STATE_PATH, { force: true });
}
