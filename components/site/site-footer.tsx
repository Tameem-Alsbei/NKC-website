import Link from "next/link";
import { formatAddress, mapsUrl, program } from "@/lib/config/program";
import { Logo } from "./logo";

export function SiteFooter() {
  const { contact, location, schedule } = program;
  return (
    <footer className="on-dark no-print mt-auto bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo size="lg" plate />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-100">{program.description}</p>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Visit us</h2>
          <address className="mt-3 space-y-2 text-sm not-italic leading-relaxed">
            <p>{schedule.summary}</p>
            <p>
              {location.venue}
              <br />
              {formatAddress()}
            </p>
            <p>
              <a
                className="font-semibold text-sun-300 underline-offset-4 hover:underline"
                href={mapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions<span className="sr-only"> (opens Google Maps)</span>
              </a>
            </p>
          </address>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className="font-semibold text-sun-300 underline-offset-4 hover:underline" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </li>
            <li>
              <Link className="hover:text-white hover:underline" href="/register">
                Register a child
              </Link>
            </li>
            <li>
              <Link className="hover:text-white hover:underline" href="/admin/login">
                Staff sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-brand-100 sm:px-6">
          © {program.name}. Family information is used only to run the program.
        </p>
      </div>
    </footer>
  );
}
