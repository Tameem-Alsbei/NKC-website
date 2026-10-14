import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/config/school";
import {
  REGISTRATION_ERROR_MESSAGES,
  registrationErrorFromDatabase,
  statusForRegistrationError,
  type RegistrationErrorCode,
} from "@/lib/registration/errors";
import {
  clientIpFromHeaders,
  MINIMUM_FORM_FILL_MS,
  rateLimitKey,
  REGISTRATION_RATE_LIMIT,
} from "@/lib/registration/rate-limit";
import {
  issuesToFieldErrors,
  registrationRequestSchema,
  registrationResultSchema,
} from "@/lib/registration/schema";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MAX_BODY_BYTES = 64 * 1024;

function errorResponse(code: RegistrationErrorCode, fieldErrors?: Record<string, string>) {
  return NextResponse.json(
    { error: REGISTRATION_ERROR_MESSAGES[code], code, ...(fieldErrors ? { fieldErrors } : {}) },
    { status: statusForRegistrationError(code) },
  );
}

/**
 * Public family registration endpoint.
 *
 * 1. Rejects oversized, malformed or invalid bodies (validated with the same
 *    schema as the form).
 * 2. Applies basic abuse protection: honeypot field, minimum fill time and a
 *    per-client rate limit stored in Postgres.
 * 3. Saves the whole family atomically through submit_family_registration.
 *
 * Never logs request bodies: they contain children's personal information.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return errorResponse("invalid_payload");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse("invalid_payload");
  }

  const parsed = registrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = issuesToFieldErrors(parsed.error.issues);
    const registrationErrors = Object.fromEntries(
      Object.entries(fieldErrors)
        .filter(([path]) => path.startsWith("registration."))
        .map(([path, message]) => [path.slice("registration.".length), message]),
    );
    return errorResponse("invalid_payload", registrationErrors);
  }

  const { registration, idempotencyKey, formStartedAt, website } = parsed.data;

  if (website && website.trim() !== "") return errorResponse("invalid_payload");
  if (Date.now() - formStartedAt < MINIMUM_FORM_FILL_MS) return errorResponse("too_fast");

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    console.error("[register] Supabase server configuration is missing");
    return errorResponse("unexpected");
  }

  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "consume_registration_rate_limit",
    {
      p_key_hash: rateLimitKey(clientIpFromHeaders(request.headers)),
      p_limit: REGISTRATION_RATE_LIMIT.limit,
      p_window_seconds: REGISTRATION_RATE_LIMIT.windowSeconds,
    },
  );
  if (rateLimitError) {
    console.error("[register] rate limit check failed", rateLimitError.code);
    return errorResponse("unexpected");
  }
  if (!allowed) return errorResponse("rate_limited");

  const { data, error } = await supabase.rpc("submit_family_registration", {
    // The consent wording version is added by the server, not trusted from the client.
    p_payload: { ...registration, consentVersion: CONSENT_VERSION },
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const code = registrationErrorFromDatabase(error.message);
    if (code === "unexpected") {
      // Log only the Postgres error code, never the payload.
      console.error("[register] submission failed", error.code);
    }
    return errorResponse(code);
  }

  const result = registrationResultSchema.safeParse(data);
  if (!result.success) {
    console.error("[register] unexpected RPC response shape");
    return errorResponse("unexpected");
  }

  return NextResponse.json(result.data, { status: 201 });
}
