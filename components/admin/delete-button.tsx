"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/actions";

/** Small destructive action with a confirmation prompt and inline feedback. */
export function DeleteButton({
  action,
  label = "Delete",
  confirmMessage,
  accessibleLabel,
}: {
  action: () => Promise<ActionResult>;
  label?: string;
  confirmMessage: string;
  accessibleLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        aria-label={accessibleLabel}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result && !result.ok) setError(result.message);
          });
        }}
        className="rounded-md px-2 py-1 text-sm font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-60"
      >
        {pending ? "Deleting…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger-700">
          {error}
        </span>
      )}
    </span>
  );
}
