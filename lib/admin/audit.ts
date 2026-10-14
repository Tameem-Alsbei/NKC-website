import type { Json, TableRow } from "@/lib/database.types";
import { labelFor } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from "@/lib/registration/options";

export type AuditEntry = Pick<
  TableRow<"audit_logs">,
  "id" | "actor_id" | "action" | "table_name" | "record_id" | "changed_fields" | "old_values" | "new_values" | "created_at"
>;

const TABLE_LABELS: Record<string, string> = {
  students: "student profile",
  parents: "guardian",
  households: "family",
  student_parents: "guardian link",
  student_health_notes: "special considerations",
  school_years: "school year",
  groups: "group",
  registrations: "registration",
  student_group_assignments: "group assignment",
  payments: "payment",
  admin_notes: "internal note",
  admin_profiles: "admin profile",
};

const FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  date_of_birth: "date of birth",
  arabic_level: "Arabic level",
  studied_arabic_before: "studied Arabic before",
  is_returning: "new/returning",
  needs_review: "review flag",
  amount_due: "amount due",
  payment_status: "payment status",
  payment_note: "payment note",
  group_id: "group",
  special_considerations: "special considerations",
  emergency_contact_name: "emergency contact",
  emergency_contact_phone: "emergency phone",
  is_primary_contact: "primary contact",
};

// Bookkeeping columns that change alongside the meaningful ones.
const HIDDEN_FIELDS = new Set(["status_changed_at", "status_changed_by", "assigned_at", "assigned_by", "updated_by", "email_normalized", "phone_normalized"]);

function valueOf(values: Json | null, key: string): unknown {
  return values && typeof values === "object" && !Array.isArray(values) ? values[key] : undefined;
}

function display(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (key === "status") return labelFor(REGISTRATION_STATUS_LABELS, String(value));
  if (key === "payment_status") return labelFor(PAYMENT_STATUS_LABELS, String(value));
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** One readable sentence describing an audit entry (never includes health contents). */
export function describeAuditEntry(entry: AuditEntry): string {
  const thing = TABLE_LABELS[entry.table_name] ?? entry.table_name.replaceAll("_", " ");
  if (entry.action === "insert") return `Added ${thing}`;
  if (entry.action === "delete") return `Removed ${thing}`;

  const fields = (entry.changed_fields ?? []).filter((field) => !HIDDEN_FIELDS.has(field));
  if (fields.length === 0) return `Updated ${thing}`;

  // Health note values are never stored in the audit log.
  if (entry.table_name === "student_health_notes") return "Updated special considerations";

  const parts = fields.slice(0, 4).map((field) => {
    const label = FIELD_LABELS[field] ?? field.replaceAll("_", " ");
    if (["status", "payment_status", "grade", "amount_due", "is_returning", "needs_review"].includes(field)) {
      return `${label}: ${display(field, valueOf(entry.old_values, field))} → ${display(field, valueOf(entry.new_values, field))}`;
    }
    return label;
  });
  const more = fields.length > 4 ? ` and ${fields.length - 4} more` : "";
  return `Updated ${thing} (${parts.join("; ")}${more})`;
}
