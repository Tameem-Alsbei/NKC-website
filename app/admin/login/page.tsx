import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getAdminAccess } from "@/lib/auth/admin";
import { safeAdminRedirect } from "@/lib/auth/access";
import { signOut } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeAdminRedirect(params.next) : undefined;
  const access = await getAdminAccess();

  if (access.status === "authorized") redirect(next ?? "/admin");

  return (
    <main id="main" className="flex flex-1 items-center justify-center bg-cream-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="font-serif text-2xl font-semibold text-pine-900">Staff sign in</h1>
          <p className="mt-1 text-sm text-ink-500">For approved school administrators only.</p>

          <div className="mt-6 space-y-5">
            {params.signed_out === "1" && <Alert tone="success">You have been signed out.</Alert>}

            {access.status === "not_authorized" ? (
              <>
                <Alert tone="warning" title="No dashboard access">
                  You&apos;re signed in{access.email ? ` as ${access.email}` : ""}, but this account isn&apos;t an approved
                  school administrator. Please contact a school administrator if you need access.
                </Alert>
                <form action={signOut}>
                  <Button type="submit" variant="secondary" className="w-full">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <LoginForm next={next} />
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-ink-500">
          Are you a parent?{" "}
          <Link href="/register" className="font-semibold text-pine-700 underline-offset-4 hover:underline">
            Register a student
          </Link>
        </p>
      </div>
    </main>
  );
}
