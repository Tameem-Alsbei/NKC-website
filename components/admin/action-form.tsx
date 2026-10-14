"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { ActionResult } from "@/lib/admin/actions";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Wraps a Server Action in a form with pending, success and error feedback.
 *
 * Submits through onSubmit + startTransition (instead of the `action` prop)
 * so that a failed save does not reset what the admin typed.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  pendingLabel = "Saving…",
  submitVariant = "primary",
  confirmMessage,
  resetOnSuccess = false,
  className,
  footerClassName,
  hideFeedbackOnSuccess = false,
}: {
  action: Action;
  children: ReactNode | ((state: ActionResult) => ReactNode);
  submitLabel?: string;
  pendingLabel?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "ghost";
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  footerClassName?: string;
  hideFeedbackOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      noValidate
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {typeof children === "function" ? children(state) : children}
      <div className={cn("mt-4 flex flex-wrap items-center gap-3", footerClassName)}>
        <Button type="submit" variant={submitVariant} disabled={pending}>
          {pending ? (
            <>
              <Spinner />
              {pendingLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <p
          role={state && !state.ok ? "alert" : "status"}
          className={cn(
            "text-sm font-medium",
            state?.ok ? "text-pine-700" : "text-danger-700",
            (!state || (state.ok && hideFeedbackOnSuccess)) && "sr-only",
          )}
        >
          {state?.message ?? ""}
        </p>
      </div>
    </form>
  );
}
