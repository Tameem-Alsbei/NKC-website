import Link from "next/link";
import { school } from "@/lib/config/school";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="on-dark no-print mt-auto bg-pine-950 text-cream-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream-200">{school.description}</p>
          <p lang="ar" dir="rtl" className="mt-4 text-left font-arabic text-xl text-gold-300">
            {school.arabicName}
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Families</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="hover:text-white hover:underline" href="/register">
                Register a student
              </Link>
            </li>
            <li>
              <Link className="hover:text-white hover:underline" href="/#program">
                About the program
              </Link>
            </li>
            <li>
              <Link className="hover:text-white hover:underline" href="/#contact">
                Contact the school
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-300">School staff</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="hover:text-white hover:underline" href="/admin/login">
                Staff sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-cream-200 sm:px-6">
          © {school.name}. Family information is used only to run the school program.
        </p>
      </div>
    </footer>
  );
}
