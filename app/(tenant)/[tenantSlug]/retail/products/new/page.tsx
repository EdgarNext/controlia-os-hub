import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createRetailProductAction } from "@/actions/retail-pos/catalog/products.actions";
import { RetailProductCreateForm } from "@/app/(tenant)/[tenantSlug]/retail/products/new/_components/RetailProductCreateForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { listRetailPosBackofficeSuppliers } from "@/lib/retail-pos/catalog";

type RetailProductCreatePageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type RetailProductCreatePageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      suppliers: Awaited<ReturnType<typeof listRetailPosBackofficeSuppliers>>["items"];
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadRetailProductCreatePage(tenantSlug: string): Promise<RetailProductCreatePageResult> {
  try {
    const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "manage");
    const suppliersPayload = await listRetailPosBackofficeSuppliers({
      tenantSlug: tenant.tenantSlug,
    });

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      suppliers: suppliersPayload.items,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para agregar productos retail en este tenant.",
        hint: "Se requiere acceso manage sobre retail_pos.catalog.",
      };
    }

    throw error;
  }
}

export default async function RetailProductCreatePage({ params }: RetailProductCreatePageProps) {
  const { tenantSlug } = await params;
  const result = await loadRetailProductCreatePage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="Agregar producto retail"
          description="Nuevo producto para el catalogo operativo POS retail."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/retail/products`;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="Agregar producto retail"
        description="Nuevo producto para el catalogo operativo POS retail."
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={listPath}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a productos
        </Link>
      </div>

      <RetailProductCreateForm
        action={createRetailProductAction}
        cancelHref={listPath}
        suppliers={result.suppliers}
        tenantSlug={result.tenantSlug}
        initialValues={{
          name: "",
          brand: "",
          sku: "",
          barcode: "",
          price: "",
          cost: "",
          supplier_id: "",
          sales_unit_code: "pza",
          sales_unit_label: "Pieza",
          allow_decimal_quantity: false,
          is_active: true,
        }}
      />

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3 text-sm text-muted">
        Categoria, variantes, importacion y creacion rapida de proveedor quedaron fuera de esta fase por alcance.
      </div>
    </div>
  );
}
