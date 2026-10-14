import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Service-role client. It BYPASSES Row Level Security, so it is used only for
 * the narrow server-side tasks that need it: calling the public registration
 * RPC and the rate limiter (both granted to service_role only).
 * Never import this from a Client Component; `server-only` enforces that.
 */
export function createSupabaseServiceClient() {
  const { url } = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. See .env.example.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
