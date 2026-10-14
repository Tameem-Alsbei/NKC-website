import type { z } from "zod";
import { issuesToFieldErrors } from "@/lib/registration/schema";

/**
 * Conventions shared by every admin Server Action:
 *   - return an ActionResult (never throw raw database errors to the client)
 *   - validate FormData with zod
 *   - translate database errors into plain-language messages
 */
export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every result so forms can react to repeated identical results. */
  at?: number;
} | null;

export const NOT_AUTHORIZED: ActionResult = {
  ok: false,
  message: "Your session has ended or you don't have permission for this. Please sign in again.",
};

export function success(message: string): ActionResult {
  return { ok: true, message, at: Date.now() };
}

export function failure(message: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, message, fieldErrors, at: Date.now() };
}

/** Reads FormData into a plain object; empty strings become undefined. */
export function formDataToObject(formData: FormData): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value === "string") result[key] = value.trim() === "" ? undefined : value;
  }
  return result;
}

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.output<S> } | { ok: false; error: ActionResult } {
  const parsed = schema.safeParse(formDataToObject(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    error: failure("Please check the highlighted fields.", issuesToFieldErrors(parsed.error.issues)),
  };
}

type DbError = { code?: string; message?: string } | null;

/** Plain-language message for a PostgREST/Postgres error. Never echoes raw SQL errors. */
export function describeDbError(error: DbError, fallback = "The change could not be saved. Please try again."): string {
  if (!error) return fallback;
  const message = error.message ?? "";
  if (message.includes("group_full")) return "That group is already at capacity. Increase its capacity or choose another group.";
  if (message.includes("group_year_mismatch")) return "That group belongs to a different school year.";
  if (message.includes("parents_email_normalized_key")) return "Another guardian already uses that email address.";
  if (message.includes("groups_school_year_name_key")) return "A group with that name already exists for this school year.";
  if (error.code === "23503") return "This record is still in use and can't be removed.";
  if (error.code === "23514") return "One of the values isn't allowed. Please check the form.";
  if (error.code === "42501") return "You don't have permission to make this change.";
  return fallback;
}
