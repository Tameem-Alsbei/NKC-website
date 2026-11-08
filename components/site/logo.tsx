import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { brandAssets } from "@/lib/config/program";

/**
 * The official Noor Kids Club logo. Use this everywhere instead of writing
 * image markup by hand.
 *
 * The logo is shown unaltered: its aspect ratio is preserved (height is set,
 * width follows), and on colored backgrounds it sits on a white plate so the
 * orange and blue artwork stays readable.
 */
const SIZES = {
  sm: "h-9",
  md: "h-12",
  lg: "h-16 sm:h-20",
  xl: "h-24 sm:h-32",
} as const;

export function Logo({
  size = "md",
  href = "/",
  plate = false,
  eager = false,
  className,
}: {
  size?: keyof typeof SIZES;
  /** Where the logo links to. Pass null for a non-link logo. */
  href?: string | null;
  /** Adds a white rounded backdrop, for use on blue backgrounds. */
  plate?: boolean;
  /** Load immediately (use for a logo visible on first paint). */
  eager?: boolean;
  className?: string;
}) {
  const image = (
    <Image
      src={brandAssets.logo}
      alt={brandAssets.logoAlt}
      loading={eager ? "eager" : "lazy"}
      sizes="(min-width: 640px) 260px, 200px"
      className={cn("w-auto", SIZES[size])}
    />
  );
  const wrapperClass = cn(
    "inline-flex shrink-0 items-center",
    plate && "rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5",
    className,
  );

  if (href === null) return <span className={wrapperClass}>{image}</span>;
  return (
    <Link href={href} className={cn(wrapperClass, "rounded-xl")} aria-label={`${brandAssets.logoAlt} home`}>
      {image}
    </Link>
  );
}
