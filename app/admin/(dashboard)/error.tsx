"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger-200 bg-white p-8">
      <h1 className="font-serif text-2xl font-semibold text-pine-900">Something went wrong</h1>
      <p className="mt-2 max-w-xl text-ink-600">
        This page couldn&apos;t be loaded. Please try again. If the problem continues, sign out and back in.
      </p>
      {error.digest && <p className="mt-2 text-xs text-ink-500">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
