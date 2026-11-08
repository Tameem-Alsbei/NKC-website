import { describe, expect, it } from "vitest";
import {
  applyStudentFilters,
  escapeLikePattern,
  orderForSort,
  parseStudentFilters,
  studentFiltersToQuery,
  type FilterableQuery,
} from "@/lib/admin/student-filters";

class RecordingQuery implements FilterableQuery<RecordingQuery> {
  calls: string[] = [];
  eq(column: string, value: string | number | boolean) {
    this.calls.push(`eq ${column}=${value}`);
    return this;
  }
  is(column: string, value: null) {
    this.calls.push(`is ${column}=${value}`);
    return this;
  }
  not(column: string, operator: "is", value: null) {
    this.calls.push(`not ${column} ${operator} ${value}`);
    return this;
  }
  ilike(column: string, pattern: string) {
    this.calls.push(`ilike ${column}=${pattern}`);
    return this;
  }
  or(filters: string) {
    this.calls.push(`or ${filters}`);
    return this;
  }
}

describe("parseStudentFilters", () => {
  it("ignores unknown or malicious values", () => {
    const filters = parseStudentFilters({
      status: "deleted",
      payment: "paid",
      grade: "13",
      colorGroup: "1 or 1=1",
      quranLevel: "-4",
      teacher: "abc",
      gender: "other",
      year: "-1",
      sort: "password",
      page: "0",
    });
    expect(filters).toMatchObject({
      status: null,
      payment: "paid",
      grade: null,
      colorGroup: null,
      quranLevel: null,
      teacher: null,
      gender: null,
      year: null,
      sort: "registered",
      dir: "desc",
      page: 1,
    });
  });

  it("round-trips through the query string", () => {
    const filters = parseStudentFilters({
      q: "Haddad",
      status: "pending",
      colorGroup: "none",
      quranLevel: "4",
      teacher: "7",
      assignment: "unassigned",
      gender: "female",
      review: "1",
      sort: "quran",
      page: "3",
    });
    const query = studentFiltersToQuery(filters);
    expect(parseStudentFilters(Object.fromEntries(new URLSearchParams(query.slice(1))))).toEqual(filters);
  });
});

describe("applyStudentFilters", () => {
  it("always scopes to a school year and keeps color group and Quran filters separate", () => {
    const query = applyStudentFilters(
      new RecordingQuery(),
      parseStudentFilters({ q: "50%_off", status: "confirmed", gender: "unknown", returning: "returning", colorGroup: "none", quranLevel: "3", teacher: "none" }),
      7,
    );
    expect(query.calls).toEqual([
      "eq school_year_id=7",
      "ilike search_text=%50\\%\\_off%",
      "eq status=confirmed",
      "is gender=null",
      "eq is_returning=true",
      "is color_group_id=null",
      "eq quran_level_id=3",
      "is teacher_id=null",
    ]);
  });

  it("finds active students missing any placement", () => {
    const query = applyStudentFilters(new RecordingQuery(), parseStudentFilters({ assignment: "unassigned" }), 1);
    expect(query.calls).toEqual([
      "eq school_year_id=1",
      "eq is_active=true",
      "or color_group_id.is.null,quran_level_id.is.null,teacher_id.is.null",
    ]);
  });
});

describe("orderForSort", () => {
  it("sorts by age using date of birth in the opposite direction", () => {
    expect(orderForSort(parseStudentFilters({ sort: "age" }))[0]).toEqual({ column: "date_of_birth", ascending: false });
  });
});

describe("escapeLikePattern", () => {
  it("escapes wildcard characters", () => {
    expect(escapeLikePattern("A_b%c\\d")).toBe("a\\_b\\%c\\\\d");
  });
});
