"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();
const age = z.coerce.number({ error: "Enter a number" }).int("Whole years only").min(2, "At least 2").max(25, "At most 25").optional();

const criteriaSchema = z
  .object({
    minAge: age,
    maxAge: age,
    gender: z.enum(["any", "male", "female"]),
    criteriaNote: z.string().trim().max(500, "Keep this under 500 characters").optional(),
  })
  .refine((value) => value.minAge === undefined || value.maxAge === undefined || value.minAge <= value.maxAge, {
    path: ["maxAge"],
    message: "Must be the same as or above the youngest age",
  });

/** Saves the age/gender placement guidance for one color group. */
export async function updateColorGroupCriteria(groupId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(criteriaSchema, formData);
  if (!parsed.ok) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("color_groups")
    .update({
      min_age: parsed.data.minAge ?? null,
      max_age: parsed.data.maxAge ?? null,
      gender: parsed.data.gender,
      criteria_note: parsed.data.criteriaNote ?? null,
    })
    .eq("id", id.parse(groupId))
    .select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  revalidatePath("/admin/color-groups", "layout");
  return success("Placement guidance saved.");
}

/** Removes one registration from its color group. */
export async function removeFromColorGroup(registrationId: number): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("color_group_assignments").delete().eq("registration_id", id.parse(registrationId)).select("registration_id");
  if (result.error) return failure(describeDbError(result.error));
  revalidatePath("/admin", "layout");
  return success("Removed from the color group.");
}
