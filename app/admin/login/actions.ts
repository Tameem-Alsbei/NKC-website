"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveAdminAccess, safeAdminRedirect } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string; email: string } | null;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
  next: z.string().max(300).optional(),
});

const INVALID_CREDENTIALS = "That email and password combination didn't work. Please try again.";

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const email = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "Please enter your email address and password.", email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    if (error?.code === "over_request_rate_limit" || error?.status === 429) {
      return { error: "Too many sign-in attempts. Please wait a few minutes and try again.", email };
    }
    return { error: INVALID_CREDENTIALS, email };
  }

  // Signing in is not enough: the account must also be an active administrator.
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("full_name, role, is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const access = resolveAdminAccess({ sub: data.user.id, email: data.user.email }, profile);
  if (access.status !== "authorized") {
    await supabase.auth.signOut();
    return {
      error: "This account doesn't have access to the school dashboard. Please contact a school administrator.",
      email,
    };
  }

  redirect(safeAdminRedirect(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login?signed_out=1");
}
