import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Form building blocks with labels, hints and error messages wired together
 * through aria-describedby / aria-invalid, so screen readers announce them.
 */

export const inputClasses = (invalid?: boolean, className?: string) =>
  cn(
    "block w-full min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-ink-900 shadow-sm transition-colors",
    "placeholder:text-ink-500/70 hover:border-pine-600 focus-visible:border-pine-700",
    "disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink-500",
    invalid ? "border-danger-700 bg-danger-50/40" : "border-line-strong",
    className,
  );

type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-danger-700">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.75 4.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM10 14.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

function describedBy(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export function Field({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-900">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-500">(optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="-mt-0.5 text-sm text-ink-500">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy(hintId, errorId),
      })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "onChange" | "value"> & {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  fieldClassName?: string;
};

export function TextField({
  id,
  label,
  value,
  onValueChange,
  error,
  hint,
  optional,
  fieldClassName,
  className,
  ...inputProps
}: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={fieldClassName}>
      {(control) => (
        <input
          {...inputProps}
          {...control}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={inputClasses(Boolean(error), className)}
        />
      )}
    </Field>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id" | "onChange" | "value"> & {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  fieldClassName?: string;
};

export function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  error,
  hint,
  optional,
  fieldClassName,
  className,
  ...selectProps
}: SelectFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={fieldClassName}>
      {(control) => (
        <select
          {...selectProps}
          {...control}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={inputClasses(Boolean(error), cn("pr-8", className))}
        >
          <option value="">{placeholder}</option>
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

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id" | "onChange" | "value"> & {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  fieldClassName?: string;
  showCount?: boolean;
};

export function TextAreaField({
  id,
  label,
  value,
  onValueChange,
  error,
  hint,
  optional,
  fieldClassName,
  className,
  maxLength,
  showCount,
  ...textareaProps
}: TextAreaFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} className={fieldClassName}>
      {(control) => (
        <>
          <textarea
            {...textareaProps}
            {...control}
            value={value}
            maxLength={maxLength}
            onChange={(event) => onValueChange(event.target.value)}
            className={inputClasses(Boolean(error), cn("min-h-28 leading-relaxed", className))}
          />
          {showCount && maxLength && (
            <p className="text-right text-xs text-ink-500" aria-live="polite">
              {value.length} / {maxLength} characters
            </p>
          )}
        </>
      )}
    </Field>
  );
}

export type ChoiceOption = { value: string; label: string; description?: string };

/**
 * A radio group rendered as selectable cards inside a fieldset.
 * Uses native radio inputs, so arrow-key navigation works as expected.
 */
export function ChoiceGroup({
  id,
  name,
  legend,
  options,
  value,
  onValueChange,
  error,
  hint,
  columns = 2,
}: {
  id: string;
  name: string;
  legend: ReactNode;
  options: readonly ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  columns?: 2 | 3;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={describedBy(hintId, errorId)} className="min-w-0 outline-none">
      <legend className="text-sm font-semibold text-ink-900">{legend}</legend>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-500">
          {hint}
        </p>
      )}
      <div className={cn("mt-2 grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-3.5 py-3 transition-colors",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
                checked
                  ? "border-pine-700 bg-pine-50 ring-1 ring-pine-700"
                  : error
                    ? "border-danger-700 hover:border-pine-600"
                    : "border-line-strong hover:border-pine-600",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onValueChange(option.value)}
                className="mt-1 size-4 shrink-0 accent-pine-700 focus-visible:outline-none"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-ink-900">{option.label}</span>
                {option.description && <span className="mt-0.5 block text-sm text-ink-500">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <div className="mt-2">
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      )}
    </fieldset>
  );
}

export function CheckboxField({
  id,
  checked,
  onCheckedChange,
  label,
  error,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  error?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-4 py-3.5 transition-colors",
          checked ? "border-pine-700 bg-pine-50" : error ? "border-danger-700" : "border-line-strong hover:border-pine-600",
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-pine-700"
        />
        <span className="text-[0.95rem] leading-relaxed text-ink-900">{label}</span>
      </label>
      {error && (
        <div className="mt-1.5">
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      )}
    </div>
  );
}
