import Link from "next/link";
import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { updateRetailProductAction } from "@/actions/retail-pos/catalog/products.actions";
import { RetailProductEditForm } from "@/app/(tenant)/[tenantSlug]/retail/products/[productId]/edit/_components/RetailProductEditForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import {
  getRetailPosBackofficeCatalogProduct,
  listRetailPosBackofficeSuppliers,
} from "@/lib/retail-pos/catalog";

type RetailProductEditPageProps = {
  params: Promise<{ tenantSlug: string; productId: string }>;
};

type RetailProductEditPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      product: Awaited<ReturnType<typeof getRetailPosBackofficeCatalogProduct>>["product"];
      suppliers: Awaited<ReturnType<typeof listRetailPosBackofficeSuppliers>>["items"];
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function formatMoneyInput(cents: number | null | undefined): string {
  if (typeof cents !== "number") {
    return "";
  }

  return (cents / 100).toFixed(2);
}

async function loadRetailProductEditPage(
  tenantSlug: string,
  productId: string,
): Promise<RetailProductEditPageResult> {
  try {
    const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "manage");
    const [productPayload, suppliersPayload] = await Promise.all([
      getRetailPosBackofficeCatalogProduct({
        tenantSlug: tenant.tenantSlug,
        productId,
      }),
      listRetailPosBackofficeSuppliers({
        tenantSlug: tenant.tenantSlug,
      }),
    ]);

    if (!productPayload.product) {
      notFound();
    }

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      product: productPayload.product,
      suppliers: suppliersPayload.items,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para editar productos retail en este tenant.",
        hint: "Se requiere acceso manage sobre retail_pos.catalog.",
      };
    }

    const message = error instanceof Error ? error.message : "No fue posible cargar la edicion del producto retail.";
    if (message.toLowerCase().includes("not found")) {
      notFound();
    }

    throw error;
  }
}

export default async function RetailProductEditPage({ params }: RetailProductEditPageProps) {
  const { tenantSlug, productId } = await params;
  const result = await loadRetailProductEditPage(tenantSlug, productId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="Editar producto retail"
          description="Actualiza un producto del catalogo POS retail."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const detailPath = `/${result.tenantSlug}/retail/products/${result.product.product_id}`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="Editar producto retail"
        description={result.product.name || "Catalogo POS retail"}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={detailPath}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver al detalle
        </Link>
      </div>

      <RetailProductEditForm
        action={updateRetailProductAction}
        cancelHref={detailPath}
        productId={result.product.product_id}
        suppliers={result.suppliers}
        tenantSlug={result.tenantSlug}
        initialValues={{
          name: result.product.name,
          brand: result.product.brand ?? "",
          sku: result.product.sku ?? "",
          barcode: result.product.barcode ?? "",
          price: formatMoneyInput(result.product.price_cents),
          wholesale_price: formatMoneyInput(result.product.wholesale_price_cents),
          cost: formatMoneyInput(result.product.cost_cents),
          supplier_id: result.product.supplier_id ?? "",
          sales_unit_code: result.product.sales_unit_code,
          sales_unit_label: result.product.sales_unit_label,
          allow_decimal_quantity: result.product.allow_decimal_quantity,
          is_active: result.product.is_active,
        }}
      />

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3 text-sm text-muted">
        Categoria, variantes, alta, borrado e importacion quedaron fuera de esta fase por alcance.
      </div>
    </div>
  );
}
