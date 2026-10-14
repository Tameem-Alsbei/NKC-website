import {
  ARABIC_LEVELS,
  GRADES,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  type ArabicLevel,
  type Grade,
  type PaymentStatus,
  type RegistrationStatus,
} from "@/lib/registration/options";

/**
 * Filters for the students list and CSV export, parsed from URL search
 * params. Unknown or malformed values are ignored rather than trusted.
 */
export type StudentFilters = {
  q: string;
  year: number | null;
  status: RegistrationStatus | null;
  payment: PaymentStatus | null;
  grade: Grade | null;
  level: ArabicLevel | "unknown" | null;
  returning: "new" | "returning" | null;
  group: number | "none" | null;
  review: boolean;
  sort: "name" | "grade" | "registered" | "status";
  dir: "asc" | "desc";
  page: number;
};

export const STUDENTS_PAGE_SIZE = 25;

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

/** Newest registrations first; alphabetical/ascending for everything else. */
export function defaultSortDirection(sort: StudentFilters["sort"]): StudentFilters["dir"] {
  return sort === "registered" ? "desc" : "asc";
}

export function parseStudentFilters(params: SearchParams): StudentFilters {
  const group = first(params.group);
  const level = first(params.level);
  const sort = oneOf(["name", "grade", "registered", "status"] as const, first(params.sort)) ?? "registered";
  const dir = oneOf(["asc", "desc"] as const, first(params.dir)) ?? defaultSortDirection(sort);
  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    year: positiveInt(first(params.year)),
    status: oneOf(REGISTRATION_STATUSES, first(params.status)),
    payment: oneOf(PAYMENT_STATUSES, first(params.payment)),
    grade: oneOf(GRADES, first(params.grade)),
    level: level === "unknown" ? "unknown" : oneOf(ARABIC_LEVELS, level),
    returning: oneOf(["new", "returning"] as const, first(params.returning)),
    group: group === "none" ? "none" : positiveInt(group),
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
  set("level", filters.level);
  set("returning", filters.returning);
  set("group", filters.group);
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
 * logic serves the list page and the CSV export (and can be unit tested).
 */
export interface FilterableQuery<Q> {
  eq(column: string, value: string | number | boolean): Q;
  is(column: string, value: null): Q;
  ilike(column: string, pattern: string): Q;
}

export function applyStudentFilters<Q extends FilterableQuery<Q>>(query: Q, filters: StudentFilters, yearId: number): Q {
  let q = query.eq("school_year_id", yearId);
  if (filters.q) q = q.ilike("search_text", `%${escapeLikePattern(filters.q)}%`);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.payment) q = q.eq("payment_status", filters.payment);
  if (filters.grade) q = q.eq("grade", filters.grade);
  if (filters.level === "unknown") q = q.is("arabic_level", null);
  else if (filters.level) q = q.eq("arabic_level", filters.level);
  if (filters.returning) q = q.eq("is_returning", filters.returning === "returning");
  if (filters.group === "none") q = q.is("group_id", null);
  else if (filters.group) q = q.eq("group_id", filters.group);
  if (filters.review) q = q.eq("needs_review", true);
  return q;
}

export const SORT_COLUMNS: Record<StudentFilters["sort"], string[]> = {
  name: ["student_last_name", "student_first_name"],
  grade: ["grade_rank", "student_last_name"],
  registered: ["registered_at"],
  status: ["status", "student_last_name"],
};
