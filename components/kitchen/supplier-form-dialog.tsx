"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/Modal";
import { createKitchenInventorySupplierAction, type KitchenInventoryActionState } from "@/lib/kitchen/inventory/actions";
import { updateKitchenInventorySupplierAction } from "@/lib/kitchen/inventory/supplier-actions";
import type { KitchenInventorySupplier } from "@/lib/kitchen/inventory/types";

const initialState: KitchenInventoryActionState = { ok: false, message: "" };
type Props = { tenantSlug: string; supplier?: KitchenInventorySupplier; onCreated?: (supplier: { id: string; name: string }) => void };

export function SupplierFormDialog({ tenantSlug, supplier, onCreated }: Props) {
  const [open, setOpen] = useState(false); const router = useRouter(); const action = supplier ? updateKitchenInventorySupplierAction : createKitchenInventorySupplierAction; const [state, formAction, pending] = useActionState(action, initialState);
  useEffect(() => { if (!state.message || !state.ok) return; toast.success(state.message); if (supplier) router.push(`/${tenantSlug}/kitchen/catalog/providers/${supplier.id}`); else if (state.supplierId && onCreated) onCreated({ id: state.supplierId, name: state.supplierName ?? "" }); else if (state.supplierId) router.push(`/${tenantSlug}/kitchen/catalog/providers/${state.supplierId}`); }, [onCreated, router, state, supplier, tenantSlug]);
  return <><Button type="button" onClick={() => setOpen(true)} variant={supplier ? "secondary" : "primary"}>{supplier ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{supplier ? "Editar datos" : "Nuevo proveedor"}</Button><Modal open={open} onClose={() => setOpen(false)} title={supplier ? "Editar datos del proveedor" : "Nuevo proveedor"}><form action={formAction} className="space-y-3"><input type="hidden" name="tenantSlug" value={tenantSlug} />{supplier ? <input type="hidden" name="supplierId" value={supplier.id} /> : null}<div className="space-y-1"><Label htmlFor="supplier-name">Nombre del proveedor</Label><Input autoFocus id="supplier-name" name="name" required defaultValue={supplier?.name} placeholder="Ej. Central de abastos" /></div><div className="space-y-1"><Label htmlFor="supplier-contact">Nombre del contacto</Label><Input id="supplier-contact" name="contactName" defaultValue={supplier?.contact_name ?? ""} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="supplier-phone">Teléfono</Label><Input id="supplier-phone" name="phone" type="tel" defaultValue={supplier?.phone ?? ""} /></div><div className="space-y-1"><Label htmlFor="supplier-email">Correo</Label><Input id="supplier-email" name="email" type="email" defaultValue={supplier?.email ?? ""} /></div></div><div className="space-y-1"><Label htmlFor="supplier-notes">Notas</Label><textarea id="supplier-notes" name="notes" rows={3} defaultValue={supplier?.notes ?? ""} className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm" /></div>{!supplier ? <p className="flex items-center gap-2 text-xs text-muted"><Building2 className="h-4 w-4" aria-hidden="true" />Podrás asociarlo con insumos, presentaciones y precios después de crearlo.</p> : null}{state.message && !state.ok ? <div className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.message}{state.duplicateSupplierId ? <> <Link href={`/${tenantSlug}/kitchen/catalog/providers/${state.duplicateSupplierId}`} className="underline">Ver proveedor existente</Link></> : null}</div> : null}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" isLoading={pending}>{supplier ? "Guardar" : "Crear proveedor"}</Button></div></form></Modal></>;
}
