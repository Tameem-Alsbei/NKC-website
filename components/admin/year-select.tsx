"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { inputClasses } from "@/components/ui/fields";
import { formatSchoolYear } from "@/lib/school-year-format";

/** Switches the school year shown on a dashboard page (kept in the URL). */
export function YearSelect({ years, selectedId }: { years: { id: number; label: string; is_current: boolean }[]; selectedId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="year-select" className="text-sm font-semibold text-ink-700">
        School year
      </label>
      <select
        id="year-select"
        value={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("year", event.target.value);
          params.delete("page");
          router.push(`${pathname}?${params.toString()}`);
        }}
        className={inputClasses(false, "min-h-10 w-auto py-1.5")}
      >
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {formatSchoolYear(year.label)}
            {year.is_current ? " (current)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
