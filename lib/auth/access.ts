/**
 * Pure authorization rules, kept free of Next.js and Supabase imports so they
 * can be unit tested. lib/auth/admin.ts wires them to the real session.
 */

export type AdminRole = "admin" | "staff";

export type AdminSession = {
  userId: string;
  email: string | null;
  fullName: string;
  role: AdminRole;
};

export type AdminAccess =
  | { status: "signed_out" }
  | { status: "not_authorized"; email: string | null }
  | { status: "authorized"; admin: AdminSession };

type Claims = { sub?: unknown; email?: unknown } | null | undefined;
type ProfileRow = { full_name: string; role: string; is_active: boolean } | null | undefined;

/**
 * Being signed in is not enough: the user also needs an active admin_profiles
 * row with a known role.
 */
export function resolveAdminAccess(claims: Claims, profile: ProfileRow): AdminAccess {
  const userId = typeof claims?.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  if (!userId) return { status: "signed_out" };

  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!profile || !profile.is_active || (profile.role !== "admin" && profile.role !== "staff")) {
    return { status: "not_authorized", email };
  }

  return {
    status: "authorized",
    admin: { userId, email, fullName: profile.full_name, role: profile.role },
  };
}

/** Health and special-consideration notes are visible to full admins only. */
export function canViewHealthNotes(admin: AdminSession): boolean {
  return admin.role === "admin";
}

/** Correcting or deleting payments, deleting groups, managing school years. */
export function canManageSensitiveRecords(admin: AdminSession): boolean {
  return admin.role === "admin";
}

/** Only allow redirects to paths inside the admin area after login. */
export function safeAdminRedirect(next: unknown): string {
  if (typeof next !== "string") return "/admin";
  if (!next.startsWith("/admin") || next.startsWith("//") || next.includes("\\")) return "/admin";
  if (next.startsWith("/admin/login")) return "/admin";
  return next;
}
