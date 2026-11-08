import type { Metadata, Viewport } from "next";
import { Fredoka, Noto_Naskh_Arabic, Nunito } from "next/font/google";
import { brandAssets, program } from "@/lib/config/program";
import "./globals.css";

const body = Nunito({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Fredoka({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const arabic = Noto_Naskh_Arabic({ variable: "--font-arabic-face", subsets: ["arabic"], weight: ["600"], display: "swap" });

function siteUrl(): URL | undefined {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  return url ? new URL(url) : undefined;
}

export const metadata: Metadata = {
  // Absolute URLs for social previews: NEXT_PUBLIC_SITE_URL, else the Vercel production domain.
  metadataBase: siteUrl(),
  title: {
    default: `${program.name} | ${program.schedule.summary}`,
    template: `%s | ${program.name}`,
  },
  description: program.description,
  applicationName: program.name,
  openGraph: {
    title: program.name,
    description: program.description,
    type: "website",
    siteName: program.name,
    images: [{ url: brandAssets.logoPath, width: brandAssets.logo.width, height: brandAssets.logo.height, alt: brandAssets.logoAlt }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e386c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${arabic.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-brand-800 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
