import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * primary   - blue, for most actions (especially in the dashboard)
 * cta       - orange with navy text, for the main call to action (Register)
 * secondary - outlined
 */
type Variant = "primary" | "cta" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm",
  cta: "bg-sun-500 text-brand-950 hover:bg-sun-400 active:bg-sun-400 shadow-sm",
  secondary:
    "border-2 border-brand-200 bg-white text-brand-800 hover:border-brand-500 hover:bg-brand-50 active:bg-brand-100",
  ghost: "text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  danger: "border border-danger-200 bg-white text-danger-700 hover:bg-danger-50",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-[0.95rem]",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
