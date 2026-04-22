import Link from "next/link";
import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import {
  archiveComboSlotOptionV2Action,
  archiveComboSlotV2Action,
  archiveAssignmentV2Action,
  archiveVariantV2Action,
  saveComboSlotOptionV2Action,
  saveComboSlotV2Action,
  saveAssignmentV2Action,
  saveProductV2Action,
  saveVariantV2Action,
} from "@/actions/pos/catalog-v2.actions";
import { updateProductAction } from "@/actions/pos/catalog/products.actions";
import { AssignmentV2Form } from "@/components/pos/catalog-v2/AssignmentV2Form";
import { ComboSlotOptionV2Form } from "@/components/pos/catalog-v2/ComboSlotOptionV2Form";
import { ComboSlotV2Form } from "@/components/pos/catalog-v2/ComboSlotV2Form";
import { ProductV2Form } from "@/components/pos/catalog-v2/ProductV2Form";
import { VariantV2Form } from "@/components/pos/catalog-v2/VariantV2Form";
import { ProductForm } from "@/components/pos/catalog/ProductForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess, resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import {
  listCatalogCategoriesForSelect as listLegacyCatalogCategoriesForSelect,
  listCatalogProducts,
} from "@/lib/pos/catalog/queries";
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
  type PosCatalogV2VariantSelectItem,
} from "@/lib/pos/catalog-v2/queries";

type ProductDetailPageProps = {
  params: Promise<{ tenantSlug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProductDetailPageResult =
  | {
      ok: true;
      mode: "v2";
      tenantSlug: string;
      tenantName: string;
      canManage: boolean;
      product: Awaited<ReturnType<typeof listCatalogV2Products>>[number];
      categories: Awaited<ReturnType<typeof listCatalogV2CategoriesForSelect>>;
      products: Awaited<ReturnType<typeof listCatalogV2Products>>;
      variants: Awaited<ReturnType<typeof listCatalogV2Variants>>;
      modifierGroups: Awaited<ReturnType<typeof listCatalogV2ModifierGroups>>;
      modifierOptions: Awaited<ReturnType<typeof listCatalogV2ModifierOptions>>;
      assignments: Awaited<ReturnType<typeof listCatalogV2Assignments>>;
      comboSlots: Awaited<ReturnType<typeof listCatalogV2ComboSlots>>;
      comboSlotOptions: Awaited<ReturnType<typeof listCatalogV2ComboSlotOptions>>;
      editing: {
        variantId: string | null;
        assignmentId: string | null;
        comboSlotId: string | null;
        comboSlotOptionId: string | null;
      };
    }
  | {
      ok: true;
      mode: "legacy";
      tenantSlug: string;
      tenantName: string;
      canManage: boolean;
      product: Awaited<ReturnType<typeof listCatalogProducts>>[number];
      categories: Awaited<ReturnType<typeof listLegacyCatalogCategoriesForSelect>>;
      legacyProducts: Awaited<ReturnType<typeof listCatalogProducts>>;
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

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("es-MX");
}

function buildProductDetailHref(
  tenantSlug: string,
  productId: string,
  section?: string,
  query?: Record<string, string | null>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const qs = searchParams.toString();
  return `/${tenantSlug}/pos/catalog/products/${productId}${qs ? `?${qs}` : ""}${section ? `#${section}` : ""}`;
}

function SectionHeaderBar({
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

async function loadProductDetailPageData(
  tenantSlug: string,
  productId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ProductDetailPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
    const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");
    const currentLevel = accessMap.products ?? "none";

    if (!hasModulePageAccess(currentLevel, "read")) {
      return {
        ok: false,
        message: "No tienes permisos para consultar el detalle de productos POS en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    // Etapa 1 de la migración UX: esta vista convive con el flujo legado y solo reutiliza la capa v2 existente.
    const [categories, products, variants, modifierGroups, modifierOptions, assignments, comboSlots, comboSlotOptions] =
      await Promise.all([
        listCatalogV2CategoriesForSelect(tenant.tenantId),
        listCatalogV2Products(tenant.tenantId),
        listCatalogV2Variants(tenant.tenantId),
        listCatalogV2ModifierGroups(tenant.tenantId),
        listCatalogV2ModifierOptions(tenant.tenantId),
        listCatalogV2Assignments(tenant.tenantId),
        listCatalogV2ComboSlots(tenant.tenantId),
        listCatalogV2ComboSlotOptions(tenant.tenantId),
      ]);

    const product = products.find((item) => item.id === productId) ?? null;
    if (product) {
      return {
        ok: true,
        mode: "v2",
        tenantSlug: tenant.tenantSlug,
        tenantName: tenant.tenantName,
        canManage: hasModulePageAccess(currentLevel, "manage"),
        product,
        categories,
        products,
        variants,
        modifierGroups,
        modifierOptions,
        assignments,
        comboSlots,
        comboSlotOptions,
        editing: {
          variantId: toSingleQueryParam(searchParams.variantId),
          assignmentId: toSingleQueryParam(searchParams.assignmentId),
          comboSlotId: toSingleQueryParam(searchParams.comboSlotId),
          comboSlotOptionId: toSingleQueryParam(searchParams.comboSlotOptionId),
        },
      };
    }

    const [legacyCategories, legacyProducts] = await Promise.all([
      listLegacyCatalogCategoriesForSelect({ tenantId: tenant.tenantId }),
      listCatalogProducts({ tenantId: tenant.tenantId }),
    ]);
    const legacyProduct = legacyProducts.find((item) => item.id === productId) ?? null;

    if (!legacyProduct) {
      notFound();
    }

    return {
      ok: true,
      mode: "legacy",
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      canManage: hasModulePageAccess(currentLevel, "manage"),
      product: legacyProduct,
      categories: legacyCategories,
      legacyProducts,
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
      message: "No pudimos resolver el detalle del producto para este tenant.",
      hint: "Valida el tenantSlug y el productId, luego vuelve a intentar.",
    };
  }
}

function getDisplayValue(value?: string | null): string {
  return value && value.trim().length > 0 ? value : "-";
}

function LegacyCatalogDetail({
  slug,
  tenantName,
  product,
  categories,
  canManage,
}: {
  slug: string;
  tenantName: string;
  product: Awaited<ReturnType<typeof listCatalogProducts>>[number];
  categories: Awaited<ReturnType<typeof listLegacyCatalogCategoriesForSelect>>;
  canManage: boolean;
}) {
  const productCategory = product.category_id
    ? categories.find((category) => category.id === product.category_id) ?? null
    : null;
  const displayType = product.type ?? "legacy";
  const displayClass = product.class === "drink" ? "Bebida" : "Alimento";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href={`/${slug}/pos/catalog/products`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a productos
        </Link>
        <span>/</span>
        <span>Compatibilidad legado</span>
      </div>

      <CatalogSectionHeader
        title="POS · Detalle operativo de producto"
        description="Esta vista resuelve productos del catálogo legado mientras convive la migración a v2."
      />

      <StatePanel
        kind="warning"
        title="Este producto todavía vive en el catálogo legado"
        message="Puedes editar su información básica desde esta pantalla, pero las secciones nuevas de variantes, modifiers y combos se consolidarán cuando el producto migre a POS Catálogo v2."
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${slug}/pos/catalog/products`}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Ir a productos
          </Link>
          <Link
            href={`/${slug}/pos/catalog/products/${product.id}/edit`}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Abrir edición clásica
          </Link>
        </div>
      </StatePanel>

      <Card className="space-y-4 border-border/80 bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Producto legado</p>
            <h2 className="text-2xl font-semibold text-foreground">{product.name}</h2>
            <p className="text-sm text-muted">Tenant: {tenantName}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              catálogo clásico
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {displayType}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {displayClass}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {product.is_active ? "Activo" : "Inactivo"}
            </span>
            {product.deleted_at ? (
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
                Archivado
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Categoría</p>
            <p className="text-sm font-medium text-foreground">{productCategory?.name ?? "Sin categoría"}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Precio</p>
            <p className="text-sm font-medium text-foreground">{formatMoneyFromCents(product.price_cents)}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Actualizado</p>
            <p className="text-sm font-medium text-foreground">{formatDateTime(product.updated_at)}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Imagen</p>
            <p className="text-sm font-medium text-foreground">{product.image_path ? "Sí" : "No"}</p>
          </div>
        </div>
      </Card>

      <section
        id="general"
        className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4"
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Información general</h3>
          <p className="text-sm text-muted">
            Esta sección reutiliza el formulario clásico para mantener la compatibilidad mientras migramos el flujo.
          </p>
        </div>

        {canManage ? (
          <ProductForm
            action={updateProductAction}
            tenantSlug={slug}
            cancelHref={`/${slug}/pos/catalog/products`}
            categories={categories}
            productId={product.id}
            submitLabel="Guardar producto legado"
            initialValues={{
              name: product.name,
              category_id: product.category_id,
              class: product.class === "drink" ? "drink" : "food",
              price_cents: product.price_cents,
              is_active: product.is_active,
            }}
            initialImagePath={product.image_path}
          />
        ) : (
          <StatePanel
            kind="permission"
            title="Solo lectura"
            message="Tienes acceso de lectura, pero no de gestión para este producto legado."
          />
        )}
      </section>

      <section id="variants" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <SectionHeaderBar
          title="Variantes"
          description="Este producto todavía no usa la estructura v2 de variantes. Cuando migre, aquí aparecerá la configuración operativa."
          actionHref={`/${slug}/pos/catalog/products`}
          actionLabel="Ir a productos"
        />
        <StatePanel
          kind="empty"
          title="Variantes pendientes de migración"
          message="Las variantes operativas quedan disponibles cuando este producto se modela en POS Catálogo v2."
        >
          <p className="text-xs text-muted">
            Hoy puedes seguir administrando el producto básico desde la vista clásica o abrir el editor legado.
          </p>
        </StatePanel>
      </section>

      <section id="modifiers" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <SectionHeaderBar
          title="Modifiers"
          description="La asignación de groups y options se administra en v2. Este producto aún no expone esa configuración en la ruta nueva."
          actionHref={`/${slug}/pos/catalog#modifiers`}
          actionLabel="Administración global"
        />
        <StatePanel
          kind="empty"
          title="Modifiers pendientes de migración"
          message="La vinculación operativa de modifiers se activará cuando este producto esté modelado con la nueva arquitectura."
        >
          <p className="text-xs text-muted">
            Mientras tanto, la administración global de grupos y opciones sigue disponible en el catálogo POS v2.
          </p>
        </StatePanel>
      </section>

      <section id="combos" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <SectionHeaderBar
          title="Combos"
          description="La lógica de slots y opciones depende del modelo v2. En legacy solo verás contexto y salida clara."
          actionHref={`/${slug}/pos/catalog/products`}
          actionLabel="Ir a productos"
        />
        <StatePanel
          kind="empty"
          title="Combos pendientes de migración"
          message="Los slots y sus opciones se editarán aquí cuando este producto participe en la arquitectura nueva."
        >
          <p className="text-xs text-muted">
            Si necesitas revisar el flujo clásico, usa la edición legada de este producto.
          </p>
        </StatePanel>
      </section>
    </div>
  );
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { tenantSlug, id: productId } = await params;
  const query = await searchParams;
  const result = await loadProductDetailPageData(tenantSlug, productId, query);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Detalle operativo de producto"
          description="Vista centrada en un producto del catálogo POS v2."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  if (result.mode === "legacy") {
    return (
      <LegacyCatalogDetail
        slug={result.tenantSlug}
        tenantName={result.tenantName}
        product={result.product}
        categories={result.categories}
        canManage={result.canManage}
      />
    );
  }

  const { tenantSlug: slug, product, categories, products, variants, modifierGroups, modifierOptions, assignments, comboSlots, comboSlotOptions, canManage } =
    result;
  const productCategory = product.category_id
    ? categories.find((category) => category.id === product.category_id) ?? null
    : null;
  const productVariants = variants.filter((variant) => variant.product_id === product.id);
  const productAssignments = assignments.filter((assignment) => assignment.product_id === product.id);
  const productAssignmentGroupIds = new Set(productAssignments.map((assignment) => assignment.modifier_group_id));
  const productModifierGroups = modifierGroups.filter((group) => productAssignmentGroupIds.has(group.id));
  const productModifierOptions = modifierOptions.filter((option) => productAssignmentGroupIds.has(option.modifier_group_id));
  const productComboSlots = comboSlots.filter((slot) => slot.product_id === product.id);
  const productComboSlotIds = new Set(productComboSlots.map((slot) => slot.id));
  const productComboSlotOptions = comboSlotOptions.filter((option) => productComboSlotIds.has(option.combo_slot_id));
  const currentVariant = result.editing.variantId
    ? productVariants.find((variant) => variant.id === result.editing.variantId) ?? null
    : null;
  const currentAssignment = result.editing.assignmentId
    ? productAssignments.find((assignment) => assignment.id === result.editing.assignmentId) ?? null
    : null;
  const currentComboSlot = result.editing.comboSlotId
    ? productComboSlots.find((slot) => slot.id === result.editing.comboSlotId) ?? null
    : null;
  const currentComboSlotOption = result.editing.comboSlotOptionId
    ? productComboSlotOptions.find((option) => option.id === result.editing.comboSlotOptionId) ?? null
    : null;
  const productSelect: PosCatalogV2ProductSelectItem[] = [
    {
      id: product.id,
      name: product.name,
      product_type: product.product_type,
      category_id: product.category_id,
      is_active: product.is_active,
      deleted_at: product.deleted_at,
    },
  ];
  const variantOptions: PosCatalogV2VariantSelectItem[] = productVariants.filter((variant) => variant.deleted_at == null);
  const modifierGroupSelect: PosCatalogV2ModifierGroupSelectItem[] = modifierGroups
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
  const simpleProductsForComboTargets = products.filter(
    (item) => item.deleted_at == null && item.product_type === "simple",
  );
  const configurableVariantsForComboTargets = variants.filter((variant) => {
    if (variant.deleted_at != null) {
      return false;
    }

    const parentProduct = products.find((item) => item.id === variant.product_id);
    return parentProduct?.deleted_at == null && parentProduct?.product_type === "configurable";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href={`/${slug}/pos/catalog/products`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a productos
        </Link>
        <span>/</span>
        <span>Detalle operativo</span>
      </div>

      <CatalogSectionHeader
        title="POS · Detalle operativo de producto"
        description="Vista centrada en un producto del catálogo POS v2."
      />

      <Card className="space-y-4 border-border/80 bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Producto activo</p>
            <h2 className="text-2xl font-semibold text-foreground">{product.name}</h2>
            <p className="text-sm text-muted">Tenant: {result.tenantName}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {product.product_type}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {product.class === "drink" ? "Bebida" : "Alimento"}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
              {product.is_active ? "Activo" : "Inactivo"}
            </span>
            {product.deleted_at ? (
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
                Archivado
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Categoría</p>
            <p className="text-sm font-medium text-foreground">{productCategory?.name ?? "Sin categoría"}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Precio base</p>
            <p className="text-sm font-medium text-foreground">{formatMoneyFromCents(product.base_price_cents)}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Variantes</p>
            <p className="text-sm font-medium text-foreground">{productVariants.length}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Modifiers vinculados</p>
            <p className="text-sm font-medium text-foreground">{productAssignments.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Default variant</p>
            <p className="text-sm font-medium text-foreground">
              {product.default_variant_id
                ? productVariants.find((variant) => variant.id === product.default_variant_id)?.name ??
                  getDisplayValue(product.default_variant_id)
                : "Sin variante"}
            </p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Popular</p>
            <p className="text-sm font-medium text-foreground">{product.is_popular ? "Sí" : "No"}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Agotado</p>
            <p className="text-sm font-medium text-foreground">{product.is_sold_out ? "Sí" : "No"}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Actualizado</p>
            <p className="text-sm font-medium text-foreground">{formatDateTime(product.updated_at)}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Combo slots</p>
            <p className="text-sm font-medium text-foreground">{productComboSlots.length}</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 border-t border-border pt-3 text-sm">
          <a
            href="#general"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Información general
          </a>
          <a
            href="#variants"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Variantes
          </a>
          <a
            href="#modifiers"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Modifiers
          </a>
          <a
            href="#combos"
            className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
          >
            Combos
          </a>
        </nav>
      </Card>

      <section id="general" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Información general</h3>
          <p className="text-sm text-muted">
            Esta vista reutiliza el formulario v2 existente para no duplicar el contrato de producto.
          </p>
        </div>

        {canManage ? (
          <ProductV2Form
            action={saveProductV2Action}
            tenantSlug={slug}
            cancelHref={`/${slug}/pos/catalog/products`}
            categories={categories}
            defaultVariantOptions={variantOptions}
            productId={product.id}
            submitLabel="Guardar producto"
            initialValues={{
              name: product.name,
              category_id: product.category_id,
              product_type: product.product_type,
              class: product.class,
              base_price_cents: product.base_price_cents,
              requires_variant_selection: product.requires_variant_selection,
              default_variant_id: product.default_variant_id,
              is_active: product.is_active,
              is_sold_out: product.is_sold_out,
              is_popular: product.is_popular,
            }}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para este producto." />
        )}
      </section>

      <section id="variants" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <SectionHeaderBar
          title="Variantes"
          description="Variantes vendibles ligadas al producto actual. Crea la primera variante desde este bloque y después edítala aquí mismo."
          actionHref={buildProductDetailHref(slug, product.id, "variants")}
          actionLabel="Nueva variante"
        />

        <Card className="border-border/80 bg-surface-2">
          <p className="text-sm text-muted">
            Si este producto necesita tamaños, presentaciones o precios alternos, este es el punto de trabajo. La
            tabla de abajo sirve como selector y el formulario superior como editor.
          </p>
        </Card>

        {canManage ? (
          <VariantV2Form
            action={saveVariantV2Action}
            tenantSlug={slug}
            cancelHref={`/${slug}/pos/catalog/products/${product.id}#variants`}
            products={productSelect}
            variantId={currentVariant?.id ?? undefined}
            submitLabel={currentVariant ? "Actualizar variante" : "Crear variante"}
            initialValues={currentVariant
              ? {
                  product_id: currentVariant.product_id,
                  name: currentVariant.name,
                  price_cents: currentVariant.price_cents,
                  is_default: currentVariant.is_default,
                  is_active: currentVariant.is_active,
                  sort_order: currentVariant.sort_order,
                  barcode: currentVariant.barcode,
                  sku: currentVariant.sku,
                }
              : {
                  product_id: product.id,
                  name: "",
                  price_cents: 0,
                  is_default: false,
                  is_active: true,
                  sort_order: 0,
                  barcode: null,
                  sku: null,
                }}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para variantes." />
        )}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Variante</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productVariants.length > 0 ? (
                productVariants.map((variant) => (
                  <tr key={variant.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{variant.name}</p>
                      <p className="text-xs text-muted">{variant.barcode ?? variant.sku ?? variant.id}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatMoneyFromCents(variant.price_cents)}</td>
                    <td className="px-4 py-3 text-muted">{variant.sort_order}</td>
                    <td className="px-4 py-3 text-muted">
                      {variant.deleted_at ? "Archivada" : variant.is_default ? "Default" : variant.is_active ? "Activa" : "Inactiva"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={buildProductDetailHref(slug, product.id, "variants", { variantId: variant.id })}
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
                  <td colSpan={5} className="px-4 py-6">
                    <StatePanel
                      kind="empty"
                      title="Sin variantes todavía"
                      message="Este producto aún no tiene variantes. Usa el formulario superior para crear la primera."
                    >
                      <p className="text-xs text-muted">
                        Cuando exista al menos una variante, podrás editarla desde esta tabla o abrir otra nueva desde el
                        botón superior.
                      </p>
                    </StatePanel>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="modifiers" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Modifiers</h3>
            <p className="text-sm text-muted">
              Aquí administras las asignaciones que vinculan grupos globales al producto actual.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildProductDetailHref(slug, product.id, "modifiers")}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Nueva asignación
            </Link>
            <Link
              href={`/${slug}/pos/catalog#modifiers`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Administración global
            </Link>
          </div>
        </div>

        <Card className="space-y-3 border-border/80 bg-surface-2">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Grupos asignados</p>
              <p className="text-sm font-medium text-foreground">{productModifierGroups.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Opciones visibles por herencia</p>
              <p className="text-sm font-medium text-foreground">{productModifierOptions.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Asignaciones activas</p>
              <p className="text-sm font-medium text-foreground">{productAssignments.length}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Los grupos y opciones siguen viviendo globalmente en POS Catálogo v2. En esta pantalla solo trabajas la
            vinculación del producto y sus overrides locales.
          </p>
        </Card>

        {canManage ? (
          <AssignmentV2Form
            action={saveAssignmentV2Action}
            tenantSlug={slug}
            cancelHref={`/${slug}/pos/catalog/products/${product.id}#modifiers`}
            products={productSelect}
            modifierGroups={modifierGroupSelect}
            assignmentId={currentAssignment?.id ?? undefined}
            submitLabel={currentAssignment ? "Actualizar asignación" : "Crear asignación"}
            initialValues={currentAssignment
              ? {
                  product_id: currentAssignment.product_id,
                  modifier_group_id: currentAssignment.modifier_group_id,
                  is_required_override: currentAssignment.is_required_override,
                  min_selected_override: currentAssignment.min_selected_override,
                  max_selected_override: currentAssignment.max_selected_override,
                  is_active: currentAssignment.is_active,
                  sort_order: currentAssignment.sort_order,
                }
              : {
                  product_id: product.id,
                  modifier_group_id: "",
                  is_required_override: null,
                  min_selected_override: null,
                  max_selected_override: null,
                  is_active: true,
                  sort_order: 0,
                }}
          />
        ) : (
          <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para las asignaciones del producto." />
        )}

        {productAssignments.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Sin grupos asignados todavía"
            message="Este producto aún no tiene modifiers vinculados. El formulario superior ya está listo para crear la primera asignación."
          >
            <p className="text-xs text-muted">
              Si necesitas ajustar grupos u opciones globales, usa el acceso a la administración global.
            </p>
          </StatePanel>
        ) : null}

        <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold">Overrides</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productAssignments.length > 0 ? (
                productAssignments.map((assignment) => {
                  const group = modifierGroups.find((item) => item.id === assignment.modifier_group_id) ?? null;

                  return (
                    <tr key={assignment.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{group?.name ?? "-"}</p>
                        <p className="text-xs text-muted">{group?.display_scope ?? "sin scope"}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        req: {assignment.is_required_override === null ? "inherit" : assignment.is_required_override ? "sí" : "no"}
                        <br />
                        min: {assignment.min_selected_override ?? "-"} · max: {assignment.max_selected_override ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {assignment.deleted_at ? "Archivada" : assignment.is_active ? "Activa" : "Inactiva"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={buildProductDetailHref(slug, product.id, "modifiers", { assignmentId: assignment.id })}
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6">
                    <StatePanel kind="empty" title="Sin asignaciones" message="Este producto todavía no tiene modifiers vinculados." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Card className="border-border/80 bg-surface-2">
          <p className="text-sm text-muted">
            Cuando archivas una asignación aquí, solo desactivas la relación producto-grupo. El grupo global y sus
            opciones siguen existiendo en el catálogo de modifiers.
          </p>
        </Card>
      </section>

      <section id="combos" className="scroll-mt-24 space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Combos</h3>
            <p className="text-sm text-muted">
              Los combos se configuran solo cuando el producto opera como combo. Aquí empiezas con slots y después con
              sus opciones.
            </p>
          </div>

          {product.product_type === "combo" ? (
            <Link
              href={buildProductDetailHref(slug, product.id, "combos")}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Nuevo slot
            </Link>
          ) : (
            <Link
              href={buildProductDetailHref(slug, product.id, "general")}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Ir a información general
            </Link>
          )}
        </div>

        <Card className="border-border/80 bg-surface-2">
          {product.product_type === "combo" ? (
            <p className="text-sm text-muted">
              Este producto ya puede recibir slots. Crea uno primero y luego define sus opciones.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Este producto todavía no es combo. Si necesitas habilitar esa lógica, cambia su tipo en Información
              general y luego vuelve aquí.
            </p>
          )}
        </Card>

        {product.product_type === "combo" ? (
          <>
            <SectionHeaderBar
              title="Slots"
              description="Un slot define una parte del combo. Crea el primero desde este bloque."
              actionHref={buildProductDetailHref(slug, product.id, "combos")}
              actionLabel="Nuevo slot"
            />

            {canManage ? (
              <ComboSlotV2Form
                action={saveComboSlotV2Action}
                tenantSlug={slug}
                cancelHref={`/${slug}/pos/catalog/products/${product.id}#combos`}
                comboProducts={[
                  {
                    id: product.id,
                    name: product.name,
                    product_type: product.product_type,
                    category_id: product.category_id,
                    is_active: product.is_active,
                    deleted_at: product.deleted_at,
                  },
                ]}
                comboSlotId={currentComboSlot?.id ?? undefined}
                submitLabel={currentComboSlot ? "Actualizar slot" : "Crear slot"}
                initialValues={currentComboSlot
                  ? {
                      product_id: currentComboSlot.product_id,
                      slot_key: currentComboSlot.slot_key,
                      name: currentComboSlot.name,
                      selection_mode: currentComboSlot.selection_mode,
                      min_selected: currentComboSlot.min_selected,
                      max_selected: currentComboSlot.max_selected,
                      is_active: currentComboSlot.is_active,
                      sort_order: currentComboSlot.sort_order,
                    }
                  : {
                      product_id: product.id,
                      slot_key: "",
                      name: "",
                      selection_mode: "single",
                      min_selected: 1,
                      max_selected: 1,
                      is_active: true,
                      sort_order: 0,
                    }}
              />
            ) : (
              <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para los slots del combo." />
            )}

            <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Slot</th>
                    <th className="px-4 py-3 font-semibold">Opciones</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productComboSlots.length > 0 ? (
                    productComboSlots.map((slot) => {
                      const slotOptionCount = productComboSlotOptions.filter((option) => option.combo_slot_id === slot.id).length;

                      return (
                        <tr key={slot.id} className="border-t border-border">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{slot.name}</p>
                            <p className="text-xs text-muted">{slot.slot_key}</p>
                          </td>
                          <td className="px-4 py-3 text-muted">{slotOptionCount}</td>
                          <td className="px-4 py-3 text-muted">{slot.is_active ? "Activo" : "Inactivo"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={buildProductDetailHref(slug, product.id, "combos", { comboSlotId: slot.id })}
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
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6">
                        <StatePanel
                          kind="empty"
                          title="Sin slots todavía"
                          message="Todavía no hay slots para este combo. Usa el formulario superior para crear el primero."
                        >
                          <p className="text-xs text-muted">
                            Después de crear un slot, podrás añadir opciones y asignar productos o variantes.
                          </p>
                        </StatePanel>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {productComboSlots.length > 0 ? (
              <>
                <SectionHeaderBar
                  title="Opciones de slot"
                  description="Cada opción apunta a un producto simple o a una variante configurable."
                  actionHref={buildProductDetailHref(slug, product.id, "combos")}
                  actionLabel="Nueva opción"
                />

                {canManage ? (
                  <ComboSlotOptionV2Form
                    action={saveComboSlotOptionV2Action}
                    tenantSlug={slug}
                    cancelHref={`/${slug}/pos/catalog/products/${product.id}#combos`}
                    comboSlots={productComboSlots}
                    productTargets={simpleProductsForComboTargets}
                    variantTargets={configurableVariantsForComboTargets}
                    comboSlotOptionId={currentComboSlotOption?.id ?? undefined}
                    submitLabel={currentComboSlotOption ? "Actualizar opción" : "Crear opción"}
                    initialValues={currentComboSlotOption
                      ? {
                          combo_slot_id: currentComboSlotOption.combo_slot_id,
                          name: currentComboSlotOption.name,
                          linked_product_id: currentComboSlotOption.linked_product_id,
                          linked_sellable_variant_id: currentComboSlotOption.linked_sellable_variant_id,
                          price_delta_cents: currentComboSlotOption.price_delta_cents,
                          is_default: currentComboSlotOption.is_default,
                          is_active: currentComboSlotOption.is_active,
                          sort_order: currentComboSlotOption.sort_order,
                          reporting_key: currentComboSlotOption.reporting_key,
                        }
                      : {
                          combo_slot_id: productComboSlots[0]?.id ?? "",
                          name: "",
                          linked_product_id: null,
                          linked_sellable_variant_id: null,
                          price_delta_cents: 0,
                          is_default: false,
                          is_active: true,
                          sort_order: 0,
                          reporting_key: null,
                        }}
                  />
                ) : (
                  <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso de lectura, pero no de gestión para las opciones del combo." />
                )}

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
                      {productComboSlotOptions.length > 0 ? (
                        productComboSlotOptions.map((option) => {
                          const targetLabel = option.linked_product_id
                            ? products.find((item) => item.id === option.linked_product_id)?.name ?? "-"
                            : option.linked_sellable_variant_id
                              ? `${variants.find((variant) => variant.id === option.linked_sellable_variant_id)?.name ?? "-"} · ${products.find((item) => item.id === variants.find((variant) => variant.id === option.linked_sellable_variant_id)?.product_id)?.name ?? "-"}`
                              : "-";

                          return (
                            <tr key={option.id} className="border-t border-border">
                              <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{option.name}</p>
                                <p className="text-xs text-muted">{option.reporting_key ?? "sin reporting_key"}</p>
                              </td>
                              <td className="px-4 py-3 text-muted">
                                {productComboSlots.find((slot) => slot.id === option.combo_slot_id)?.name ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-muted">{targetLabel}</td>
                              <td className="px-4 py-3 text-muted">{formatMoneyFromCents(option.price_delta_cents)}</td>
                              <td className="px-4 py-3 text-muted">
                                {option.deleted_at ? "Archivada" : option.is_default ? "Default" : option.is_active ? "Activa" : "Inactiva"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    href={buildProductDetailHref(slug, product.id, "combos", { comboSlotOptionId: option.id })}
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
                            <StatePanel
                              kind="empty"
                              title="Sin opciones todavía"
                              message="Todavía no hay opciones para este combo. El formulario superior ya puede crear la primera."
                            >
                              <p className="text-xs text-muted">
                                Selecciona primero un slot y luego apunta la opción a un producto simple o a una variante
                                configurable.
                              </p>
                            </StatePanel>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <StatePanel
                kind="empty"
                title="Sin opciones aún"
                message="Crea primero un slot para poder administrar las opciones del combo."
              >
                <p className="text-xs text-muted">
                  Un combo sin slots no puede recibir opciones. El siguiente paso recomendado es crear un slot desde el
                  formulario superior.
                </p>
              </StatePanel>
            )}
          </>
        ) : (
          <StatePanel
            kind="empty"
            title="Este producto no es combo"
            message="Cuando este producto cambie a tipo combo, esta sección se convertirá en el punto de gestión de slots y opciones."
          >
            <p className="text-xs text-muted">
              El siguiente paso natural vive en Información general: cambia el tipo de producto a combo para activar
              este bloque.
            </p>
          </StatePanel>
        )}
      </section>

      <Card className="space-y-2 border-border/80 bg-surface">
        <p className="text-sm font-semibold text-foreground">Migración por etapas</p>
        <p className="text-sm text-muted">
          Esta ruta nueva convive con `/{slug}/pos/catalog` y con el CRUD legado para permitir validación progresiva
          sin romper la operación actual.
        </p>
      </Card>
    </div>
  );
}
