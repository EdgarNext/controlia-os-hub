import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import {
  archiveComboSlotOptionV2Action,
  archiveComboSlotV2Action,
  archiveAssignmentV2Action,
  archiveModifierGroupV2Action,
  archiveModifierOptionV2Action,
  archiveProductV2Action,
  archiveVariantV2Action,
  saveComboSlotOptionV2Action,
  saveComboSlotV2Action,
  saveAssignmentV2Action,
  saveModifierGroupV2Action,
  saveModifierOptionV2Action,
  saveProductV2Action,
  saveVariantV2Action,
} from "@/actions/pos/catalog-v2.actions";
import { ComboSlotOptionV2Form } from "@/components/pos/catalog-v2/ComboSlotOptionV2Form";
import { ComboSlotV2Form } from "@/components/pos/catalog-v2/ComboSlotV2Form";
import { ModifierGroupV2Form } from "@/components/pos/catalog-v2/ModifierGroupV2Form";
import { ModifierOptionV2Form } from "@/components/pos/catalog-v2/ModifierOptionV2Form";
import { AssignmentV2Form } from "@/components/pos/catalog-v2/AssignmentV2Form";
import { ProductV2Form } from "@/components/pos/catalog-v2/ProductV2Form";
import { VariantV2Form } from "@/components/pos/catalog-v2/VariantV2Form";
import {
  listCatalogV2Assignments,
  listCatalogV2CategoriesForSelect,
  listCatalogV2ComboSlotOptions,
  listCatalogV2ComboSlots,
  listCatalogV2ModifierGroups,
  listCatalogV2ModifierOptions,
  listCatalogV2Products,
  listCatalogV2Variants,
  type PosCatalogV2ModifierGroupSelectItem,
  type PosCatalogV2ProductSelectItem,
} from "@/lib/pos/catalog-v2/queries";

type PosCatalogPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CatalogV2PageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      canManage: boolean;
      categories: Awaited<ReturnType<typeof listCatalogV2CategoriesForSelect>>;
      products: Awaited<ReturnType<typeof listCatalogV2Products>>;
      variants: Awaited<ReturnType<typeof listCatalogV2Variants>>;
      modifierGroups: Awaited<ReturnType<typeof listCatalogV2ModifierGroups>>;
      modifierOptions: Awaited<ReturnType<typeof listCatalogV2ModifierOptions>>;
      assignments: Awaited<ReturnType<typeof listCatalogV2Assignments>>;
      comboSlots: Awaited<ReturnType<typeof listCatalogV2ComboSlots>>;
      comboSlotOptions: Awaited<ReturnType<typeof listCatalogV2ComboSlotOptions>>;
      editing: {
        productId: string | null;
        variantId: string | null;
        modifierGroupId: string | null;
        modifierOptionId: string | null;
        assignmentId: string | null;
        comboSlotId: string | null;
        comboSlotOptionId: string | null;
      };
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function isQueryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error;
}

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

async function loadCatalogV2PageData(tenantSlug: string, searchParams: Record<string, string | string[] | undefined>): Promise<CatalogV2PageResult> {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");
    const currentLevel = accessMap.products ?? "none";

    if (!hasModulePageAccess(currentLevel, "read")) {
      return {
        ok: false,
        message: "No tienes permisos para consultar el catálogo POS v2 en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    const [
      categories,
      products,
      variants,
      modifierGroups,
      modifierOptions,
      assignments,
      comboSlots,
      comboSlotOptions,
    ] = await Promise.all([
      listCatalogV2CategoriesForSelect(tenant.tenantId),
      listCatalogV2Products(tenant.tenantId),
      listCatalogV2Variants(tenant.tenantId),
      listCatalogV2ModifierGroups(tenant.tenantId),
      listCatalogV2ModifierOptions(tenant.tenantId),
      listCatalogV2Assignments(tenant.tenantId),
      listCatalogV2ComboSlots(tenant.tenantId),
      listCatalogV2ComboSlotOptions(tenant.tenantId),
    ]);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      canManage: hasModulePageAccess(currentLevel, "manage"),
      categories,
      products,
      variants,
      modifierGroups,
      modifierOptions,
      assignments,
      comboSlots,
      comboSlotOptions,
      editing: {
        productId: toSingleQueryParam(searchParams.productId),
        variantId: toSingleQueryParam(searchParams.variantId),
        modifierGroupId: toSingleQueryParam(searchParams.modifierGroupId),
        modifierOptionId: toSingleQueryParam(searchParams.modifierOptionId),
        assignmentId: toSingleQueryParam(searchParams.assignmentId),
        comboSlotId: toSingleQueryParam(searchParams.comboSlotId),
        comboSlotOptionId: toSingleQueryParam(searchParams.comboSlotOptionId),
      },
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para ver POS en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
    }

    if (isQueryError(error)) {
      throw error;
    }

    return {
      ok: false,
      message: "No pudimos resolver el catálogo POS v2 para este tenant.",
      hint: "Valida el tenantSlug y vuelve a intentar.",
    };
  }
}

function buildCatalogV2Href(tenantSlug: string, hash?: string, query?: Record<string, string | null>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const qs = searchParams.toString();
  return `/${tenantSlug}/pos/catalog${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

function buildSectionTitle(title: string, description: string) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <StatePanel kind="empty" title={title} message={message} />
  );
}

export default async function PosCatalogPage({ params, searchParams }: PosCatalogPageProps) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const result = await loadCatalogV2PageData(tenantSlug, query);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Catálogo v2"
          description="Administración canónica del catálogo configurable POS."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const { tenantSlug: slug, canManage } = result;
  const productsForSelect: PosCatalogV2ProductSelectItem[] = result.products
    .filter((product) => product.deleted_at == null)
    .map((product) => ({
      id: product.id,
      name: product.name,
      product_type: product.product_type,
      category_id: product.category_id,
      is_active: product.is_active,
      deleted_at: product.deleted_at,
    }));
  const modifierGroupSelect: PosCatalogV2ModifierGroupSelectItem[] = result.modifierGroups
    .filter((group) => group.deleted_at == null)
    .map((group) => ({
      id: group.id,
      name: group.name,
      selection_mode: group.selection_mode,
      is_required: group.is_required,
      display_scope: group.display_scope,
      is_active: group.is_active,
      deleted_at: group.deleted_at,
    }));

  const productById = new Map(result.products.map((product) => [product.id, product]));
  const variantsByProductId = result.variants.reduce<Record<string, typeof result.variants>>(
    (accumulator, variant) => {
      if (variant.deleted_at != null) {
        return accumulator;
      }

      accumulator[variant.product_id] = accumulator[variant.product_id] ?? [];
      accumulator[variant.product_id].push(variant);
      return accumulator;
    },
    {},
  );

  const selectedProduct = result.editing.productId ? productById.get(result.editing.productId) ?? null : null;
  const selectedVariant = result.editing.variantId
    ? result.variants.find((variant) => variant.id === result.editing.variantId) ?? null
    : null;
  const selectedModifierGroup = result.editing.modifierGroupId
    ? result.modifierGroups.find((group) => group.id === result.editing.modifierGroupId) ?? null
    : null;
  const selectedModifierOption = result.editing.modifierOptionId
    ? result.modifierOptions.find((option) => option.id === result.editing.modifierOptionId) ?? null
    : null;
  const selectedAssignment = result.editing.assignmentId
    ? result.assignments.find((assignment) => assignment.id === result.editing.assignmentId) ?? null
    : null;
  const selectedComboSlot = result.editing.comboSlotId
    ? result.comboSlots.find((slot) => slot.id === result.editing.comboSlotId) ?? null
    : null;
  const selectedComboSlotOption = result.editing.comboSlotOptionId
    ? result.comboSlotOptions.find((option) => option.id === result.editing.comboSlotOptionId) ?? null
    : null;

  const selectedProductVariants = selectedProduct ? variantsByProductId[selectedProduct.id] ?? [] : [];
  const comboProductsForSelect = productsForSelect.filter((product) => product.product_type === "combo");
  const simpleProductsForSelect = productsForSelect.filter((product) => product.product_type === "simple");
  const configurableVariantsForSelect = result.variants.filter((variant) => {
    if (variant.deleted_at != null) {
      return false;
    }

    const parentProduct = productById.get(variant.product_id);
    return parentProduct?.deleted_at == null && parentProduct?.product_type === "configurable";
  });
  const comboSlotNameById = new Map(result.comboSlots.map((slot) => [slot.id, slot.name]));
  const activeCategoriesCount = result.categories.length;
  const activeProductsCount = result.products.filter((product) => product.deleted_at == null).length;
  const activeVariantsCount = result.variants.filter((variant) => variant.deleted_at == null).length;
  const activeModifierGroupsCount = result.modifierGroups.filter((group) => group.deleted_at == null).length;
  const activeModifierOptionsCount = result.modifierOptions.filter((option) => option.deleted_at == null).length;
  const activeAssignmentsCount = result.assignments.filter((assignment) => assignment.deleted_at == null).length;
  const activeComboSlotsCount = result.comboSlots.filter((slot) => slot.deleted_at == null).length;
  const activeComboSlotOptionsCount = result.comboSlotOptions.filter((option) => option.deleted_at == null).length;

  return (
    <div className="space-y-6">
      <CatalogSectionHeader
        title="POS · Mi catálogo v2"
        description="Administración canónica de categorías, productos simples, configurables, modifiers y combos del POS."
      />

      <Card className="space-y-4 border-border/80 bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Resumen del catálogo</p>
            <h2 className="text-lg font-semibold text-foreground">Accede a cada bloque sin perder contexto</h2>
            <p className="max-w-2xl text-sm text-muted">
              Este tablero reúne la configuración canónica de POS para este tenant y te lleva directo a cada
              sección de trabajo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${slug}/pos/catalog/categories`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Abrir categorías
            </Link>
            <Link
              href={`/${slug}/pos/catalog/products`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Abrir productos
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Categorías</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeCategoriesCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Productos</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeProductsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Variantes</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeVariantsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Modifier groups</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeModifierGroupsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Modifier options</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeModifierOptionsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Asignaciones</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeAssignmentsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Combo slots</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeComboSlotsCount}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted">Combo options</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{activeComboSlotOptionsCount}</p>
          </div>
        </div>
      </Card>

      <section id="products" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionTitle("Productos v2", "Administra el catálogo canónico de productos del POS.")}
        {canManage ? (
          <ProductV2Form
            action={saveProductV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "products")}
            categories={result.categories}
            defaultVariantOptions={selectedProductVariants}
            productId={selectedProduct?.id ?? undefined}
            submitLabel={selectedProduct ? "Actualizar producto" : "Crear producto"}
            initialValues={selectedProduct
              ? {
                  name: selectedProduct.name,
                  category_id: selectedProduct.category_id,
                  product_type: selectedProduct.product_type,
                  class: selectedProduct.class,
                  base_price_cents: selectedProduct.base_price_cents,
                  requires_variant_selection: selectedProduct.requires_variant_selection,
                  default_variant_id: selectedProduct.default_variant_id,
                  is_active: selectedProduct.is_active,
                  is_sold_out: selectedProduct.is_sold_out,
                  is_popular: selectedProduct.is_popular,
                }
              : undefined}
          />
        ) : (
          <StatePanel
            kind="permission"
            title="Solo lectura"
            message="Tienes acceso de lectura, pero no de gestión para productos."
          />
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Variantes</th>
                <th className="px-4 py-3 font-semibold">Modifiers</th>
                <th className="px-4 py-3 font-semibold">Combos</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {result.products.length > 0 ? (
                result.products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted">
                        {product.category_name ?? "Sin categoría"} · {product.class}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{product.product_type}</td>
                    <td className="px-4 py-3 text-muted">{formatMoneyFromCents(product.base_price_cents)}</td>
                    <td className="px-4 py-3 text-muted">{product.variant_count}</td>
                    <td className="px-4 py-3 text-muted">{product.modifier_group_count}</td>
                    <td className="px-4 py-3 text-muted">{product.combo_slot_count}</td>
                    <td className="px-4 py-3">
                      {product.deleted_at ? (
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivado</span>
                      ) : product.is_active ? (
                        <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activo</span>
                      ) : (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "products", { productId: product.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveProductV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="productId" value={product.id} />
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
                  <td colSpan={8} className="px-4 py-6">
                    <EmptyState title="Sin productos" message="Todavía no hay productos configurados." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="variants" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionTitle("Variantes", "Define precios vendibles por producto.")}
        {canManage ? (
          <VariantV2Form
            action={saveVariantV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "variants")}
            products={productsForSelect}
            variantId={selectedVariant?.id ?? undefined}
            submitLabel={selectedVariant ? "Actualizar variante" : "Crear variante"}
            initialValues={selectedVariant
              ? {
                  product_id: selectedVariant.product_id,
                  name: selectedVariant.name,
                  price_cents: selectedVariant.price_cents,
                  is_default: selectedVariant.is_default,
                  is_active: selectedVariant.is_active,
                  sort_order: selectedVariant.sort_order,
                  barcode: selectedVariant.barcode,
                  sku: selectedVariant.sku,
                }
              : undefined}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para variantes." />
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Variante</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {result.variants.length > 0 ? (
                result.variants.map((variant) => (
                  <tr key={variant.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{variant.name}</p>
                      <p className="text-xs text-muted">{variant.id}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {result.products.find((product) => product.id === variant.product_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoneyFromCents(variant.price_cents)}</td>
                    <td className="px-4 py-3 text-muted">{variant.sort_order}</td>
                    <td className="px-4 py-3">
                      {variant.deleted_at ? (
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivada</span>
                      ) : variant.is_default ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">Default</span>
                      ) : variant.is_active ? (
                        <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activa</span>
                      ) : (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactiva</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "variants", { variantId: variant.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveVariantV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="variantId" value={variant.id} />
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
                    <EmptyState title="Sin variantes" message="Todavía no hay variantes para este tenant." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="modifiers" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionTitle("Modificadores", "Agrupa opciones de preparación y personalización.")}
        {canManage ? (
          <ModifierGroupV2Form
            action={saveModifierGroupV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "modifiers")}
            modifierGroupId={selectedModifierGroup?.id ?? undefined}
            submitLabel={selectedModifierGroup ? "Actualizar grupo" : "Crear grupo"}
            initialValues={selectedModifierGroup
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
              : undefined}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para modifier groups." />
        )}

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
              {result.modifierGroups.length > 0 ? (
                result.modifierGroups.map((group) => (
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
                    <td className="px-4 py-3">
                      {group.deleted_at ? (
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivado</span>
                      ) : group.is_required ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">Requerido</span>
                      ) : group.is_active ? (
                        <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activo</span>
                      ) : (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "modifiers", { modifierGroupId: group.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveModifierGroupV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="modifierGroupId" value={group.id} />
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
                    <EmptyState title="Sin modifier groups" message="Todavía no hay grupos configurados." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
              {result.modifierOptions.length > 0 ? (
                result.modifierOptions.map((option) => (
                  <tr key={option.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{option.name}</p>
                      <p className="text-xs text-muted">{option.reporting_key ?? "sin reporting_key"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {result.modifierGroups.find((group) => group.id === option.modifier_group_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoneyFromCents(option.price_delta_cents)}</td>
                    <td className="px-4 py-3 text-muted">{option.is_default ? "Sí" : "No"}</td>
                    <td className="px-4 py-3">
                      {option.deleted_at ? (
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivada</span>
                      ) : option.is_active ? (
                        <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activa</span>
                      ) : (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactiva</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "modifiers", { modifierOptionId: option.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveModifierOptionV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="modifierOptionId" value={option.id} />
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
                    <EmptyState title="Sin modifier options" message="Todavía no hay opciones configuradas." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage ? (
          <ModifierOptionV2Form
            action={saveModifierOptionV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "modifiers")}
            modifierGroups={modifierGroupSelect}
            modifierOptionId={selectedModifierOption?.id ?? undefined}
            submitLabel={selectedModifierOption ? "Actualizar opción" : "Crear opción"}
            initialValues={selectedModifierOption
              ? {
                  modifier_group_id: selectedModifierOption.modifier_group_id,
                  name: selectedModifierOption.name,
                  price_delta_cents: selectedModifierOption.price_delta_cents,
                  is_default: selectedModifierOption.is_default,
                  is_active: selectedModifierOption.is_active,
                  sort_order: selectedModifierOption.sort_order,
                  reporting_key: selectedModifierOption.reporting_key,
                }
              : undefined}
          />
        ) : null}
      </section>

      <section id="assignments" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionTitle("Asignaciones producto ↔ group", "Asigna grupos de modifiers a productos con overrides locales.")}
        {canManage ? (
          <AssignmentV2Form
            action={saveAssignmentV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "assignments")}
            products={productsForSelect}
            modifierGroups={modifierGroupSelect}
            assignmentId={selectedAssignment?.id ?? undefined}
            submitLabel={selectedAssignment ? "Actualizar asignación" : "Crear asignación"}
            initialValues={selectedAssignment
              ? {
                  product_id: selectedAssignment.product_id,
                  modifier_group_id: selectedAssignment.modifier_group_id,
                  is_required_override: selectedAssignment.is_required_override,
                  min_selected_override: selectedAssignment.min_selected_override,
                  max_selected_override: selectedAssignment.max_selected_override,
                  is_active: selectedAssignment.is_active,
                  sort_order: selectedAssignment.sort_order,
                }
              : undefined}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para asignaciones." />
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold">Overrides</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {result.assignments.length > 0 ? (
                result.assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted">
                      {result.products.find((product) => product.id === assignment.product_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {result.modifierGroups.find((group) => group.id === assignment.modifier_group_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {assignment.is_required_override === null ? "req: inherit" : `req: ${String(assignment.is_required_override)}`}
                      <br />
                      min: {assignment.min_selected_override ?? "-"} · max: {assignment.max_selected_override ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">{assignment.sort_order}</td>
                    <td className="px-4 py-3">
                      {assignment.deleted_at ? (
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivada</span>
                      ) : assignment.is_active ? (
                        <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activa</span>
                      ) : (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactiva</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "assignments", { assignmentId: assignment.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveAssignmentV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="assignmentId" value={assignment.id} />
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
                    <EmptyState title="Sin asignaciones" message="Todavía no hay grupos asignados a productos." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="combos" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {buildSectionTitle("Combos", "Administra combos Fase 1 sobre el contrato v2 canónico.")}
        <Card className="space-y-3">
          <div className="text-sm text-muted">
            <p>Slots: {result.comboSlots.length}</p>
            <p>Opciones de slots: {result.comboSlotOptions.length}</p>
          </div>
          <p className="text-sm text-muted">
            Los combos Fase 1 usan `product_type = combo`, precio base propio y slots `single / 1 / 1`.
          </p>
        </Card>

        {canManage ? (
          <ComboSlotV2Form
            action={saveComboSlotV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "combos")}
            comboProducts={comboProductsForSelect}
            comboSlotId={selectedComboSlot?.id ?? undefined}
            submitLabel={selectedComboSlot ? "Actualizar slot" : "Crear slot"}
            initialValues={selectedComboSlot
              ? {
                  product_id: selectedComboSlot.product_id,
                  slot_key: selectedComboSlot.slot_key,
                  name: selectedComboSlot.name,
                  selection_mode: selectedComboSlot.selection_mode,
                  min_selected: selectedComboSlot.min_selected,
                  max_selected: selectedComboSlot.max_selected,
                  is_active: selectedComboSlot.is_active,
                  sort_order: selectedComboSlot.sort_order,
                }
              : undefined}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para combos." />
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Slot</th>
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Opciones</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {result.comboSlots.length > 0 ? (
                result.comboSlots.map((slot) => (
                  <tr key={slot.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{slot.name}</p>
                      <p className="text-xs text-muted">{slot.slot_key}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {result.products.find((product) => product.id === slot.product_id)?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">{slot.option_count}</td>
                    <td className="px-4 py-3 text-muted">{slot.is_active ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildCatalogV2Href(slug, "combos", { comboSlotId: slot.id })}
                          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          Editar
                        </Link>
                        {canManage ? (
                          <form action={archiveComboSlotV2Action}>
                            <input type="hidden" name="tenantSlug" value={slug} />
                            <input type="hidden" name="comboSlotId" value={slot.id} />
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
                  <td colSpan={5} className="px-4 py-6">
                    <EmptyState title="Sin combos" message="No hay slots configurados todavía." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage ? (
          <ComboSlotOptionV2Form
            action={saveComboSlotOptionV2Action}
            tenantSlug={slug}
            cancelHref={buildCatalogV2Href(slug, "combos")}
            comboSlots={result.comboSlots}
            productTargets={simpleProductsForSelect}
            variantTargets={configurableVariantsForSelect}
            comboSlotOptionId={selectedComboSlotOption?.id ?? undefined}
            submitLabel={selectedComboSlotOption ? "Actualizar opción" : "Crear opción"}
            initialValues={selectedComboSlotOption
              ? {
                  combo_slot_id: selectedComboSlotOption.combo_slot_id,
                  name: selectedComboSlotOption.name,
                  linked_product_id: selectedComboSlotOption.linked_product_id,
                  linked_sellable_variant_id: selectedComboSlotOption.linked_sellable_variant_id,
                  price_delta_cents: selectedComboSlotOption.price_delta_cents,
                  is_default: selectedComboSlotOption.is_default,
                  is_active: selectedComboSlotOption.is_active,
                  sort_order: selectedComboSlotOption.sort_order,
                  reporting_key: selectedComboSlotOption.reporting_key,
                }
              : undefined}
          />
        ) : null}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Opción</th>
                <th className="px-4 py-3 font-semibold">Slot</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold">Delta</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {result.comboSlotOptions.length > 0 ? (
                result.comboSlotOptions.map((option) => {
                  const targetLabel = option.linked_product_id
                    ? result.products.find((product) => product.id === option.linked_product_id)?.name ?? "-"
                    : option.linked_sellable_variant_id
                      ? `${result.variants.find((variant) => variant.id === option.linked_sellable_variant_id)?.name ?? "-"} · ${result.products.find((product) => product.id === result.variants.find((variant) => variant.id === option.linked_sellable_variant_id)?.product_id)?.name ?? "-"}`
                      : "-";

                  return (
                    <tr key={option.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{option.name}</p>
                        <p className="text-xs text-muted">{option.reporting_key ?? "sin reporting_key"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{comboSlotNameById.get(option.combo_slot_id) ?? "-"}</td>
                      <td className="px-4 py-3 text-muted">{targetLabel}</td>
                      <td className="px-4 py-3 text-muted">{formatMoneyFromCents(option.price_delta_cents)}</td>
                      <td className="px-4 py-3">
                        {option.deleted_at ? (
                          <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">Archivada</span>
                        ) : option.is_default ? (
                          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">Default</span>
                        ) : option.is_active ? (
                          <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">Activa</span>
                        ) : (
                          <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">Inactiva</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={buildCatalogV2Href(slug, "combos", { comboSlotOptionId: option.id })}
                            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                          >
                            Editar
                          </Link>
                          {canManage ? (
                            <form action={archiveComboSlotOptionV2Action}>
                              <input type="hidden" name="tenantSlug" value={slug} />
                              <input type="hidden" name="comboSlotOptionId" value={option.id} />
                              <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                                Archivar
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <EmptyState title="Sin opciones de combo" message="Todavía no hay opciones configuradas." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Legacy v1 en migración</p>
        <p className="text-sm text-muted">
          Las rutas `/{slug}/pos/catalog/categories` y `/{slug}/pos/catalog/products` siguen disponibles solo para
          compatibilidad temporal. La administración activa ya vive en esta vista v2 y no debe crecer funcionalmente
          sobre el admin legado.
        </p>
      </Card>
    </div>
  );
}
