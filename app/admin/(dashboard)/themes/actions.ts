"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { canManageSensitiveRecords } from "@/lib/auth/access";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();

const themeSchema = z
  .object({
    name: z.string().trim().max(80, "Keep the name under 80 characters").optional(),
    mainValue: z.string().trim().max(120, "Keep this under 120 characters").optional(),
    description: z.string().trim().max(600, "Keep this under 600 characters").optional(),
    colorHex: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^#[0-9a-f]{6}$/, "Use a color like #1f5aa6")
      .optional(),
    startsOn: z.iso.date("Enter a valid date").optional(),
    endsOn: z.iso.date("Enter a valid date").optional(),
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn, {
    path: ["endsOn"],
    message: "Must be on or after the start date",
  });

function refresh() {
  revalidatePath("/admin/themes");
  revalidatePath("/");
}

async function requireFullAdmin(): Promise<ActionResult | null> {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NOT_AUTHORIZED;
  if (!canManageSensitiveRecords(admin)) return failure("Only full administrators can change themes.");
  return null;
}

export async function saveTheme(themeId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await requireFullAdmin();
  if (denied) return denied;
  const parsed = parseForm(themeSchema, formData);
  if (!parsed.ok) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("program_themes")
    .update({
      name: parsed.data.name ?? null,
      main_value: parsed.data.mainValue ?? null,
      description: parsed.data.description ?? null,
      color_hex: parsed.data.colorHex ?? null,
      starts_on: parsed.data.startsOn ?? null,
      ends_on: parsed.data.endsOn ?? null,
    })
    .eq("id", id.parse(themeId))
    .select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh();
  return success("Theme saved.");
}

/** Makes one theme active (or, with null, hides the theme section entirely). */
export async function setActiveTheme(themeId: number | null): Promise<ActionResult> {
  const denied = await requireFullAdmin();
  if (denied) return denied;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_active_theme", { p_theme_id: themeId === null ? null : id.parse(themeId) });
  if (error) return failure(describeDbError(error));
  refresh();
  return success(themeId === null ? "No theme is active." : "Theme is now active.");
}
