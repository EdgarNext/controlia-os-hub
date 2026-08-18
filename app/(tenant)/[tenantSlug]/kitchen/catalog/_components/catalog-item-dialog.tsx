"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createKitchenCatalogItemAction, updateKitchenCatalogItemAction, type KitchenCatalogActionState } from "@/lib/kitchen/inventory/catalog-actions";
import type { KitchenInventoryCategory, KitchenInventoryItem, KitchenInventoryUnit } from "@/lib/kitchen/inventory/types";

const initialState: KitchenCatalogActionState = { ok: false, message: "" };
type Props = { tenantSlug: string; categories: KitchenInventoryCategory[]; units: KitchenInventoryUnit[]; item?: KitchenInventoryItem; canChangeUnit?: boolean };

export function CatalogItemDialog({ tenantSlug, categories, units, item, canChangeUnit = true }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const action = item ? updateKitchenCatalogItemAction : createKitchenCatalogItemAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const consumptionUnits = units.filter((unit) => unit.is_active && ["kg", "l", "pza"].includes(unit.code.toLowerCase()));
  useEffect(() => { if (!state.message) return; if (state.ok) { toast.success(state.message); if (state.itemId) router.push(`/${tenantSlug}/kitchen/catalog/${state.itemId}`); else router.refresh(); } }, [router, state, tenantSlug]);
  return <>
    <Button type="button" onClick={() => setOpen(true)} variant={item ? "secondary" : "primary"}>{item ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{item ? "Editar datos" : "Nuevo insumo"}</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={item ? "Editar datos del insumo" : "Nuevo insumo"}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
        <div className="space-y-1"><Label htmlFor="catalog-name">Nombre</Label><Input autoFocus id="catalog-name" name="name" required defaultValue={item?.name} placeholder="Ej. Harina de trigo" /></div>
        <SearchableSelect name="defaultUnitId" label="Unidad de consumo en recetas" required options={consumptionUnits.map((unit) => ({ value: unit.id, label: `${unit.code} · ${unit.name}` }))} defaultValue={item?.default_unit_id} disabled={Boolean(item && !canChangeUnit)} helpText={item && !canChangeUnit ? "No se puede cambiar porque el insumo ya tiene uso o historial." : "Define la unidad base en la que se consumirá el insumo dentro de las recetas."} />
        {item && !canChangeUnit ? <input type="hidden" name="defaultUnitId" value={item.default_unit_id} /> : null}
        <SearchableSelect name="categoryId" label="Categoría" clearable options={categories.filter((category) => category.is_active || category.id === item?.category_id).map((category) => ({ value: category.id, label: category.name }))} defaultValue={item?.category_id ?? ""} />
        <div className="space-y-1"><Label htmlFor="catalog-description">Descripción</Label><textarea id="catalog-description" name="description" defaultValue={item?.description ?? ""} rows={3} className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" /></div>
        {!item ? <p className="text-xs text-muted">Podrás agregar proveedores, presentaciones y precios después de crear el insumo.</p> : null}
        {state.message && !state.ok ? <div className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.message}{state.duplicateItemId ? <> <Link className="underline" href={`/${tenantSlug}/kitchen/catalog/${state.duplicateItemId}`}>Ver existente</Link></> : null}</div> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" isLoading={pending}>{item ? "Guardar" : "Crear insumo"}</Button></div>
      </form>
    </Modal>
  </>;
}
