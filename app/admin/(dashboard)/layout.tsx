import type { Metadata } from "next";
import Link from "next/link";
import { AdminMobileNav, AdminSidebarNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/admin";
import { school } from "@/lib/config/school";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s | ${school.shortName} Admin` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side gate for every dashboard page. Server Actions and the export
  // route check access again on their own.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream-50 lg:flex-row">
      <aside className="on-dark relative bg-pine-950 text-cream-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" className="flex items-center gap-3 rounded-lg">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-gold-300 font-arabic text-xl text-pine-900">
              <span className="-mt-1">ع</span>
            </span>
            <span className="leading-tight">
              <span className="block font-serif font-semibold text-cream-50">{school.shortName} Admin</span>
              <span className="block text-xs text-cream-200">School dashboard</span>
            </span>
          </Link>
          <AdminMobileNav />
        </div>
        <div className="hidden flex-1 px-3 lg:block">
          <AdminSidebarNav />
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-semibold text-cream-50">{admin.fullName}</p>
          <p className="text-xs capitalize text-cream-200">{admin.role === "admin" ? "Administrator" : "Staff"}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="rounded-md text-sm font-semibold text-gold-300 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 text-sm lg:hidden">
          <span className="truncate text-ink-600">
            Signed in as <strong className="font-semibold text-ink-900">{admin.fullName}</strong>
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2 py-1 font-semibold text-pine-700 hover:underline">
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
