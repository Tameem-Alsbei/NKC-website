"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";

const NAV_LINKS = [
  { href: "/#program", label: "Program" },
  { href: "/#who", label: "Who we serve" },
  { href: "/#registration", label: "Registration info" },
  { href: "/#contact", label: "Contact" },
] as const;

export function SiteHeader({ showRegister = true }: { showRegister?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/80 bg-cream-50/95 backdrop-blur supports-[backdrop-filter]:bg-cream-50/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-700 hover:bg-cream-100 hover:text-pine-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/admin/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink-500 hover:text-pine-900">
            Staff sign in
          </Link>
          {showRegister && <ButtonLink href="/register">Register now</ButtonLink>}
        </div>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-pine-900 hover:bg-cream-100 lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <div id={menuId} hidden={!open} className="border-t border-line bg-cream-50 lg:hidden">
        <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-medium text-ink-700 hover:bg-cream-100"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin/login"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-3 text-base font-medium text-ink-500 hover:bg-cream-100"
          >
            Staff sign in
          </Link>
          {showRegister && (
            <ButtonLink href="/register" size="lg" className="mt-2" onClick={() => setOpen(false)}>
              Register now
            </ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}
