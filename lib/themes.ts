import "server-only";
import { createClient } from "@supabase/supabase-js";
import { themeSettings } from "@/lib/config/program";
import type { Database } from "@/lib/database.types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type PublicTheme = {
  name: string;
  description: string | null;
  mainValue: string;
  colorHex: string | null;
  cyclePosition: number;
};

/**
 * The active rotating theme, or null when none has been published yet (or
 * the homepage section is switched off in lib/config/program.ts).
 * The database only returns a theme that has a name and a main value.
 */
export async function getActiveTheme(): Promise<PublicTheme | null> {
  if (!themeSettings.showOnHomepage) return null;
  try {
    const { url, publishableKey } = getSupabasePublicEnv();
    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("get_active_theme");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
    const theme = data as Record<string, unknown>;
    if (typeof theme.name !== "string" || typeof theme.mainValue !== "string") return null;
    return {
      name: theme.name,
      description: typeof theme.description === "string" ? theme.description : null,
      mainValue: theme.mainValue,
      colorHex: typeof theme.colorHex === "string" ? theme.colorHex : null,
      cyclePosition: typeof theme.cyclePosition === "number" ? theme.cyclePosition : 0,
    };
  } catch {
    return null;
  }
}
