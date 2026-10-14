import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Field, inputClasses } from "@/components/ui/fields";

/**
 * Uncontrolled inputs for admin forms. Values are read from FormData by the
 * Server Action, so these only need a name and a default value.
 */

type Common = { label: ReactNode; error?: string; hint?: ReactNode; optional?: boolean; className?: string };

export function FormInput({
  id,
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: Common & Omit<ComponentProps<"input">, "className"> & { id: string }) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {(control) => <input {...props} {...control} className={inputClasses(Boolean(error))} />}
    </Field>
  );
}

export function FormSelect({
  id,
  label,
  error,
  hint,
  optional,
  className,
  options,
  placeholder,
  ...props
}: Common &
  Omit<ComponentProps<"select">, "className"> & {
    id: string;
    options: readonly { value: string | number; label: string }[];
    placeholder?: string;
  }) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {(control) => (
        <select {...props} {...control} className={inputClasses(Boolean(error))}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function FormTextarea({
  id,
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: Common & Omit<ComponentProps<"textarea">, "className"> & { id: string }) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      {(control) => <textarea {...props} {...control} className={inputClasses(Boolean(error), "min-h-24 leading-relaxed")} />}
    </Field>
  );
}

export function FormCheckbox({
  id,
  label,
  className,
  ...props
}: { id: string; label: ReactNode; className?: string } & Omit<ComponentProps<"input">, "className" | "type">) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-900", className)}>
      <input id={id} type="checkbox" {...props} className="mt-0.5 size-4 shrink-0 accent-pine-700" />
      <span>{label}</span>
    </label>
  );
}
