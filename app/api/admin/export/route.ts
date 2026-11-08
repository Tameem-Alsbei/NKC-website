import { NextResponse, type NextRequest } from "next/server";
import { resolveSchoolYear } from "@/lib/admin/data";
import { applyStudentFilters, orderForSort, parseStudentFilters } from "@/lib/admin/student-filters";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { ageFromDateOfBirth, labelFor } from "@/lib/format";
import {
  formatQuranLevel,
  GENDER_LABELS,
  GRADE_LABELS,
  PAYMENT_STATUS_LABELS,
  QURAN_ABILITY_LABELS,
  REGISTRATION_STATUS_LABELS,
} from "@/lib/registration/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_EXPORT_ROWS = 5000;

const HEADERS = [
  "Reference",
  "School year",
  "Student last name",
  "Student first name",
  "Date of birth",
  "Age",
  "Boy/girl",
  "School grade",
  "New or returning",
  "Color group",
  "Quran level",
  "Quran teacher",
  "Parent-reported Quran reading",
  "Registration status",
  "Needs review",
  "Payment status",
  "Amount due",
  "Amount paid",
  "Guardian name",
  "Guardian email",
  "Guardian phone",
  "Registered on",
] as const;

/**
 * CSV export of the filtered students list (same filters as /admin/students),
 * also used for color-group and teacher rosters. Health and special-
 * consideration notes are never part of an export.
 */
export async function GET(request: NextRequest) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const filters = parseStudentFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { year } = await resolveSchoolYear(filters.year);
  if (!year) return NextResponse.json({ error: "No school year found." }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  let query = applyStudentFilters(
    supabase
      .from("admin_registration_list")
      .select(
        "reference_code, school_year, student_last_name, student_first_name, date_of_birth, gender, grade, is_returning, color_group_name, quran_level_id, quran_level_name, teacher_name, reported_quran_ability, status, needs_review, payment_status, amount_due, amount_paid, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, registered_at",
      ),
    filters,
    year.id,
  );
  for (const { column, ascending } of orderForSort(filters)) query = query.order(column, { ascending, nullsFirst: false });

  const { data, error } = await query.limit(MAX_EXPORT_ROWS);
  if (error) {
    console.error("[export] query failed", error.code);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }

  const rows = data.map((row) => [
    row.reference_code,
    row.school_year,
    row.student_last_name,
    row.student_first_name,
    row.date_of_birth,
    ageFromDateOfBirth(row.date_of_birth),
    row.gender ? labelFor(GENDER_LABELS, row.gender) : "",
    labelFor(GRADE_LABELS, row.grade),
    row.is_returning ? "Returning" : "New",
    row.color_group_name ?? "",
    row.quran_level_id ? formatQuranLevel(row.quran_level_id, row.quran_level_name) : "",
    row.teacher_name ?? "",
    row.reported_quran_ability ? labelFor(QURAN_ABILITY_LABELS, row.reported_quran_ability) : "",
    labelFor(REGISTRATION_STATUS_LABELS, row.status),
    row.needs_review ? "Yes" : "No",
    labelFor(PAYMENT_STATUS_LABELS, row.payment_status),
    row.amount_due ?? "",
    row.amount_paid,
    [row.guardian_first_name, row.guardian_last_name].filter(Boolean).join(" "),
    row.guardian_email ?? "",
    row.guardian_phone ?? "",
    row.registered_at.slice(0, 10),
  ]);

  const filename = `noor-kids-club-students-${year.label}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(toCsv(HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
