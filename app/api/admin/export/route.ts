import { NextResponse, type NextRequest } from "next/server";
import { resolveSchoolYear } from "@/lib/admin/data";
import { applyStudentFilters, parseStudentFilters, SORT_COLUMNS } from "@/lib/admin/student-filters";
import { getAuthorizedAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { ageFromDateOfBirth, labelFor } from "@/lib/format";
import {
  ARABIC_LEVEL_LABELS,
  GRADE_LABELS,
  PAYMENT_STATUS_LABELS,
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
  "Grade",
  "Arabic level",
  "Studied Arabic before",
  "New or returning",
  "Registration status",
  "Needs review",
  "Payment status",
  "Amount due",
  "Amount paid",
  "Group",
  "Guardian name",
  "Guardian email",
  "Guardian phone",
  "Registered on",
] as const;

/**
 * CSV export of the filtered students list (same filters as /admin/students).
 * Deliberately excludes health / special-consideration notes; those are never
 * part of a routine export.
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
        "reference_code, school_year, student_last_name, student_first_name, date_of_birth, grade, arabic_level, studied_arabic_before, is_returning, status, needs_review, payment_status, amount_due, amount_paid, group_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone, registered_at",
      ),
    filters,
    year.id,
  );
  for (const column of SORT_COLUMNS[filters.sort]) {
    query = query.order(column, { ascending: filters.dir === "asc", nullsFirst: false });
  }

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
    labelFor(GRADE_LABELS, row.grade),
    row.arabic_level ? labelFor(ARABIC_LEVEL_LABELS, row.arabic_level) : "",
    row.studied_arabic_before === null ? "" : row.studied_arabic_before ? "Yes" : "No",
    row.is_returning ? "Returning" : "New",
    labelFor(REGISTRATION_STATUS_LABELS, row.status),
    row.needs_review ? "Yes" : "No",
    labelFor(PAYMENT_STATUS_LABELS, row.payment_status),
    row.amount_due ?? "",
    row.amount_paid,
    row.group_name ?? "",
    [row.guardian_first_name, row.guardian_last_name].filter(Boolean).join(" "),
    row.guardian_email ?? "",
    row.guardian_phone ?? "",
    row.registered_at.slice(0, 10),
  ]);

  const filename = `students-${year.label}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(toCsv(HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
