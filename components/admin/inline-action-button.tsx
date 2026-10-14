"use client";

import { useState, useTransition } from "react";
import { cn } from "@/components/ui/cn";
import type { ActionResult } from "@/lib/admin/actions";

/** A small text button that runs a Server Action and reports the result inline. */
export function InlineActionButton({
  action,
  label,
  pendingLabel = "Saving…",
  confirmMessage,
  tone = "default",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
  tone?: "default" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          startTransition(async () => setResult(await action()));
        }}
        className={cn(
          "rounded-md px-2 py-1 text-left text-sm font-semibold disabled:opacity-60",
          tone === "danger" ? "text-danger-700 hover:bg-danger-50" : "text-pine-700 hover:bg-pine-50",
        )}
      >
        {pending ? pendingLabel : label}
      </button>
      {result && !result.ok && (
        <span role="alert" className="px-2 text-xs text-danger-700">
          {result.message}
        </span>
      )}
    </span>
  );
}
