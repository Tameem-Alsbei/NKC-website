import type { Metadata } from "next";
import { AdminMobileNav, AdminSidebarNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { requireAdmin } from "@/lib/auth/admin";
import { program } from "@/lib/config/program";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s | ${program.name} Admin` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side gate for every dashboard page. Server Actions and the export
  // route check access again on their own.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-mist-50 lg:flex-row">
      <aside className="on-dark relative bg-brand-900 text-brand-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <div>
            <Logo size="sm" plate href="/admin" eager />
            <p className="mt-2 hidden text-xs font-semibold text-brand-100 lg:block">Admin dashboard</p>
          </div>
          <AdminMobileNav />
        </div>
        <div className="hidden flex-1 overflow-y-auto px-3 lg:block">
          <AdminSidebarNav />
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-bold text-white">{admin.fullName}</p>
          <p className="text-xs text-brand-100">{admin.role === "admin" ? "Administrator" : "Staff"}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="rounded-md text-sm font-bold text-sun-300 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 text-sm lg:hidden">
          <span className="truncate text-ink-600">
            Signed in as <strong className="font-bold text-ink-900">{admin.fullName}</strong>
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2 py-1 font-bold text-brand-700 hover:underline">
              Sign out
            </button>
          </form>
        </div>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
