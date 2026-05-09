import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = Omit<ComponentPropsWithoutRef<"select">, "children"> & {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  errorText?: string | null;
  helpText?: string;
  wrapperClassName?: string;
};

export const selectFieldClassName =
  "h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60";

export function SelectField({
  id,
  name,
  label,
  options,
  placeholder,
  errorText,
  helpText,
  className,
  wrapperClassName,
  ...props
}: SelectFieldProps) {
  const selectId = id ?? name;
  const describedById = errorText ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined;

  return (
    <div className={cn("space-y-1", wrapperClassName)}>
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <select
        id={selectId}
        name={name}
        aria-invalid={Boolean(errorText) || undefined}
        aria-describedby={describedById}
        className={cn(
          selectFieldClassName,
          errorText && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {errorText ? (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {errorText}
        </p>
      ) : helpText ? (
        <p id={`${selectId}-help`} className="text-sm text-muted">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
