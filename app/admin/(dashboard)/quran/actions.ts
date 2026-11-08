"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { QURAN_LEVELS } from "@/lib/registration/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();
const LEVEL_IDS = QURAN_LEVELS.map((level) => level.id) as number[];

const teacherSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the teacher's name").max(120, "Too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional(),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters").optional(),
  isActive: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

function selectedLevels(formData: FormData): number[] {
  return [...new Set(formData.getAll("levelId").map(Number))].filter((level) => LEVEL_IDS.includes(level));
}

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function createTeacher(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(teacherSchema, formData);
  if (!parsed.ok) return parsed.error;
  const levels = selectedLevels(formData);

  const supabase = await createSupabaseServerClient();
  const teacher = await supabase
    .from("teachers")
    .insert({ full_name: parsed.data.fullName, email: parsed.data.email ?? null, notes: parsed.data.notes ?? null, is_active: true })
    .select("id")
    .single();
  if (teacher.error) return failure(describeDbError(teacher.error));

  if (levels.length > 0) {
    const links = await supabase
      .from("teacher_quran_levels")
      .insert(levels.map((level) => ({ teacher_id: teacher.data.id, quran_level_id: level })));
    if (links.error) return failure(`The teacher was added, but their levels could not be saved. ${describeDbError(links.error)}`);
  }

  refresh();
  return success(`${parsed.data.fullName} was added.`);
}

/**
 * Updates a teacher and the levels they teach. A level that was never used is
 * unlinked; a level with assignment history is deactivated instead, so past
 * rosters stay intact.
 */
export async function updateTeacher(teacherId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(teacherSchema, formData);
  if (!parsed.ok) return parsed.error;
  const teacher = id.parse(teacherId);
  const levels = selectedLevels(formData);

  const supabase = await createSupabaseServerClient();
  const update = await supabase
    .from("teachers")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
      is_active: parsed.data.isActive,
    })
    .eq("id", teacher)
    .select("id");
  if (update.error || update.data.length === 0) return failure(describeDbError(update.error));

  const existing = await supabase.from("teacher_quran_levels").select("quran_level_id, is_active").eq("teacher_id", teacher);
  if (existing.error) return failure(describeDbError(existing.error));

  if (levels.length > 0) {
    const upsert = await supabase
      .from("teacher_quran_levels")
      .upsert(levels.map((level) => ({ teacher_id: teacher, quran_level_id: level, is_active: true })), { onConflict: "teacher_id,quran_level_id" });
    if (upsert.error) return failure(describeDbError(upsert.error));
  }

  for (const link of existing.data.filter((row) => row.is_active && !levels.includes(row.quran_level_id))) {
    const removed = await supabase.from("teacher_quran_levels").delete().eq("teacher_id", teacher).eq("quran_level_id", link.quran_level_id);
    if (removed.error?.code === "23503") {
      const deactivated = await supabase
        .from("teacher_quran_levels")
        .update({ is_active: false })
        .eq("teacher_id", teacher)
        .eq("quran_level_id", link.quran_level_id);
      if (deactivated.error) return failure(describeDbError(deactivated.error));
    } else if (removed.error) {
      return failure(describeDbError(removed.error));
    }
  }

  refresh();
  return success("Teacher saved.");
}

