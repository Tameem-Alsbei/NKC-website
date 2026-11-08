import { formatAddress, formatTuition, program } from "@/lib/config/program";
import type { RegistrationResult } from "@/lib/registration/schema";
import { formatSchoolYear } from "@/lib/school-year-format";

/**
 * Email-ready registration confirmation. Not sent automatically: no email
 * provider is configured yet. When one is added, call this from the
 * registration API after a successful submission (never include health
 * information in emails).
 */
export function registrationConfirmationEmail(result: RegistrationResult, guardianFirstName: string) {
  const year = formatSchoolYear(result.schoolYear);
  const lines = result.registrations.map((r) => `  - ${r.studentFirstName}: ${r.referenceCode}`);

  const subject = `${program.name} registration received (${year})`;
  const text = [
    `Assalamu alaikum ${guardianFirstName},`,
    "",
    `JazakAllahu khayran for registering for ${program.name} for ${year}. We received your registration.`,
    "",
    "Reference numbers:",
    ...lines,
    "",
    `When: ${program.schedule.summary}`,
    `Where: ${program.location.venue}, ${formatAddress()}`,
    `Tuition: ${formatTuition()}`,
    "",
    "Our team will review your registration and contact you about next steps.",
    `Questions? Reply to this email or write to ${program.contact.email}.`,
    "",
    program.name,
  ].join("\n");

  return { subject, text };
}
