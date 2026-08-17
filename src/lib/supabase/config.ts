const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabasePublicConfig = {
  url: supabaseUrl,
  publishableKey,
} as const;

export const hasSupabasePublicConfig = Boolean(
  supabasePublicConfig.url && supabasePublicConfig.publishableKey,
);

export function getSupabasePublicConfig() {
  if (!hasSupabasePublicConfig) {
    throw new Error("Supabase public configuration is missing.");
  }

  return supabasePublicConfig;
}
