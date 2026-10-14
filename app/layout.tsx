import type { Metadata, Viewport } from "next";
import { Noto_Naskh_Arabic, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { school } from "@/lib/config/school";
import "./globals.css";

const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Source_Serif_4({ variable: "--font-heading", subsets: ["latin"], display: "swap" });
const arabic = Noto_Naskh_Arabic({
  variable: "--font-arabic-face",
  subsets: ["arabic"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${school.name} | ${school.tagline}`,
    template: `%s | ${school.name}`,
  },
  description: school.description,
  applicationName: school.name,
  openGraph: {
    title: school.name,
    description: school.description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#143826",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${arabic.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-pine-900 px-4 py-2 font-semibold text-cream-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
