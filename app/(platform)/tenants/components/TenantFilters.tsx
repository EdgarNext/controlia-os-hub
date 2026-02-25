import Link from "next/link";
import { cn } from "@/lib/utils";
import { TenantFilterLinkLabel } from "./TenantFilterLinkLabel";

type TenantFiltersProps = {
  selected: "active" | "inactive" | "archived" | null;
};

const options = [
  { value: null, label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "archived", label: "Archivados" },
];

export function TenantFilters({ selected }: TenantFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const href = option.value ? `/tenants?status=${option.value}` : "/tenants";
        const isActive = selected === option.value || (!selected && !option.value);

        return (
          <Link
            key={option.label}
            href={href}
            className={cn(
              "rounded-[var(--radius-base)] border border-border px-3 py-1.5 text-sm transition-colors duration-200",
              isActive ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-2",
            )}
          >
            <TenantFilterLinkLabel label={option.label} isActive={isActive} />
          </Link>
        );
      })}
    </div>
  );
}
