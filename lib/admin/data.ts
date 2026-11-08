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

export type ColorGroup = Pick<
  TableRow<"color_groups">,
  "id" | "slug" | "name" | "color_hex" | "text_color_hex" | "min_age" | "max_age" | "gender" | "criteria_note" | "is_active"
>;

export const getColorGroups = cache(async (): Promise<ColorGroup[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("color_groups")
    .select("id, slug, name, color_hex, text_color_hex, min_age, max_age, gender, criteria_note, is_active")
    .order("sort_order");
  if (error) throw new Error("Could not load color groups");
  return data;
});

export type QuranLevel = { id: number; name: string };

export const getQuranLevels = cache(async (): Promise<QuranLevel[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quran_levels").select("id, name").order("sort_order");
  if (error) throw new Error("Could not load Quran levels");
  return data;
});

export type TeacherWithLevels = {
  id: number;
  name: string;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  /** Levels this teacher currently teaches (active links only). */
  levelIds: number[];
  /** Every level ever linked, including inactive links that still hold history. */
  allLevelIds: number[];
};

export const getTeachers = cache(async (): Promise<TeacherWithLevels[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, email, notes, is_active, teacher_quran_levels(quran_level_id, is_active)")
    .order("full_name");
  if (error) throw new Error("Could not load teachers");
  return data.map((teacher) => ({
    id: teacher.id,
    name: teacher.full_name,
    email: teacher.email,
    notes: teacher.notes,
    isActive: teacher.is_active,
    levelIds: teacher.teacher_quran_levels.filter((link) => link.is_active).map((link) => link.quran_level_id),
    allLevelIds: teacher.teacher_quran_levels.map((link) => link.quran_level_id),
  }));
});
