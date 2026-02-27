"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StatusFilter = "all" | "draft" | "published";

const options: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
];

export function EventsStatusFilter({ selected }: { selected: StatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const applyFilter = (value: StatusFilter) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", value);
    }

    const query = nextParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === selected;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => applyFilter(option.value)}
              disabled={isPending}
              className={[
                "rounded-[var(--radius-base)] border px-3 py-1.5 text-sm",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-2 text-foreground",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isPending ? <p className="text-xs text-muted">Actualizando lista...</p> : null}
    </div>
  );
}
