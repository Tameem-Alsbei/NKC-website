import "server-only";
import { cache } from "react";
import type { TableRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read helpers for admin pages. All queries use the signed-in user's session,
 * so Row Level Security applies even if a page forgot to check access.
 */

export type SchoolYear = Pick<TableRow<"school_years">, "id" | "label" | "is_current" | "registration_open" | "default_amount_due">;

export const getSchoolYears = cache(async (): Promise<SchoolYear[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_years")
    .select("id, label, is_current, registration_open, default_amount_due")
    .order("label", { ascending: false });
  if (error) throw new Error("Could not load school years");
  return data;
});

/** The requested year if it exists, otherwise the current one (or the newest). */
export async function resolveSchoolYear(requestedId: number | null): Promise<{ years: SchoolYear[]; year: SchoolYear | null }> {
  const years = await getSchoolYears();
  const year =
    (requestedId ? years.find((y) => y.id === requestedId) : undefined) ??
    years.find((y) => y.is_current) ??
    years[0] ??
    null;
  return { years, year };
}

/** Map of auth user id -> admin display name, for "changed by" labels. */
export const getAdminNames = cache(async (): Promise<Map<string, string>> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("admin_profiles").select("user_id, full_name");
  return new Map((data ?? []).map((row) => [row.user_id, row.full_name]));
});

export type GroupOption = { id: number; name: string; capacity: number; enrolled: number; schoolYearId: number };

export async function getGroupOptions(schoolYearIds: number[]): Promise<GroupOption[]> {
  if (schoolYearIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_group_overview")
    .select("id, name, capacity, enrolled_count, school_year_id")
    .in("school_year_id", schoolYearIds)
    .order("name");
  if (error) throw new Error("Could not load groups");
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    capacity: g.capacity,
    enrolled: g.enrolled_count,
    schoolYearId: g.school_year_id,
  }));
}
