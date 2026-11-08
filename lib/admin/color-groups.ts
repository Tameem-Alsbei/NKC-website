/**
 * Color-group placement guidance. Criteria (age range and gender) are set by
 * administrators on each color group; nothing here assigns a student. The
 * result is only shown as a suggestion for an administrator to confirm.
 */

export type ColorGroupCriteria = {
  id: number;
  name: string;
  min_age: number | null;
  max_age: number | null;
  gender: "male" | "female" | "any";
  is_active: boolean;
};

export function hasCriteria(group: ColorGroupCriteria): boolean {
  return group.min_age !== null || group.max_age !== null || group.gender !== "any";
}

/** Whether a student fits a group's configured criteria (false if none are set). */
export function matchesCriteria(group: ColorGroupCriteria, age: number, gender: "male" | "female" | null): boolean {
  if (!group.is_active || !hasCriteria(group)) return false;
  if (group.min_age !== null && age < group.min_age) return false;
  if (group.max_age !== null && age > group.max_age) return false;
  if (group.gender !== "any" && group.gender !== gender) return false;
  return true;
}

/**
 * The single group a student fits, or null when none or several fit (an
 * administrator should decide in that case).
 */
export function suggestColorGroup<G extends ColorGroupCriteria>(
  groups: G[],
  age: number,
  gender: "male" | "female" | null,
): G | null {
  const matches = groups.filter((group) => matchesCriteria(group, age, gender));
  return matches.length === 1 ? matches[0] : null;
}

export function describeCriteria(group: ColorGroupCriteria): string {
  if (!hasCriteria(group)) return "No placement guidance set";
  const parts: string[] = [];
  if (group.min_age !== null && group.max_age !== null) parts.push(`ages ${group.min_age}–${group.max_age}`);
  else if (group.min_age !== null) parts.push(`ages ${group.min_age}+`);
  else if (group.max_age !== null) parts.push(`up to age ${group.max_age}`);
  if (group.gender === "male") parts.push("boys");
  if (group.gender === "female") parts.push("girls");
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
