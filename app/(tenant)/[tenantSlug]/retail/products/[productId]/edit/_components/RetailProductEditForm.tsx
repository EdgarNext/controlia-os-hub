"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type RetailProductEditActionState,
  type RetailProductEditFormValues,
} from "@/actions/retail-pos/catalog/products.actions";
import { Button } from "@/components/ui/button";
import type { RetailPosBackofficeSupplier } from "@/shared/types/retail-pos";

type RetailProductEditFormProps = {
  action: (
    previousState: RetailProductEditActionState,
    formData: FormData,
  ) => Promise<RetailProductEditActionState>;
  cancelHref: string;
  productId: string;
  suppliers: RetailPosBackofficeSupplier[];
  tenantSlug: string;
  initialValues: RetailProductEditFormValues;
};

function renderFieldError(error?: string) {
  return error ? <p className="text-xs text-danger">{error}</p> : null;
}

export function RetailProductEditForm({
  action,
  cancelHref,
  productId,
  suppliers,
  tenantSlug,
  initialValues,
}: RetailProductEditFormProps) {
  const initialState: RetailProductEditActionState = {
    error: null,
    fieldErrors: {},
    values: initialValues,
  };
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values;

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-[var(--radius-base)] border border-border bg-surface p-4"
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="productId" value={productId} />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Informacion principal</h2>
          <p className="text-sm text-muted">Ajusta el nombre comercial y la marca del producto retail.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Nombre</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={values.name}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Ej. Agua natural 1 L"
            />
            {renderFieldError(state.fieldErrors.name)}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Marca</span>
            <input
              type="text"
              name="brand"
              defaultValue={values.brand}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Sin marca"
            />
            {renderFieldError(state.fieldErrors.brand)}
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Codigos</h2>
          <p className="text-sm text-muted">SKU y barcode se guardan vacios como null.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">SKU</span>
            <input
              type="text"
              name="sku"
              defaultValue={values.sku}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Opcional"
            />
            {renderFieldError(state.fieldErrors.sku)}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Barcode</span>
            <input
              type="text"
              name="barcode"
              defaultValue={values.barcode}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Opcional"
            />
            {renderFieldError(state.fieldErrors.barcode)}
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Precio y costo</h2>
          <p className="text-sm text-muted">Los montos se capturan en MXN y se convierten a centavos al guardar.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Precio venta</span>
            <input
              type="number"
              name="price"
              required
              min="0"
              step="0.01"
              defaultValue={values.price}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderFieldError(state.fieldErrors.price)}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Costo</span>
            <input
              type="number"
              name="cost"
              min="0"
              step="0.01"
              defaultValue={values.cost}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Opcional"
            />
            {renderFieldError(state.fieldErrors.cost)}
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Proveedor</h2>
          <p className="text-sm text-muted">Solo se listan proveedores activos del mismo tenant.</p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Proveedor</span>
          <select
            name="supplier_id"
            defaultValue={values.supplier_id}
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {renderFieldError(state.fieldErrors.supplier_id)}
        </label>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Unidad de venta</h2>
          <p className="text-sm text-muted">Mantiene el contrato operativo del producto en POS retail.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Codigo unidad</span>
            <input
              type="text"
              name="sales_unit_code"
              required
              defaultValue={values.sales_unit_code}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderFieldError(state.fieldErrors.sales_unit_code)}
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Etiqueta unidad</span>
            <input
              type="text"
              name="sales_unit_label"
              required
              defaultValue={values.sales_unit_label}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderFieldError(state.fieldErrors.sales_unit_label)}
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="allow_decimal_quantity"
            defaultChecked={values.allow_decimal_quantity}
            className="h-4 w-4 accent-primary"
          />
          Permitir cantidad decimal
        </label>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Estado</h2>
          <p className="text-sm text-muted">La desactivacion conserva el producto; no realiza borrado.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={values.is_active}
            className="h-4 w-4 accent-primary"
          />
          Producto activo
        </label>
      </section>

      {state.error ? (
        <p className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" isLoading={isPending}>
          Guardar cambios
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
