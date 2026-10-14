import { describe, expect, it } from "vitest";
import {
  applyStudentFilters,
  escapeLikePattern,
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
  ilike(column: string, pattern: string) {
    this.calls.push(`ilike ${column}=${pattern}`);
    return this;
  }
}

describe("parseStudentFilters", () => {
  it("ignores unknown or malicious values", () => {
    const filters = parseStudentFilters({
      status: "deleted",
      payment: "paid",
      grade: "13",
      group: "1 or 1=1",
      year: "-1",
      sort: "password",
      page: "0",
    });
    expect(filters).toMatchObject({ status: null, payment: "paid", grade: null, group: null, year: null, sort: "registered", dir: "desc", page: 1 });
  });

  it("round-trips through the query string", () => {
    const filters = parseStudentFilters({ q: "Haddad", status: "pending", group: "none", review: "1", sort: "name", page: "3" });
    const query = studentFiltersToQuery(filters);
    expect(parseStudentFilters(Object.fromEntries(new URLSearchParams(query.slice(1))))).toEqual(filters);
  });
});

describe("applyStudentFilters", () => {
  it("always scopes to a school year and applies each filter", () => {
    const query = applyStudentFilters(
      new RecordingQuery(),
      parseStudentFilters({ q: "50%_off", status: "confirmed", level: "unknown", returning: "returning", group: "none" }),
      7,
    );
    expect(query.calls).toEqual([
      "eq school_year_id=7",
      "ilike search_text=%50\\%\\_off%",
      "eq status=confirmed",
      "is arabic_level=null",
      "eq is_returning=true",
      "is group_id=null",
    ]);
  });
});

describe("escapeLikePattern", () => {
  it("escapes wildcard characters", () => {
    expect(escapeLikePattern("A_b%c\\d")).toBe("a\\_b\\%c\\\\d");
  });
});
