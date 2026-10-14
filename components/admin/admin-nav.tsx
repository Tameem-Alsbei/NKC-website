"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "@/components/ui/cn";

const LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/families", label: "Families" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/activity", label: "Activity log" },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = "exact" in link ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
                active ? "bg-pine-800 text-cream-50" : "text-cream-100 hover:bg-white/10",
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebarNav() {
  return (
    <nav aria-label="Dashboard">
      <NavLinks />
    </nav>
  );
}

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-cream-50 hover:bg-white/10"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      <nav id={id} hidden={!open} aria-label="Dashboard" className="absolute inset-x-0 top-full z-30 bg-pine-900 px-4 pb-4 shadow-lg">
        <NavLinks onNavigate={() => setOpen(false)} />
      </nav>
    </div>
  );
}
