import "server-only";
import { createHmac } from "node:crypto";

/** Submissions allowed per client within one window. */
export const REGISTRATION_RATE_LIMIT = { limit: 5, windowSeconds: 10 * 60 } as const;

/** Forms submitted faster than this after opening are almost certainly bots. */
export const MINIMUM_FORM_FILL_MS = 4_000;

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Keyed hash of the client IP so the database never stores raw addresses.
 * Uses RATE_LIMIT_SECRET when set, otherwise the (server-only) service key.
 */
export function rateLimitKey(ip: string): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing RATE_LIMIT_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  return createHmac("sha256", secret).update(`registration:${ip}`).digest("hex");
}
