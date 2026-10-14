"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, Spinner } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <Alert tone="error" id="login-error">
          {state.error}
        </Alert>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-ink-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          aria-describedby={state?.error ? "login-error" : undefined}
          className={inputClasses(Boolean(state?.error))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-ink-900">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClasses(Boolean(state?.error))}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
