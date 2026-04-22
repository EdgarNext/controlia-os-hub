import Link from "next/link";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { PosUserCreateForm } from "./components/PosUserCreateForm";
import { PosUsersTable } from "./components/PosUsersTable";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { listPosUsersForTenant } from "@/lib/pos/users";

type PosUsersPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type PosUsersPageResult =
  | {
      ok: true;
      tenantSlug: string;
      users: Awaited<ReturnType<typeof listPosUsersForTenant>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosUsersPage(tenantSlug: string): Promise<PosUsersPageResult> {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    if (!tenant.isPlatformOwner) {
      return {
        ok: false,
        message: "Solo Platform Owner puede administrar usuarios POS por ahora.",
        hint: "En esta etapa la pantalla queda reservada para la administración técnica del dispositivo.",
      };
    }

    const users = await listPosUsersForTenant(tenant.tenantId);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      users,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible cargar usuarios POS.",
      hint: "Intenta nuevamente o revisa el acceso del tenant.",
    };
  }
}

export default async function PosUsersPage({ params }: PosUsersPageProps) {
  const { tenantSlug } = await params;
  const result = await loadPosUsersPage(tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="Usuarios POS"
        description="Crea y administra la identidad humana offline que usa el POS para login en Edge."
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${tenantSlug}/pos`}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a POS
        </Link>
        <Link
          href={`/${tenantSlug}/pos/reports/cashiers`}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Ver cajeros
        </Link>
      </div>

      {result.ok ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <StatePanel
              kind="warning"
              title="Hash compatible con Edge"
              message="El PIN que captures aquí se guarda como sha256 y se replica al dispositivo POS para login offline."
            />

            <PosUserCreateForm tenantSlug={result.tenantSlug} />
          </div>

          {result.users.length > 0 ? (
            <PosUsersTable rows={result.users} />
          ) : (
            <StatePanel
              kind="empty"
              title="Sin usuarios POS"
              message="Crea el primer usuario para habilitar el login offline en Edge."
            />
          )}
        </div>
      ) : (
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
