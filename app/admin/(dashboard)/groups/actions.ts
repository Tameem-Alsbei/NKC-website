"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { canManageSensitiveRecords } from "@/lib/auth/access";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { ARABIC_LEVELS, GRADES } from "@/lib/registration/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();

const groupSchema = z
  .object({
    schoolYearId: id,
    name: z.string().trim().min(1, "Give the group a name").max(80, "Too long"),
    minimumGrade: z.enum(GRADES).optional(),
    maximumGrade: z.enum(GRADES).optional(),
    arabicLevel: z.enum(ARABIC_LEVELS).optional(),
    teacherName: z.string().trim().max(120, "Too long").optional(),
    capacity: z.coerce.number({ error: "Enter a number" }).int("Enter a whole number").min(1, "At least 1").max(500, "At most 500"),
    notes: z.string().trim().max(2000, "Too long").optional(),
  })
  .refine(
    (group) =>
      !group.minimumGrade || !group.maximumGrade || GRADES.indexOf(group.minimumGrade) <= GRADES.indexOf(group.maximumGrade),
    { path: ["maximumGrade"], message: "Must be the same as or higher than the lowest grade" },
  );

function toRow(data: z.output<typeof groupSchema>) {
  return {
    school_year_id: data.schoolYearId,
    name: data.name,
    minimum_grade: data.minimumGrade ?? null,
    maximum_grade: data.maximumGrade ?? null,
    arabic_level: data.arabicLevel ?? null,
    teacher_name: data.teacherName ?? null,
    capacity: data.capacity,
    notes: data.notes ?? null,
  };
}

export async function createGroup(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(groupSchema, formData);
  if (!parsed.ok) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("groups").insert(toRow(parsed.data)).select("id").single();
  if (result.error) return failure(describeDbError(result.error));
  revalidatePath("/admin/groups");
  return success(`Group “${parsed.data.name}” created.`);
}

export async function updateGroup(groupId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(groupSchema, formData);
  if (!parsed.ok) return parsed.error;

  const supabase = await createSupabaseServerClient();
  const { data: enrolled } = await supabase
    .from("admin_group_overview")
    .select("enrolled_count")
    .eq("id", id.parse(groupId))
    .maybeSingle();
  if (enrolled && parsed.data.capacity < enrolled.enrolled_count) {
    return failure("Capacity can't be lower than the number of students already in the group.", {
      capacity: `${enrolled.enrolled_count} students are already enrolled`,
    });
  }

  const result = await supabase.from("groups").update(toRow(parsed.data)).eq("id", id.parse(groupId)).select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  revalidatePath(`/admin/groups/${groupId}`);
  revalidatePath("/admin/groups");
  return success("Group saved.");
}

export async function deleteGroup(groupId: number): Promise<ActionResult> {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NOT_AUTHORIZED;
  if (!canManageSensitiveRecords(admin)) return failure("Only full administrators can delete groups.");

  const supabase = await createSupabaseServerClient();
  // Fails with a foreign-key error (shown as a friendly message) if students are still assigned.
  const result = await supabase.from("groups").delete().eq("id", id.parse(groupId)).select("id");
  if (result.error) return failure(describeDbError(result.error));
  if (result.data.length === 0) return failure("The group could not be deleted.");
  revalidatePath("/admin/groups");
  redirect("/admin/groups");
}

export async function addStudentsToGroup(groupId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const ids = z.array(id).min(1).max(200).safeParse(formData.getAll("registrationId"));
  if (!ids.success) return failure("Select at least one student to add.");

  const supabase = await createSupabaseServerClient();
  // One statement, so either every selected student is placed or none are
  // (e.g. if the group would go over capacity).
  const result = await supabase
    .from("student_group_assignments")
    .upsert(
      ids.data.map((registrationId) => ({ registration_id: registrationId, group_id: id.parse(groupId) })),
      { onConflict: "registration_id" },
    )
    .select("registration_id");
  if (result.error) return failure(describeDbError(result.error));
  revalidatePath(`/admin/groups/${groupId}`);
  revalidatePath("/admin/groups");
  return success(`${result.data.length} student${result.data.length === 1 ? "" : "s"} added to the group.`);
}

export async function removeFromGroup(groupId: number, registrationId: number): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("student_group_assignments")
    .delete()
    .eq("registration_id", id.parse(registrationId))
    .eq("group_id", id.parse(groupId))
    .select("registration_id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  revalidatePath(`/admin/groups/${groupId}`);
  revalidatePath("/admin/groups");
  return success("Student removed from the group.");
}
