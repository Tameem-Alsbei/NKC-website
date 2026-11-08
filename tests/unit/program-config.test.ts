import { describe, expect, it } from "vitest";
import { hasCriteria, suggestColorGroup, type ColorGroupCriteria } from "@/lib/admin/color-groups";
import { faqs, formatTuition, program, programActivities } from "@/lib/config/program";
import { registrationConfirmationEmail } from "@/lib/email/registration-confirmation";
import { formatQuranLevel, QURAN_LEVELS } from "@/lib/registration/options";

describe("program configuration", () => {
  it("holds the confirmed Noor Kids Club details", () => {
    expect(program.name).toBe("Noor Kids Club");
    expect(program.schedule.summary).toBe("Saturdays, 2:30–5:30 PM");
    expect(program.contact.email).toBe("noorkidsclub@noorohio.com");
    expect(programActivities.map((a) => a.title)).toEqual(["Quran", "Halaqah", "Fun Activities"]);
  });

  it("shows tuition without inventing a billing period", () => {
    expect(program.tuition.periodLabel).toBeNull();
    expect(formatTuition()).toBe("$185");
  });

  it("uses the exact Quran level names in the official order", () => {
    expect(QURAN_LEVELS.map((l) => formatQuranLevel(l.id, l.name))).toEqual([
      "4 – Hifz",
      "3 – Tajweed",
      "2 – Tilawah",
      "1 – Nooraniah",
    ]);
  });

  it("only lists FAQs that have real answers", () => {
    expect(faqs.some((faq) => faq.answer === null)).toBe(true);
    expect(faqs.filter((faq) => faq.answer).every((faq) => faq.answer!.length > 10)).toBe(true);
  });

  it("builds a confirmation email without health information", () => {
    const email = registrationConfirmationEmail({ schoolYear: "2026-2027", registrations: [{ referenceCode: "NKC-1234ABCD", studentFirstName: "Layla" }] }, "Mariam");
    expect(email.subject).toContain("Noor Kids Club");
    expect(email.text).toContain("NKC-1234ABCD");
    expect(email.text).toContain("$185");
  });
});

describe("color group suggestions", () => {
  const group = (overrides: Partial<ColorGroupCriteria>): ColorGroupCriteria => ({
    id: 1,
    name: "Red",
    min_age: null,
    max_age: null,
    gender: "any",
    is_active: true,
    ...overrides,
  });

  it("suggests nothing until criteria are configured", () => {
    expect(hasCriteria(group({}))).toBe(false);
    expect(suggestColorGroup([group({})], 7, "female")).toBeNull();
  });

  it("suggests the single group that fits age and gender", () => {
    const groups = [
      group({ id: 1, name: "Red", min_age: 5, max_age: 7, gender: "female" }),
      group({ id: 2, name: "Blue", min_age: 5, max_age: 7, gender: "male" }),
    ];
    expect(suggestColorGroup(groups, 6, "female")?.name).toBe("Red");
    expect(suggestColorGroup(groups, 9, "female")).toBeNull();
  });

  it("does not guess when several groups fit", () => {
    const groups = [group({ id: 1, min_age: 5, max_age: 9 }), group({ id: 2, name: "Green", min_age: 6, max_age: 8 })];
    expect(suggestColorGroup(groups, 7, "male")).toBeNull();
  });
});
