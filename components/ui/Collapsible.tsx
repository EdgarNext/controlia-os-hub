"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Collapsible({
  title,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}: CollapsibleProps) {
  const contentId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : internalOpen;

  function setOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-base)] px-4 py-3 text-left text-sm font-medium text-foreground transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!isOpen)}
      >
        <span>{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 ${isOpen ? "rotate-180" : "rotate-0"}`}
          style={{ transition: "transform var(--transition-base)" }}
        />
      </button>

      <div
        className="grid"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows var(--transition-base)",
        }}
      >
        <div id={contentId} className="overflow-hidden">
          <div
            className="border-t border-border px-4 py-3 text-sm text-muted"
            style={{
              animation: `${isOpen ? "collapse-down" : "collapse-up"} var(--transition-base) both`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
