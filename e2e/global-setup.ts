import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const E2E_STATE_PATH = resolve("test-results/e2e-live-state.json");

type LiveE2eState = {
  userId: string;
  baselineBusinessIds: string[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is required for isolated authenticated E2E cleanup.`);
  }
  return value;
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
  requiredEnv("SUPABASE_SECRET_KEY");

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

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !authData.user) {
    throw new Error(`Could not authenticate the dedicated E2E account: ${authError?.message ?? "missing user"}`);
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
