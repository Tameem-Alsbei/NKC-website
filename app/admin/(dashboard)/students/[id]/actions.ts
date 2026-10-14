"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  describeDbError,
  failure,
  NOT_AUTHORIZED,
  parseForm,
  success,
  type ActionResult,
} from "@/lib/admin/actions";
import { canManageSensitiveRecords, canViewHealthNotes } from "@/lib/auth/access";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import {
  ARABIC_LEVELS,
  GRADES,
  PAYMENT_METHODS,
  REGISTRATION_STATUSES,
  SPECIAL_CONSIDERATIONS_MAX_LENGTH,
} from "@/lib/registration/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Every action re-checks administrator access (actions can be called with a
 * direct POST), validates its input, and writes through the signed-in user's
 * session so Row Level Security and the audit-log triggers apply.
 */

const id = z.coerce.number().int().positive();
const name = z.string().trim().min(1, "Required").max(80, "Too long");
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true" || value === "1");
const money = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return null;
    const amount = Number(value.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0 || amount >= 100000) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 150 or 150.00" });
      return z.NEVER;
    }
    return Math.round(amount * 100) / 100;
  });

function refresh(studentId: number) {
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/students");
  revalidatePath("/admin");
}

const profileSchema = z.object({
  firstName: name,
  lastName: name,
  dateOfBirth: z.iso.date("Enter a valid date"),
  grade: z.enum(GRADES, "Choose a grade"),
  arabicLevel: z.enum(ARABIC_LEVELS).optional(),
  studiedArabicBefore: z.enum(["yes", "no"]).optional(),
});

export async function updateStudentProfile(studentId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("students")
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      grade: data.grade,
      arabic_level: data.arabicLevel ?? null,
      studied_arabic_before: data.studiedArabicBefore ? data.studiedArabicBefore === "yes" : null,
    })
    .eq("id", id.parse(studentId))
    .select("id");

  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Student profile saved.");
}

const registrationSchema = z.object({
  status: z.enum(REGISTRATION_STATUSES, "Choose a status"),
  grade: z.enum(GRADES, "Choose a grade"),
  isReturning: z.enum(["yes", "no"]),
  markReviewed: checkbox,
});

export async function updateRegistration(
  studentId: number,
  registrationId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(registrationSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("registrations")
    .update({
      status: data.status,
      grade: data.grade,
      is_returning: data.isReturning === "yes",
      ...(data.markReviewed ? { needs_review: false } : {}),
    })
    .eq("id", id.parse(registrationId))
    .eq("student_id", id.parse(studentId))
    .select("id");

  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Registration updated.");
}

const groupSchema = z.object({ groupId: id.optional() });

export async function assignGroup(
  studentId: number,
  registrationId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(groupSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const registration = id.parse(registrationId);

  if (!data.groupId) {
    const result = await supabase.from("student_group_assignments").delete().eq("registration_id", registration);
    if (result.error) return failure(describeDbError(result.error));
    refresh(studentId);
    return success("Student removed from their group.");
  }

  const result = await supabase
    .from("student_group_assignments")
    .upsert({ registration_id: registration, group_id: data.groupId }, { onConflict: "registration_id" })
    .select("registration_id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  revalidatePath(`/admin/groups/${data.groupId}`);
  return success("Group assignment saved.");
}

const paymentSettingsSchema = z.object({
  amountDue: money,
  waived: checkbox,
  paymentNote: z.string().trim().max(1000, "Too long").optional(),
});

export async function updatePaymentSettings(
  studentId: number,
  registrationId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(paymentSettingsSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("registrations")
    .update({
      amount_due: data.amountDue,
      // Anything other than 'waived' is recalculated from the payment ledger by the database.
      payment_status: data.waived ? "waived" : "not_paid",
      payment_note: data.paymentNote ?? null,
    })
    .eq("id", id.parse(registrationId))
    .eq("student_id", id.parse(studentId))
    .select("id");

  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Payment details saved.");
}

const paymentSchema = z.object({
  amount: money.refine((value) => value !== null && value > 0, "Enter the amount received"),
  paymentMethod: z.enum(PAYMENT_METHODS, "Choose a payment method"),
  paidOn: z.iso.date("Enter a valid date"),
  receiptReference: z.string().trim().max(80, "Too long").optional(),
  note: z.string().trim().max(1000, "Too long").optional(),
});

export async function recordPayment(
  studentId: number,
  registrationId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const parsed = parseForm(paymentSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("payments")
    .insert({
      registration_id: id.parse(registrationId),
      amount: data.amount as number,
      payment_method: data.paymentMethod,
      paid_at: `${data.paidOn}T12:00:00Z`,
      receipt_reference: data.receiptReference ?? null,
      note: data.note ?? null,
    })
    .select("id");

  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Payment recorded.");
}

export async function deletePayment(studentId: number, paymentId: number): Promise<ActionResult> {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NOT_AUTHORIZED;
  if (!canManageSensitiveRecords(admin)) return failure("Only full administrators can delete payments.");

  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("payments").delete().eq("id", id.parse(paymentId)).select("id");
  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Payment deleted.");
}

const healthSchema = z.object({
  specialConsiderations: z
    .string()
    .trim()
    .max(SPECIAL_CONSIDERATIONS_MAX_LENGTH, `Keep this under ${SPECIAL_CONSIDERATIONS_MAX_LENGTH} characters`)
    .optional(),
});

export async function saveHealthNote(studentId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NOT_AUTHORIZED;
  if (!canViewHealthNotes(admin)) return failure("Only full administrators can edit health information.");
  const parsed = parseForm(healthSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const student = id.parse(studentId);
  const result = data.specialConsiderations
    ? await supabase
        .from("student_health_notes")
        .upsert({ student_id: student, special_considerations: data.specialConsiderations }, { onConflict: "student_id" })
    : await supabase.from("student_health_notes").delete().eq("student_id", student);

  if (result.error) return failure(describeDbError(result.error));
  refresh(studentId);
  return success(data.specialConsiderations ? "Special considerations saved." : "Special considerations cleared.");
}

const noteSchema = z.object({
  body: z.string().trim().min(1, "Write a note first").max(4000, "Keep notes under 4,000 characters"),
  registrationId: id.optional(),
});

export async function addAdminNote(studentId: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NOT_AUTHORIZED;
  const parsed = parseForm(noteSchema, formData);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("admin_notes")
    .insert({
      student_id: id.parse(studentId),
      registration_id: data.registrationId ?? null,
      body: data.body,
      author_id: admin.userId,
    })
    .select("id");

  if (result.error || result.data.length === 0) return failure(describeDbError(result.error));
  refresh(studentId);
  return success("Note added.");
}

export async function deleteAdminNote(studentId: number, noteId: number): Promise<ActionResult> {
  if (!(await getAuthorizedAdmin())) return NOT_AUTHORIZED;
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("admin_notes").delete().eq("id", id.parse(noteId)).select("id");
  if (result.error) return failure(describeDbError(result.error));
  if (result.data.length === 0) return failure("You can only delete notes you wrote.");
  refresh(studentId);
  return success("Note deleted.");
}
