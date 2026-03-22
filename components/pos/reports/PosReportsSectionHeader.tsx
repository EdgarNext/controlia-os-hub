import Link from "next/link";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";

type PosReportsSectionHeaderLink = {
  href: string;
  label: string;
};

type PosReportsSectionHeaderProps = {
  title: string;
  description: string;
  links?: PosReportsSectionHeaderLink[];
};

export function PosReportsSectionHeader({
  title,
  description,
  links = [],
}: PosReportsSectionHeaderProps) {
  return (
    <div className="space-y-3">
      <CatalogSectionHeader title={title} description={description} />
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 text-sm text-foreground transition-colors duration-200 hover:bg-surface"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
