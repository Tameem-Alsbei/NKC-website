/**
 * Reads Supabase configuration from the environment.
 *
 * NEXT_PUBLIC_* values are safe to expose to the browser (the publishable key
 * only grants what RLS allows, which for anonymous users is nothing).
 * SUPABASE_SERVICE_ROLE_KEY is read only in lib/supabase/service.ts, which is
 * marked server-only.
 */
export function getSupabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
    );
  }
  return { url, publishableKey };
}
