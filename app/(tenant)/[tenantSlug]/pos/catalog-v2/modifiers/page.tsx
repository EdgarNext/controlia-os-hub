import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import {
  archiveModifierGroupV2Action,
  archiveModifierOptionV2Action,
  saveModifierGroupV2Action,
  saveModifierOptionV2Action,
} from "@/actions/pos/catalog-v2.actions";
import { ModifierGroupV2Form } from "@/components/pos/catalog-v2/ModifierGroupV2Form";
import { ModifierOptionV2Form } from "@/components/pos/catalog-v2/ModifierOptionV2Form";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess, resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import {
  getCatalogV2ModifiersPath,
  getCatalogV2ProductsPath,
  getCatalogV2RootPath,
} from "@/lib/pos/catalog-v2/paths";
import {
  listCatalogV2ModifierGroups,
  listCatalogV2ModifierOptions,
  type PosCatalogV2ModifierGroupSelectItem,
} from "@/lib/pos/catalog-v2/queries";

type ModifiersPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CatalogV2ModifiersPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      canManage: boolean;
      modifierGroups: Awaited<ReturnType<typeof listCatalogV2ModifierGroups>>;
      modifierOptions: Awaited<ReturnType<typeof listCatalogV2ModifierOptions>>;
      editing: {
        modifierGroupId: string | null;
        modifierOptionId: string | null;
      };
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function toSingleQueryParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatMoneyFromCents(cents?: number | null): string {
  if (typeof cents !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function buildSectionHeader({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <Link
        href={actionHref}
        className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

async function loadCatalogV2ModifiersPage(
  tenantSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<CatalogV2ModifiersPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
    const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");
    const [modifierGroups, modifierOptions] = await Promise.all([
      listCatalogV2ModifierGroups(tenant.tenantId),
      listCatalogV2ModifierOptions(tenant.tenantId),
    ]);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      canManage: hasModulePageAccess(accessMap.products ?? "none", "manage"),
      modifierGroups,
      modifierOptions,
      editing: {
        modifierGroupId: toSingleQueryParam(searchParams.modifierGroupId),
        modifierOptionId: toSingleQueryParam(searchParams.modifierOptionId),
      },
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar modifiers en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    throw error;
  }
}

export default async function CatalogV2ModifiersPage({ params, searchParams }: ModifiersPageProps) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const result = await loadCatalogV2ModifiersPage(tenantSlug, query);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader title="POS · Modifiers V2" description="Catálogo maestro para grupos y opciones." />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const activeGroups = result.modifierGroups.filter((group) => group.deleted_at == null);
  const activeOptions = result.modifierOptions.filter((option) => option.deleted_at == null);
  const modifierGroupSelect: PosCatalogV2ModifierGroupSelectItem[] = activeGroups.map((group) => ({
    id: group.id,
    name: group.name,
    selection_mode: group.selection_mode,
    is_required: group.is_required,
    display_scope: group.display_scope,
    is_active: group.is_active,
    deleted_at: group.deleted_at,
  }));
  const selectedModifierGroup = result.editing.modifierGroupId
    ? activeGroups.find((group) => group.id === result.editing.modifierGroupId) ?? null
    : null;
  const selectedModifierOption = result.editing.modifierOptionId
    ? activeOptions.find((option) => option.id === result.editing.modifierOptionId) ?? null
    : null;
  const groupsReturnPath = getCatalogV2ModifiersPath(result.tenantSlug, undefined, "groups");
  const optionsReturnPath = getCatalogV2ModifiersPath(result.tenantSlug, undefined, "options");
  const hasGroups = activeGroups.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href={getCatalogV2RootPath(result.tenantSlug)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a Catálogo V2
        </Link>
        <span>/</span>
        <span>Modificadores</span>
      </div>

      <CatalogSectionHeader
        title="POS · Modificadores V2"
        description="Define grupos y opciones reutilizables antes de asignarlos a productos."
      />

      <Card className="space-y-4 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Flujo recomendado</p>
          <h2 className="text-lg font-semibold text-foreground">Primero grupos, luego opciones, después asignación</h2>
          <p className="max-w-3xl text-sm text-muted">
            Los modificadores se administran aquí como catálogo maestro. Desde el detalle del producto solo los asignas y
            ajustas sus overrides locales.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={getCatalogV2ModifiersPath(result.tenantSlug, undefined, "groups")}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a grupos
          </Link>
          <Link
            href={getCatalogV2ModifiersPath(result.tenantSlug, undefined, "options")}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a opciones
          </Link>
          <Link
            href={getCatalogV2ProductsPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a productos
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2 border-border/80 bg-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Grupos</p>
          <p className="text-2xl font-semibold text-foreground">{activeGroups.length}</p>
          <p className="text-sm text-muted">Grupos reutilizables para ingredientes, extras y personalización.</p>
        </Card>
        <Card className="space-y-2 border-border/80 bg-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Opciones</p>
          <p className="text-2xl font-semibold text-foreground">{activeOptions.length}</p>
          <p className="text-sm text-muted">Opciones concretas que se asignan dentro de cada grupo.</p>
        </Card>
        <Card className="space-y-2 border-border/80 bg-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Siguiente paso</p>
          <p className="text-2xl font-semibold text-foreground">{hasGroups ? "Asignar" : "Crear grupo"}</p>
          <p className="text-sm text-muted">
            {hasGroups
              ? "Después asigna los grupos a un producto desde su detalle operativo."
              : "Crea el primer grupo para poder agregar opciones y luego asignarlo a productos."}
          </p>
        </Card>
      </div>

      <Card className="space-y-3 border-border/80 bg-surface p-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="#groups"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Grupos
          </a>
          <a
            href="#options"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Opciones
          </a>
        </div>
        <p className="text-sm text-muted">
          Si ya tienes un producto abierto, vuelve aquí para crear o ajustar sus modificadores maestros. La asignación
          operativa se mantiene en el detalle del producto.
        </p>
      </Card>

      <section id="groups" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionHeader({
          title: "Grupos de modificadores",
          description: "Crea grupos reutilizables para ingredientes, extras o reglas de selección.",
          actionHref: getCatalogV2ModifiersPath(result.tenantSlug, undefined, "groups"),
          actionLabel: "Nuevo grupo",
        })}

        {result.canManage ? (
          <ModifierGroupV2Form
            action={saveModifierGroupV2Action}
            tenantSlug={result.tenantSlug}
            cancelHref={groupsReturnPath}
            returnHref={groupsReturnPath}
            modifierGroupId={selectedModifierGroup?.id ?? undefined}
            submitLabel={selectedModifierGroup ? "Actualizar grupo" : "Crear grupo"}
            initialValues={
              selectedModifierGroup
                ? {
                    name: selectedModifierGroup.name,
                    selection_mode: selectedModifierGroup.selection_mode,
                    is_required: selectedModifierGroup.is_required,
                    min_selected: selectedModifierGroup.min_selected,
                    max_selected: selectedModifierGroup.max_selected,
                    display_scope: selectedModifierGroup.display_scope,
                    is_active: selectedModifierGroup.is_active,
                    sort_order: selectedModifierGroup.sort_order,
                  }
                : undefined
            }
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para los grupos de modificadores." />
        )}

        {activeGroups.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Todavía no hay grupos"
            message="Crea el primer grupo para poder agregarle opciones y reutilizarlo después en productos."
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Grupo</th>
                  <th className="px-4 py-3 font-semibold">Selección</th>
                  <th className="px-4 py-3 font-semibold">Rango</th>
                  <th className="px-4 py-3 font-semibold">Opciones</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeGroups.map((group) => (
                  <tr key={group.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{group.name}</p>
                      <p className="text-xs text-muted">{group.display_scope}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{group.selection_mode}</td>
                    <td className="px-4 py-3 text-muted">
                      {group.min_selected} - {group.max_selected}
                    </td>
                    <td className="px-4 py-3 text-muted">{group.option_count}</td>
                    <td className="px-4 py-3 text-muted">
                      {group.deleted_at ? "Archivado" : group.is_required ? "Requerido" : group.is_active ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={getCatalogV2ModifiersPath(result.tenantSlug, { modifierGroupId: group.id }, "groups")}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {result.canManage ? (
                          <form action={archiveModifierGroupV2Action}>
                            <input type="hidden" name="tenantSlug" value={result.tenantSlug} />
                            <input type="hidden" name="modifierGroupId" value={group.id} />
                            <input type="hidden" name="returnPath" value={groupsReturnPath} />
                            <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                              Archivar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="options" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionHeader({
          title: "Opciones de modificadores",
          description: "Agrega opciones dentro de un grupo para construir el comportamiento real del producto.",
          actionHref: getCatalogV2ModifiersPath(result.tenantSlug, undefined, "options"),
          actionLabel: "Nueva opción",
        })}

        {hasGroups ? (
          result.canManage ? (
            <ModifierOptionV2Form
              action={saveModifierOptionV2Action}
              tenantSlug={result.tenantSlug}
              cancelHref={optionsReturnPath}
              returnHref={optionsReturnPath}
              modifierGroups={modifierGroupSelect}
              modifierOptionId={selectedModifierOption?.id ?? undefined}
              submitLabel={selectedModifierOption ? "Actualizar opción" : "Crear opción"}
              initialValues={
                selectedModifierOption
                  ? {
                      modifier_group_id: selectedModifierOption.modifier_group_id,
                      name: selectedModifierOption.name,
                      price_delta_cents: selectedModifierOption.price_delta_cents,
                      is_default: selectedModifierOption.is_default,
                      is_active: selectedModifierOption.is_active,
                      sort_order: selectedModifierOption.sort_order,
                      reporting_key: selectedModifierOption.reporting_key,
                    }
                  : undefined
              }
            />
          ) : (
            <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para las opciones de modificadores." />
          )
        ) : (
          <StatePanel
            kind="warning"
            title="Primero crea un grupo"
            message="Las opciones dependen de un grupo. Crea al menos uno arriba para habilitar esta sección."
          >
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={getCatalogV2ModifiersPath(result.tenantSlug, undefined, "groups")}
                className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
              >
                Crear grupo
              </Link>
            </div>
          </StatePanel>
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Opción</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold">Delta</th>
                <th className="px-4 py-3 font-semibold">Default</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activeOptions.length > 0 ? (
                activeOptions.map((option) => (
                  <tr key={option.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{option.name}</p>
                      <p className="text-xs text-muted">{option.reporting_key ?? "sin reporting_key"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {activeGroups.find((group) => group.id === option.modifier_group_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoneyFromCents(option.price_delta_cents)}</td>
                    <td className="px-4 py-3 text-muted">{option.is_default ? "Sí" : "No"}</td>
                    <td className="px-4 py-3 text-muted">
                      {option.deleted_at ? "Archivada" : option.is_active ? "Activa" : "Inactiva"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={getCatalogV2ModifiersPath(result.tenantSlug, { modifierOptionId: option.id }, "options")}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {result.canManage ? (
                          <form action={archiveModifierOptionV2Action}>
                            <input type="hidden" name="tenantSlug" value={result.tenantSlug} />
                            <input type="hidden" name="modifierOptionId" value={option.id} />
                            <input type="hidden" name="returnPath" value={optionsReturnPath} />
                            <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                              Archivar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <StatePanel
                      kind="empty"
                      title="Todavía no hay opciones"
                      message={hasGroups ? "Crea la primera opción usando el formulario superior." : "Primero crea un grupo para habilitar las opciones."}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
