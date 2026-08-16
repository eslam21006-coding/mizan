export const supabasePublicConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
} as const;

export const hasSupabasePublicConfig = Boolean(
  supabasePublicConfig.url && supabasePublicConfig.publishableKey,
);
