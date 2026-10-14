import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the Supabase auth session cookies for an incoming request and
 * reports whether a (cryptographically verified) user is signed in.
 *
 * This is only an optimistic check used to redirect early. Real authorization
 * happens in lib/auth/admin.ts and in the database's RLS policies.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() validates the JWT; do not run code between client creation
  // and this call, or sessions may be dropped unexpectedly.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  return { response, isSignedIn };
}
