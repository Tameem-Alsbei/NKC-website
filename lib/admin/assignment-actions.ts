"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Color-group and Quran assignments, shared by the student page, the color
 * group pages and the Quran pages. Every action re-checks admin access and
 * writes with the signed-in user's session, so RLS and audit triggers apply.
 * The database enforces the rules (active registration, matching teacher
 * level, one active Quran assignment per student and year).
 */

const id = z.coerce.number().int().positive();
const idList = z.array(id).min(1, "Select at least one student").max(200, "Select at most 200 students at a time");

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

const colorSchema = z.object({ colorGroupId: id.optional() });

/** Assigns, moves or (with an empty value) removes one registration's color group. */
export async function setColorGroup(registrationId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(colorSchema, formData);
  if (!parsed.ok) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const registration = id.parse(registrationId);
  const result = parsed.data.colorGroupId
    ? await supabase
        .from("color_group_assignments")
        .upsert({ registration_id: registration, color_group_id: parsed.data.colorGroupId }, { onConflict: "registration_id" })
        .select("registration_id")
    : await supabase.from("color_group_assignments").delete().eq("registration_id", registration).select("registration_id");

  if (result.error) return failure(describeDbError(result.error));
  refreshAdmin();
  return success(parsed.data.colorGroupId ? "Color group saved." : "Removed from color group.");
}

/** Places several registrations in the same color group in one statement. */
export async function bulkSetColorGroup(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const ids = idList.safeParse(formData.getAll("registrationId"));
  if (!ids.success) return failure(ids.error.issues[0]?.message ?? "Select at least one student.");
  const group = id.safeParse(formData.get("colorGroupId"));
  if (!group.success) return failure("Choose a color group.", { colorGroupId: "Choose a color group" });

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("color_group_assignments")
    .upsert(
      ids.data.map((registrationId) => ({ registration_id: registrationId, color_group_id: group.data })),
      { onConflict: "registration_id" },
    )
    .select("registration_id");
  if (result.error) return failure(describeDbError(result.error));
  refreshAdmin();
  return success(`${result.data.length} student${result.data.length === 1 ? "" : "s"} placed.`);
}

const quranSchema = z.object({
  quranLevelId: z.coerce.number().int().min(1).max(20).optional(),
  teacherId: id.optional(),
  note: z.string().trim().max(1000, "Keep notes under 1,000 characters").optional(),
});

/**
 * Sets a student's Quran level and teacher for a school year. If the student
 * already has an assignment, it is closed and kept as history.
 */
export async function setQuranAssignment(
  studentId: number,
  schoolYearId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(quranSchema, formData);
  if (!parsed.ok) return parsed.error;
  const { quranLevelId, teacherId, note } = parsed.data;
  if (teacherId && !quranLevelId) {
    return failure("Choose a Quran level before choosing a teacher.", { quranLevelId: "Choose a level" });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_quran_assignment", {
    p_student_id: id.parse(studentId),
    p_school_year_id: id.parse(schoolYearId),
    p_quran_level_id: quranLevelId ?? null,
    p_teacher_id: teacherId ?? null,
    p_note: note ?? null,
  });
  if (error) return failure(describeDbError(error));
  refreshAdmin();
  return success(quranLevelId ? "Quran assignment saved." : "Quran assignment ended.");
}

/** Assigns several students to the same Quran level (and optional teacher). */
export async function bulkSetQuranAssignment(schoolYearId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const ids = idList.safeParse(formData.getAll("studentId"));
  if (!ids.success) return failure(ids.error.issues[0]?.message ?? "Select at least one student.");
  const parsed = parseForm(quranSchema, formData);
  if (!parsed.ok) return parsed.error;
  if (!parsed.data.quranLevelId) return failure("Choose a Quran level.", { quranLevelId: "Choose a level" });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_bulk_set_quran_assignment", {
    p_student_ids: ids.data,
    p_school_year_id: id.parse(schoolYearId),
    p_quran_level_id: parsed.data.quranLevelId,
    p_teacher_id: parsed.data.teacherId ?? null,
  });
  if (error) return failure(describeDbError(error));
  refreshAdmin();
  return success(`${data ?? ids.data.length} student${ids.data.length === 1 ? "" : "s"} assigned.`);
}
