import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export { formatSchoolYear } from "@/lib/school-year-format";

/**
 * The school year currently open for registration, or null if registration is
 * closed. Uses the publishable key: the only thing the public may read is this
 * label, via the get_open_school_year() function.
 */
export async function getOpenSchoolYear(): Promise<string | null> {
  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("get_open_school_year");
    if (error) {
      console.error("[school-year] lookup failed", error.code);
      return null;
    }
    const label = (data as { label?: unknown } | null)?.label;
    return typeof label === "string" ? label : null;
  } catch {
    return null;
  }
}

