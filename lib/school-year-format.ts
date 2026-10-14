/** "2026-2027" -> "2026–2027" for display. Safe to use in Client Components. */
export function formatSchoolYear(label: string): string {
  return label.replace("-", "–");
}
