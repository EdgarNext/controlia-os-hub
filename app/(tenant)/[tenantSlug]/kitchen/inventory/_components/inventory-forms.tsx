"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SelectField } from "@/components/ui/select-field";
import { formatKitchenUnitOptionLabel } from "@/lib/kitchen/formatters";
import {
  createUnifiedPurchaseOptionAndPriceAction,
  createKitchenInventoryCategoryAction,
  createKitchenInventoryItemAction,
  createKitchenInventoryLocationAction,
  createPurchaseOptionAction,
  createKitchenInventorySupplierAction,
  createSupplierPriceAction,
  createKitchenInventoryUnitAction,
  createKitchenInventoryStockRuleAction,
  deactivatePurchaseOptionAction,
  recordKitchenInventoryMovementAction,
  setDefaultPurchaseOptionAction,
} from "@/lib/kitchen/inventory/actions";
import { initialKitchenInventoryActionState } from "@/lib/kitchen/inventory/action-state";
import type {
  KitchenInventoryCategory,
  KitchenInventoryItem,
  KitchenInventoryLocation,
  KitchenInventoryPurchaseOption,
  KitchenInventorySupplier,
  KitchenInventorySupplierPrice,
  KitchenInventoryUnit,
} from "@/lib/kitchen/inventory/types";

export function CreateKitchenInventoryCategoryForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventoryCategoryAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Nueva categoría</p>
      <div className="space-y-1">
        <Label htmlFor="category-name">Nombre</Label>
        <Input id="category-name" name="name" placeholder="Proteínas" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="category-description">Descripción</Label>
        <Input id="category-description" name="description" placeholder="Opcional" />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={isPending}>Crear categoría</Button>
    </form>
  );
}

export function CreateKitchenInventoryUnitForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventoryUnitAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Nueva unidad</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="unit-code">Código</Label>
          <Input id="unit-code" name="code" placeholder="kg" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unit-name">Nombre</Label>
          <Input id="unit-name" name="name" placeholder="Kilogramo" required />
        </div>
        <div className="space-y-1">
          <SelectField
            id="unit-type"
            name="unitType"
            label="Tipo"
            defaultValue="mass"
            options={[
              { value: "mass", label: "Masa" },
              { value: "volume", label: "Volumen" },
              { value: "unit", label: "Unidad" },
              { value: "package", label: "Paquete" },
              { value: "other", label: "Otro" },
            ]}
          />
        </div>
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={isPending}>Crear unidad</Button>
    </form>
  );
}

export function CreateKitchenInventorySupplierForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventorySupplierAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Nuevo proveedor</p>
      <div className="space-y-1">
        <Label htmlFor="supplier-name">Nombre</Label>
        <Input id="supplier-name" name="name" placeholder="Abarrotes Inst." required />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={isPending}>Crear proveedor</Button>
    </form>
  );
}

export function CreateKitchenInventoryLocationForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventoryLocationAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Nueva ubicación</p>
      <div className="space-y-1">
        <Label htmlFor="location-name">Nombre</Label>
        <Input id="location-name" name="name" placeholder="Almacén" required />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={isPending}>Crear ubicación</Button>
    </form>
  );
}

export function CreateKitchenInventoryItemForm({
  tenantSlug,
  categories,
  units,
  suppliers,
}: {
  tenantSlug: string;
  categories: KitchenInventoryCategory[];
  units: KitchenInventoryUnit[];
  suppliers: KitchenInventorySupplier[];
}) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventoryItemAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Crear insumo</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="item-name">Nombre</Label>
          <Input id="item-name" name="name" placeholder="Pechuga de pollo" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-sku">SKU</Label>
          <Input id="item-sku" name="sku" placeholder="Opcional" />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="item-category"
            name="categoryId"
            label="Categoría"
            placeholder="Sin categoría"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="item-unit"
            name="defaultUnitId"
            label="Unidad por defecto"
            placeholder="Selecciona una unidad"
            required
            options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="item-supplier"
            name="defaultSupplierId"
            label="Proveedor por defecto"
            placeholder="Sin proveedor"
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-cost">Costo unitario actual</Label>
          <Input id="item-cost" name="currentUnitCost" type="number" min="0" step="0.01" defaultValue="0" required />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isPerishable" className="h-4 w-4 rounded border-border" />
        Perecedero
      </label>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>Crear insumo</Button>
    </form>
  );
}

export function RecordKitchenInventoryMovementForm({
  tenantSlug,
  items,
  units,
  locations,
}: {
  tenantSlug: string;
  items: KitchenInventoryItem[];
  units: KitchenInventoryUnit[];
  locations: KitchenInventoryLocation[];
}) {
  const [state, formAction, isPending] = useActionState(
    recordKitchenInventoryMovementAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Registrar movimiento</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <SearchableSelect
            id="movement-item"
            name="itemId"
            label="Insumo"
            placeholder="Selecciona un insumo"
            required
            options={items.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="movement-location"
            name="locationId"
            label="Ubicación"
            placeholder="Selecciona ubicación"
            required
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="movement-unit"
            name="unitId"
            label="Unidad"
            placeholder="Selecciona unidad"
            required
            options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
          />
        </div>
        <div className="space-y-1">
          <SelectField
            id="movement-type"
            name="movementType"
            label="Tipo"
            defaultValue="manual_in"
            required
            options={[
              { value: "manual_in", label: "Entrada manual" },
              { value: "manual_out", label: "Salida manual" },
              { value: "adjustment_in", label: "Ajuste +" },
              { value: "adjustment_out", label: "Ajuste -" },
              { value: "waste", label: "Merma" },
              { value: "purchase", label: "Compra" },
              { value: "opening_balance", label: "Saldo inicial" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="movement-qty">Cantidad</Label>
          <Input id="movement-qty" name="quantity" type="number" min="0.0001" step="0.0001" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="movement-cost">Costo unitario</Label>
          <Input id="movement-cost" name="unitCost" type="number" min="0" step="0.0001" placeholder="Opcional" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="movement-reason">Motivo</Label>
        <Input id="movement-reason" name="reason" placeholder="Opcional" />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>Registrar movimiento</Button>
    </form>
  );
}

export function CreateKitchenInventoryStockRuleForm({
  tenantSlug,
  items,
  locations,
}: {
  tenantSlug: string;
  items: KitchenInventoryItem[];
  locations: KitchenInventoryLocation[];
}) {
  const [state, formAction, isPending] = useActionState(
    createKitchenInventoryStockRuleAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Regla de stock</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <SearchableSelect
            id="rule-item"
            name="itemId"
            label="Insumo"
            placeholder="Selecciona un insumo"
            required
            options={items.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="rule-location"
            name="locationId"
            label="Ubicación"
            placeholder="Global del insumo"
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-min">Mínimo</Label>
          <Input id="rule-min" name="minQuantity" type="number" min="0" step="0.0001" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-max">Máximo</Label>
          <Input id="rule-max" name="maxQuantity" type="number" min="0" step="0.0001" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rule-reorder">Reorden</Label>
          <Input id="rule-reorder" name="reorderQuantity" type="number" min="0" step="0.0001" />
        </div>
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={isPending}>Guardar regla</Button>
    </form>
  );
}

export function CreateKitchenInventoryPurchaseOptionForm({
  tenantSlug,
  items,
  suppliers,
  units,
}: {
  tenantSlug: string;
  items: KitchenInventoryItem[];
  suppliers: KitchenInventorySupplier[];
  units: KitchenInventoryUnit[];
}) {
  const [state, formAction, isPending] = useActionState(
    createPurchaseOptionAction,
    initialKitchenInventoryActionState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Opción de compra por proveedor</p>
      <div className="grid gap-2 md:grid-cols-2">
        <SearchableSelect
          id="purchase-option-item"
          name="itemId"
          label="Insumo"
          placeholder="Selecciona insumo"
          required
          options={items.map((item) => ({ value: item.id, label: item.name }))}
        />
        <SearchableSelect
          id="purchase-option-supplier"
          name="supplierId"
          label="Proveedor"
          placeholder="Proveedor opcional"
          options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <SearchableSelect
          id="purchase-option-unit"
          name="purchaseUnitId"
          label="Unidad de compra"
          placeholder="Ej. caja"
          required
          options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
        />
        <SearchableSelect
          id="purchase-option-inventory-unit"
          name="inventoryUnitId"
          label="Unidad de inventario"
          placeholder="Ej. l / kg"
          required
          options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
        />
        <div className="space-y-1">
          <Label htmlFor="purchase-option-qty">Cantidad por unidad de compra</Label>
          <Input id="purchase-option-qty" name="quantityPerPurchaseUnit" type="number" min="0.0001" step="0.0001" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purchase-option-min">Mínimo compra</Label>
          <Input id="purchase-option-min" name="minPurchaseQuantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purchase-option-multiple">Múltiplo compra</Label>
          <Input id="purchase-option-multiple" name="purchaseMultiple" type="number" min="0.0001" step="0.0001" defaultValue="1" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purchase-option-notes">Notas</Label>
          <Input id="purchase-option-notes" name="notes" placeholder="Opcional" />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-border" />
        Marcar como default
      </label>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>Guardar opción de compra</Button>
    </form>
  );
}

export function CreateUnifiedPurchaseAndPriceForm({
  tenantSlug,
  items,
  suppliers,
  units,
  purchaseOptions,
}: {
  tenantSlug: string;
  items: KitchenInventoryItem[];
  suppliers: KitchenInventorySupplier[];
  units: KitchenInventoryUnit[];
  purchaseOptions: KitchenInventoryPurchaseOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createUnifiedPurchaseOptionAndPriceAction,
    initialKitchenInventoryActionState,
  );
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedPurchaseUnitId, setSelectedPurchaseUnitId] = useState("");
  const [selectedInventoryUnitId, setSelectedInventoryUnitId] = useState("");
  const [selectedQuantityPerPurchaseUnit, setSelectedQuantityPerPurchaseUnit] = useState("");
  const [selectedMinPurchaseQuantity, setSelectedMinPurchaseQuantity] = useState("1");
  const [selectedPurchaseMultiple, setSelectedPurchaseMultiple] = useState("1");

  const compatibleOption = useMemo(() => {
    const quantity = Number(selectedQuantityPerPurchaseUnit);
    const min = Number(selectedMinPurchaseQuantity);
    const multiple = Number(selectedPurchaseMultiple);
    if (
      !selectedItemId ||
      !selectedSupplierId ||
      !selectedPurchaseUnitId ||
      !selectedInventoryUnitId ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(min) ||
      min <= 0 ||
      !Number.isFinite(multiple) ||
      multiple <= 0
    ) {
      return null;
    }
    return (
      purchaseOptions.find(
        (option) =>
          option.is_active &&
          option.item_id === selectedItemId &&
          option.supplier_id === selectedSupplierId &&
          option.purchase_unit_id === selectedPurchaseUnitId &&
          option.inventory_unit_id === selectedInventoryUnitId &&
          Number(option.quantity_per_purchase_unit) === quantity &&
          Number(option.min_purchase_quantity) === min &&
          Number(option.purchase_multiple) === multiple,
      ) ?? null
    );
  }, [
    purchaseOptions,
    selectedItemId,
    selectedSupplierId,
    selectedPurchaseUnitId,
    selectedInventoryUnitId,
    selectedQuantityPerPurchaseUnit,
    selectedMinPurchaseQuantity,
    selectedPurchaseMultiple,
  ]);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Opciones de compra y precios</p>
      <p className="text-xs text-muted">
        Define cómo se compra un insumo, con qué proveedor, a qué equivalencia de inventario y con qué precio vigente.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <SearchableSelect
          id="unified-item"
          name="itemId"
          label="Insumo"
          placeholder="Selecciona insumo"
          required
          onValueChange={setSelectedItemId}
          options={items.map((item) => ({ value: item.id, label: item.name }))}
        />
        <SearchableSelect
          id="unified-supplier"
          name="supplierId"
          label="Proveedor"
          placeholder="Selecciona proveedor"
          required
          onValueChange={setSelectedSupplierId}
          options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <SearchableSelect
          id="unified-purchase-unit"
          name="purchaseUnitId"
          label="Unidad de compra"
          placeholder="Ej. caja / kg"
          required
          onValueChange={setSelectedPurchaseUnitId}
          options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
        />
        <SearchableSelect
          id="unified-inventory-unit"
          name="inventoryUnitId"
          label="Unidad de inventario"
          placeholder="Ej. kg / l / pza"
          required
          onValueChange={setSelectedInventoryUnitId}
          options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
        />
        <div className="space-y-1">
          <Label htmlFor="unified-qty">Cantidad por unidad de compra</Label>
          <Input
            id="unified-qty"
            name="quantityPerPurchaseUnit"
            type="number"
            min="0.0001"
            step="0.0001"
            required
            onChange={(event) => setSelectedQuantityPerPurchaseUnit(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unified-price">Precio por unidad de compra</Label>
          <Input id="unified-price" name="pricePerPurchaseUnit" type="number" min="0" step="0.0001" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unified-min">Mínimo compra</Label>
          <Input
            id="unified-min"
            name="minPurchaseQuantity"
            type="number"
            min="0.0001"
            step="0.0001"
            defaultValue="1"
            required
            onChange={(event) => setSelectedMinPurchaseQuantity(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unified-multiple">Múltiplo compra</Label>
          <Input
            id="unified-multiple"
            name="purchaseMultiple"
            type="number"
            min="0.0001"
            step="0.0001"
            defaultValue="1"
            required
            onChange={(event) => setSelectedPurchaseMultiple(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <SelectField
            id="unified-source-type"
            name="sourceType"
            label="Fuente"
            defaultValue="manual"
            options={[
              { value: "manual", label: "Manual" },
              { value: "supplier_list", label: "Lista proveedor" },
              { value: "quote", label: "Cotización" },
              { value: "invoice", label: "Factura" },
              { value: "import", label: "Importación" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unified-source-ref">Referencia</Label>
          <Input id="unified-source-ref" name="sourceRef" placeholder="Opcional" />
        </div>
      </div>
      <Input name="notes" placeholder="Notas opcionales" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-border" />
          Marcar opción como default
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isCurrent" defaultChecked className="h-4 w-4 rounded border-border" />
          Marcar precio como vigente
        </label>
      </div>
      {compatibleOption ? (
        <p className="text-xs text-primary">
          Ya existe una opción compatible activa. Se usará esa opción y solo se guardará el precio proveedor.
        </p>
      ) : null}
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>
        {compatibleOption ? "Usar opción existente y guardar precio" : "Guardar opción y precio"}
      </Button>
    </form>
  );
}

export function PurchaseOptionsAndPricesTable({
  options,
  prices,
}: {
  options: KitchenInventoryPurchaseOption[];
  prices: KitchenInventorySupplierPrice[];
}) {
  const optionById = new Map(options.map((option) => [option.id, option]));
  const currentPrices = prices.filter((price) => price.is_current);

  if (currentPrices.length === 0) {
    return <p className="text-xs text-muted">Sin configuraciones vigentes de compra y precio.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Insumo</th>
            <th className="py-1">Proveedor</th>
            <th className="py-1">Presentación</th>
            <th className="py-1">Equivalencia</th>
            <th className="py-1">Precio vigente</th>
            <th className="py-1">Fuente</th>
            <th className="py-1">Default</th>
            <th className="py-1">Estado</th>
          </tr>
        </thead>
        <tbody>
          {currentPrices.map((price) => {
            const option = price.purchase_option_id ? optionById.get(price.purchase_option_id) ?? null : null;
            const purchaseUnitCode = option?.purchase_unit?.code ?? price.purchase_unit?.code ?? "ud";
            const inventoryUnitCode = option?.inventory_unit?.code ?? "ud";
            const quantityPerPurchase = Number(option?.quantity_per_purchase_unit ?? 1);
            return (
              <tr key={price.id} className="border-t border-border">
                <td className="py-1 text-foreground">{price.kitchen_inventory_items?.name ?? "Insumo"}</td>
                <td className="py-1 text-muted">{price.kitchen_inventory_suppliers?.name ?? "Proveedor"}</td>
                <td className="py-1 text-foreground">{purchaseUnitCode}</td>
                <td className="py-1 text-foreground">
                  1 {purchaseUnitCode} = {quantityPerPurchase.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {inventoryUnitCode}
                </td>
                <td className="py-1 text-foreground">
                  ${Number(price.price_per_purchase_unit).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/{purchaseUnitCode}
                </td>
                <td className="py-1 text-muted">{price.source_type}</td>
                <td className="py-1 text-foreground">{option?.is_default ? "Sí" : "No"}</td>
                <td className="py-1 text-foreground">{option?.is_active === false ? "Opción inactiva" : "Vigente"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PurchaseOptionsTable({
  tenantSlug,
  options,
  canManage,
}: {
  tenantSlug: string;
  options: KitchenInventoryPurchaseOption[];
  canManage: boolean;
}) {
  const [, setDefaultAction, setDefaultPending] = useActionState(
    setDefaultPurchaseOptionAction,
    initialKitchenInventoryActionState,
  );
  const [, deactivateAction, deactivatePending] = useActionState(
    deactivatePurchaseOptionAction,
    initialKitchenInventoryActionState,
  );

  if (options.length === 0) {
    return <p className="text-xs text-muted">Sin opciones de compra configuradas.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Insumo</th>
            <th className="py-1">Proveedor</th>
            <th className="py-1">Unidad compra</th>
            <th className="py-1">Equivalencia inventario</th>
            <th className="py-1">Min</th>
            <th className="py-1">Múltiplo</th>
            <th className="py-1">Default</th>
            <th className="py-1">Estado</th>
            <th className="py-1">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.id} className="border-t border-border">
              <td className="py-1 text-foreground">{option.kitchen_inventory_items?.name ?? option.item_id.slice(0, 8)}</td>
              <td className="py-1 text-muted">{option.kitchen_inventory_suppliers?.name ?? "Sin proveedor"}</td>
              <td className="py-1 text-foreground">{option.purchase_unit?.code ?? "—"}</td>
              <td className="py-1 text-foreground">
                1 {option.purchase_unit?.code ?? "ud"} = {Number(option.quantity_per_purchase_unit).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {option.inventory_unit?.code ?? "ud"}
              </td>
              <td className="py-1 text-foreground">{Number(option.min_purchase_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="py-1 text-foreground">{Number(option.purchase_multiple).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="py-1 text-foreground">{option.is_default ? "Sí" : "No"}</td>
              <td className="py-1 text-foreground">{option.is_active ? "Activa" : "Inactiva"}</td>
              <td className="py-1">
                <div className="flex items-center gap-2">
                  {canManage && !option.is_default && option.is_active ? (
                    <form action={setDefaultAction}>
                      <input type="hidden" name="tenantSlug" value={tenantSlug} />
                      <input type="hidden" name="optionId" value={option.id} />
                      <Button type="submit" variant="secondary" isLoading={setDefaultPending}>Default</Button>
                    </form>
                  ) : null}
                  {canManage && option.is_active ? (
                    <form action={deactivateAction}>
                      <input type="hidden" name="tenantSlug" value={tenantSlug} />
                      <input type="hidden" name="optionId" value={option.id} />
                      <Button type="submit" variant="secondary" isLoading={deactivatePending}>Desactivar</Button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreateKitchenInventorySupplierPriceForm({
  tenantSlug,
  items,
  suppliers,
  purchaseOptions,
}: {
  tenantSlug: string;
  items: KitchenInventoryItem[];
  suppliers: KitchenInventorySupplier[];
  purchaseOptions: KitchenInventoryPurchaseOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createSupplierPriceAction,
    initialKitchenInventoryActionState,
  );
  const [selectedItemId, setSelectedItemId] = useState("");

  const filteredPurchaseOptions = useMemo(
    () =>
      purchaseOptions.filter(
        (option) => option.is_active && (!selectedItemId || option.item_id === selectedItemId),
      ),
    [purchaseOptions, selectedItemId],
  );

  const purchaseUnitOptions = useMemo(() => {
    const seen = new Set<string>();
    return filteredPurchaseOptions
      .filter((option) => {
        if (!option.purchase_unit_id || seen.has(option.purchase_unit_id)) return false;
        seen.add(option.purchase_unit_id);
        return true;
      })
      .map((option) => ({
        value: option.purchase_unit_id,
        label: formatKitchenUnitOptionLabel(option.purchase_unit),
      }));
  }, [filteredPurchaseOptions]);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Precio proveedor (preliminar)</p>
      <div className="grid gap-2 md:grid-cols-2">
        <SearchableSelect
          id="sp-item"
          name="itemId"
          label="Insumo"
          placeholder="Selecciona insumo"
          required
          onValueChange={setSelectedItemId}
          options={items.map((item) => ({ value: item.id, label: item.name }))}
        />
        <SearchableSelect id="sp-supplier" name="supplierId" label="Proveedor" placeholder="Selecciona proveedor" required options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} />
        <SearchableSelect
          key={`sp-po-${selectedItemId || "all"}`}
          id="sp-purchase-option"
          name="purchaseOptionId"
          label="Opción de compra"
          placeholder={selectedItemId ? "Opcional" : "Selecciona primero un insumo"}
          options={filteredPurchaseOptions.map((option) => ({
            value: option.id,
            label: `${option.kitchen_inventory_items?.name ?? "Insumo"} · ${option.purchase_unit?.code ?? "ud"}`,
          }))}
        />
        <SearchableSelect
          key={`sp-pu-${selectedItemId || "all"}`}
          id="sp-purchase-unit"
          name="purchaseUnitId"
          label="Unidad compra"
          placeholder={selectedItemId ? "Unidad compra" : "Selecciona primero un insumo"}
          required
          options={purchaseUnitOptions}
        />
        <div className="space-y-1">
          <Label htmlFor="sp-price">Precio por unidad de compra</Label>
          <Input id="sp-price" name="pricePerPurchaseUnit" type="number" min="0" step="0.0001" required />
        </div>
        <div className="space-y-1">
          <SelectField
            id="sp-source-type"
            name="sourceType"
            label="Fuente"
            defaultValue="manual"
            options={[
              { value: "manual", label: "Manual" },
              { value: "supplier_list", label: "Lista proveedor" },
              { value: "quote", label: "Cotización" },
              { value: "invoice", label: "Factura" },
              { value: "import", label: "Importación" },
            ]}
          />
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input name="sourceRef" placeholder="Referencia opcional" />
        <Input name="notes" placeholder="Notas opcionales" />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isCurrent" defaultChecked className="h-4 w-4 rounded border-border" />
        Marcar como precio current
      </label>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>Guardar precio</Button>
    </form>
  );
}

export function SupplierPricesTable({
  prices,
}: {
  prices: KitchenInventorySupplierPrice[];
}) {
  if (prices.length === 0) return <p className="text-xs text-muted">Sin precios de proveedor registrados.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Insumo</th>
            <th className="py-1">Proveedor</th>
            <th className="py-1">Unidad compra</th>
            <th className="py-1">Precio</th>
            <th className="py-1">Fuente</th>
            <th className="py-1">Current</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((price) => (
            <tr key={price.id} className="border-t border-border">
              <td className="py-1 text-foreground">{price.kitchen_inventory_items?.name ?? price.item_id.slice(0, 8)}</td>
              <td className="py-1 text-muted">{price.kitchen_inventory_suppliers?.name ?? "—"}</td>
              <td className="py-1 text-muted">{price.purchase_unit?.code ?? "ud"}</td>
              <td className="py-1 text-foreground">${Number(price.price_per_purchase_unit).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="py-1 text-muted">{price.source_type}</td>
              <td className="py-1 text-foreground">{price.is_current ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
