"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, failure, NOT_AUTHORIZED, parseForm, success, type ActionResult } from "@/lib/admin/actions";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { RELATIONSHIPS } from "@/lib/registration/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();
const name = z.string().trim().min(1, "Required").max(80, "Too long");
const optionalEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")).optional();
const optionalPhone = z
  .string()
  .trim()
  .max(25, "Too long")
  .regex(/^[0-9+().\-\s]+$/, "Use digits and + ( ) - only")
  .optional();

function refresh(householdId: number) {
  revalidatePath(`/admin/families/${householdId}`);
  revalidatePath("/admin/families");
  revalidatePath("/admin/students", "layout");
}

const householdSchema = z.object({
  displayName: z.string().trim().min(1, "Required").max(120, "Too long"),
  emergencyName: z.string().trim().max(120, "Too long").optional(),
  emergencyPhone: optionalPhone,
  emergencyRelationship: z.string().trim().max(60, "Too long").optional(),
});

export async function updateHousehold(householdId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(householdSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("households")
    .update({
      display_name: data.displayName,
      emergency_contact_name: data.emergencyName ?? null,
      emergency_contact_phone: data.emergencyPhone ?? null,
      emergency_contact_relationship: data.emergencyRelationship ?? null,
    })
    .eq("id", id.parse(householdId))
    .select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(householdId);
  return success("Family details saved.");
}

const guardianSchema = z.object({
  firstName: name,
  lastName: name,
  email: optionalEmail,
  phone: optionalPhone,
});

export async function updateGuardian(
  householdId: number,
  parentId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(guardianSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("parents")
    .update({ first_name: data.firstName, last_name: data.lastName, email: data.email ?? null, phone: data.phone ?? null })
    .eq("id", id.parse(parentId))
    .select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(householdId);
  return success("Guardian contact details saved.");
}

const newGuardianSchema = guardianSchema.extend({
  relationship: z.enum(RELATIONSHIPS, "Choose a relationship"),
});

export async function addGuardian(householdId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(newGuardianSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  // Creates the guardian and links them to every child in the family in one transaction.
  const result = await supabase.rpc("admin_add_guardian", {
    p_household_id: id.parse(householdId),
    p_first_name: data.firstName,
    p_last_name: data.lastName,
    p_email: data.email ?? null,
    p_phone: data.phone ?? null,
    p_relationship: data.relationship,
  });
  if (result.error) return failure(describeDbError(result.error));
  refresh(householdId);
  return success("Guardian added and linked to all children in this family.");
}

export async function makePrimaryContact(householdId: number, parentId: number): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const supabase = await createSupabaseServerClient();

  const { data: students, error } = await supabase.from("students").select("id").eq("household_id", id.parse(householdId));
  if (error) return failure(describeDbError(error));
  const studentIds = students.map((s) => s.id);
  if (studentIds.length === 0) return failure("This family has no children linked yet.");

  const clear = await supabase
    .from("student_parents")
    .update({ is_primary_contact: false })
    .in("student_id", studentIds)
    .neq("parent_id", id.parse(parentId));
  if (clear.error) return failure(describeDbError(clear.error));

  const set = await supabase
    .from("student_parents")
    .update({ is_primary_contact: true })
    .in("student_id", studentIds)
    .eq("parent_id", id.parse(parentId))
    .select("student_id");
  if (set.error || set.data.length === 0) return failure(describeDbError(set.error, "This guardian isn't linked to the family's children."));

  refresh(householdId);
  return success("Primary contact updated.");
}

export async function unlinkGuardian(householdId: number, parentId: number): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const supabase = await createSupabaseServerClient();
  const parent = id.parse(parentId);

  const { data: students, error } = await supabase.from("students").select("id").eq("household_id", id.parse(householdId));
  if (error) return failure(describeDbError(error));
  const studentIds = students.map((s) => s.id);

  // Never leave a child without any guardian.
  const { data: links, error: linksError } = await supabase
    .from("student_parents")
    .select("student_id, parent_id")
    .in("student_id", studentIds.length ? studentIds : [-1]);
  if (linksError) return failure(describeDbError(linksError));
  const orphaned = studentIds.some(
    (studentId) => !links.some((link) => link.student_id === studentId && link.parent_id !== parent),
  );
  if (orphaned) return failure("Every child needs at least one guardian. Add another guardian before removing this one.");

  const result = await supabase.from("student_parents").delete().eq("parent_id", parent).in("student_id", studentIds);
  if (result.error) return failure(describeDbError(result.error));

  // The guardian record itself is kept (history and audit refer to it); it is only detached from this family.
  await supabase.from("parents").update({ household_id: null }).eq("id", parent).eq("household_id", id.parse(householdId));

  refresh(householdId);
  return success("Guardian removed from this family.");
}
