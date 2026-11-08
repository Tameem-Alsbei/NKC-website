import {
  GENDERS,
  GRADES,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  type Gender,
  type Grade,
  type PaymentStatus,
  type RegistrationStatus,
} from "@/lib/registration/options";

/**
 * Filters for the students list and CSV exports, parsed from URL search
 * params. Unknown or malformed values are ignored rather than trusted.
 */
export type StudentFilters = {
  q: string;
  year: number | null;
  status: RegistrationStatus | null;
  payment: PaymentStatus | null;
  grade: Grade | null;
  gender: Gender | "unknown" | null;
  returning: "new" | "returning" | null;
  colorGroup: number | "none" | null;
  quranLevel: number | "none" | null;
  teacher: number | "none" | null;
  /** "unassigned": missing a color group, Quran level or teacher. "assigned": has all three. */
  assignment: "assigned" | "unassigned" | null;
  review: boolean;
  sort: "name" | "age" | "grade" | "registered" | "status" | "quran";
  dir: "asc" | "desc";
  page: number;
};

export const STUDENTS_PAGE_SIZE = 25;

const SORTS = ["name", "age", "grade", "registered", "status", "quran"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const positiveInt = (value: string | undefined): number | null => {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
};

const idOrNone = (value: string | undefined): number | "none" | null => (value === "none" ? "none" : positiveInt(value));

/** Newest registrations first; alphabetical/ascending for everything else. */
export function defaultSortDirection(sort: StudentFilters["sort"]): StudentFilters["dir"] {
  return sort === "registered" ? "desc" : "asc";
}

export function parseStudentFilters(params: SearchParams): StudentFilters {
  const gender = first(params.gender);
  const sort = oneOf(SORTS, first(params.sort)) ?? "registered";
  const dir = oneOf(["asc", "desc"] as const, first(params.dir)) ?? defaultSortDirection(sort);
  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    year: positiveInt(first(params.year)),
    status: oneOf(REGISTRATION_STATUSES, first(params.status)),
    payment: oneOf(PAYMENT_STATUSES, first(params.payment)),
    grade: oneOf(GRADES, first(params.grade)),
    gender: gender === "unknown" ? "unknown" : oneOf(GENDERS, gender),
    returning: oneOf(["new", "returning"] as const, first(params.returning)),
    colorGroup: idOrNone(first(params.colorGroup)),
    quranLevel: idOrNone(first(params.quranLevel)),
    teacher: idOrNone(first(params.teacher)),
    assignment: oneOf(["assigned", "unassigned"] as const, first(params.assignment)),
    review: first(params.review) === "1",
    sort,
    dir,
    page: positiveInt(first(params.page)) ?? 1,
  };
}

/** Serializes filters back to a query string, omitting defaults. */
export function studentFiltersToQuery(filters: Partial<StudentFilters>): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined || value === "" || value === false) return;
    params.set(key, value === true ? "1" : String(value));
  };
  set("q", filters.q);
  set("year", filters.year);
  set("status", filters.status);
  set("payment", filters.payment);
  set("grade", filters.grade);
  set("gender", filters.gender);
  set("returning", filters.returning);
  set("colorGroup", filters.colorGroup);
  set("quranLevel", filters.quranLevel);
  set("teacher", filters.teacher);
  set("assignment", filters.assignment);
  set("review", filters.review);
  const sort = filters.sort ?? "registered";
  if (sort !== "registered") set("sort", sort);
  if (filters.dir && filters.dir !== defaultSortDirection(sort)) set("dir", filters.dir);
  if (filters.page && filters.page > 1) set("page", filters.page);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Escapes LIKE wildcards so a search term is matched literally. */
export function escapeLikePattern(term: string): string {
  return term.toLowerCase().replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Minimal query-builder surface used by applyStudentFilters, so the same
 * logic serves the list page and the CSV exports (and can be unit tested).
 */
export interface FilterableQuery<Q> {
  eq(column: string, value: string | number | boolean): Q;
  is(column: string, value: null): Q;
  not(column: string, operator: "is", value: null): Q;
  ilike(column: string, pattern: string): Q;
  or(filters: string): Q;
}

function idFilter<Q extends FilterableQuery<Q>>(q: Q, column: string, value: number | "none" | null): Q {
  if (value === "none") return q.is(column, null);
  if (value !== null) return q.eq(column, value);
  return q;
}

export function applyStudentFilters<Q extends FilterableQuery<Q>>(query: Q, filters: StudentFilters, yearId: number): Q {
  let q = query.eq("school_year_id", yearId);
  if (filters.q) q = q.ilike("search_text", `%${escapeLikePattern(filters.q)}%`);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.payment) q = q.eq("payment_status", filters.payment);
  if (filters.grade) q = q.eq("grade", filters.grade);
  if (filters.gender === "unknown") q = q.is("gender", null);
  else if (filters.gender) q = q.eq("gender", filters.gender);
  if (filters.returning) q = q.eq("is_returning", filters.returning === "returning");
  q = idFilter(q, "color_group_id", filters.colorGroup);
  q = idFilter(q, "quran_level_id", filters.quranLevel);
  q = idFilter(q, "teacher_id", filters.teacher);
  if (filters.assignment === "unassigned") {
    q = q.eq("is_active", true).or("color_group_id.is.null,quran_level_id.is.null,teacher_id.is.null");
  } else if (filters.assignment === "assigned") {
    q = q.not("color_group_id", "is", null).not("quran_level_id", "is", null).not("teacher_id", "is", null);
  }
  if (filters.review) q = q.eq("needs_review", true);
  return q;
}

/** Columns to order by for each sort option (age sorts by date of birth, youngest last). */
export const SORT_COLUMNS: Record<StudentFilters["sort"], { column: string; invert?: boolean }[]> = {
  name: [{ column: "student_last_name" }, { column: "student_first_name" }],
  age: [{ column: "date_of_birth", invert: true }, { column: "student_last_name" }],
  grade: [{ column: "grade_rank" }, { column: "student_last_name" }],
  registered: [{ column: "registered_at" }],
  status: [{ column: "status" }, { column: "student_last_name" }],
  quran: [{ column: "quran_level_sort" }, { column: "teacher_name" }, { column: "student_last_name" }],
};

/** Applies SORT_COLUMNS to a query in the chosen direction. */
export function orderForSort(filters: StudentFilters): { column: string; ascending: boolean }[] {
  return SORT_COLUMNS[filters.sort].map(({ column, invert }) => {
    const ascending = filters.dir === "asc";
    return { column, ascending: invert ? !ascending : ascending };
  });
}
