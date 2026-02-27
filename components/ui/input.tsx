import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
};

type FieldProps = {
  label: string;
  htmlFor: string;
  errorText?: string | null;
  helpText?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
};

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  errorText,
  helpText,
  className,
  labelClassName,
  inputClassName,
  leading,
  trailing,
  children,
}: FieldProps) {
  const describedById = errorText ? `${htmlFor}-error` : helpText ? `${htmlFor}-help` : undefined;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>

      {children ? (
        children
      ) : (
        <div className="relative">
          {leading ? <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">{leading}</div> : null}
          <Input
            id={htmlFor}
            name={htmlFor}
            invalid={Boolean(errorText)}
            aria-describedby={describedById}
            className={cn(leading && "pl-10", trailing && "pr-10", inputClassName)}
          />
          {trailing ? <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">{trailing}</div> : null}
        </div>
      )}

      {errorText ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {errorText}
        </p>
      ) : helpText ? (
        <p id={`${htmlFor}-help`} className="text-sm text-muted">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
