import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAdminAccess, type AdminAccess, type AdminSession } from "./access";

/**
 * The single place where the app decides who is an administrator.
 * Memoized per request with React's cache().
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const supabase = await createSupabaseServerClient();

  // getClaims() verifies the session JWT rather than trusting the cookie.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return { status: "signed_out" };

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("full_name, role, is_active")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  return resolveAdminAccess(data.claims, profile);
});

/** For admin pages: redirects anyone who is not an active administrator. */
export async function requireAdmin(): Promise<AdminSession> {
  const access = await getAdminAccess();
  if (access.status === "signed_out") redirect("/admin/login");
  if (access.status === "not_authorized") redirect("/admin/login?error=not_authorized");
  return access.admin;
}

/**
 * For Server Actions and Route Handlers: returns the admin or null.
 * Never rely on the page having checked access already; actions are
 * reachable by direct POST requests.
 */
export async function getAuthorizedAdmin(): Promise<AdminSession | null> {
  const access = await getAdminAccess();
  return access.status === "authorized" ? access.admin : null;
}
