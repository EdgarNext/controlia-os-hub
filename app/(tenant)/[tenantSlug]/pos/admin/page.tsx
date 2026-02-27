import Link from "next/link";
import { SectionHeader } from "../components/SectionHeader";

const adminSections = [
  {
    path: "kiosks",
    title: "Kiosks",
    description: "Provision and rotate POS device credentials per tenant kiosk.",
  },
  {
    path: "catalog",
    title: "Catalog",
    description: "Manage categories, products, and variants used by offline POS sync.",
  },
  {
    path: "reports",
    title: "Reports",
    description: "Review sales metrics and sync health per kiosk.",
  },
];

type PosAdminPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosAdminPage({ params }: PosAdminPageProps) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="POS Admin"
        description="Tenant-scoped administration for kiosks, catalog, and reporting."
      />

      <div className="grid gap-3 md:grid-cols-3">
        {adminSections.map((section) => (
          <Link
            key={section.path}
            href={`/${tenantSlug}/pos/admin/${section.path}`}
            className="rounded-[var(--radius-base)] border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <p className="text-sm font-semibold text-foreground">{section.title}</p>
            <p className="mt-2 text-sm text-muted">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
