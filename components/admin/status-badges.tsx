import { Badge, type BadgeTone } from "@/components/ui/badge";
import { labelFor } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from "@/lib/registration/options";

const STATUS_TONES: Record<string, BadgeTone> = {
  pending: "gold",
  under_review: "blue",
  confirmed: "green",
  waitlisted: "neutral",
  withdrawn: "muted",
  rejected: "red",
};

const PAYMENT_TONES: Record<string, BadgeTone> = {
  not_paid: "red",
  partially_paid: "gold",
  paid: "green",
  waived: "blue",
};

export function RegistrationStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{labelFor(REGISTRATION_STATUS_LABELS, status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONES[status] ?? "neutral"}>{labelFor(PAYMENT_STATUS_LABELS, status)}</Badge>;
}

export function NeedsReviewBadge() {
  return <Badge tone="red">Needs review</Badge>;
}
