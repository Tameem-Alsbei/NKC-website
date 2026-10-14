/** Display helpers shared by admin pages and exports. */
import { GRADE_LABELS } from "@/lib/registration/options";

const dateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats a YYYY-MM-DD date without shifting it across time zones. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(amount) ? moneyFormatter.format(amount) : "—";
}

/** Age in whole years on the given date (defaults to today). */
export function ageFromDateOfBirth(dateOfBirth: string, on: Date = new Date()): number {
  const [y, m, d] = dateOfBirth.slice(0, 10).split("-").map(Number);
  let age = on.getFullYear() - y;
  const beforeBirthday = on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(" ") || "—";
}

/** Looks up a label, falling back to a humanized version of the raw value. */
export function labelFor(labels: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return labels[value] ?? value.replaceAll("_", " ");
}

/** "3rd grade – 5th grade", or "Any grade" when no range is set. */
export function formatGradeRange(min: string | null, max: string | null): string {
  const label = (grade: string) => labelFor(GRADE_LABELS, grade);
  if (!min && !max) return "Any grade";
  if (min && max && min === max) return label(min);
  return `${min ? label(min) : "Any"} – ${max ? label(max) : "any"}`;
}
