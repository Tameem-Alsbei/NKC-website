import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <p lang="ar" dir="rtl" className="font-arabic text-3xl text-gold-600">
            عذراً
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-pine-900">Page not found</h1>
          <p className="mt-3 text-ink-600">The page you were looking for doesn&apos;t exist or may have moved.</p>
          <ButtonLink href="/" className="mt-6">
            Back to home
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
