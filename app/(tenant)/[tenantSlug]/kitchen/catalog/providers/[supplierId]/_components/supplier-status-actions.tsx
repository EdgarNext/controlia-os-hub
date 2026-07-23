"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { setKitchenInventorySupplierActiveAction } from "@/lib/kitchen/inventory/supplier-actions";
import type { KitchenInventoryActionState } from "@/lib/kitchen/inventory/actions";

const initialState: KitchenInventoryActionState = { ok: false, message: "" };
export function SupplierStatusActions({ tenantSlug, supplierId, isActive }: { tenantSlug: string; supplierId: string; isActive: boolean }) {
  const [open, setOpen] = useState(false); const [state, action, pending] = useActionState(setKitchenInventorySupplierActiveAction, initialState);
  useEffect(() => { if (!state.message) return; if (state.ok) toast.success(state.message); }, [state]);
  if (!isActive) return <form action={action}><input type="hidden" name="tenantSlug" value={tenantSlug} /><input type="hidden" name="supplierId" value={supplierId} /><input type="hidden" name="nextActive" value="true" /><Button type="submit" variant="secondary" isLoading={pending}>Reactivar proveedor</Button></form>;
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>Desactivar proveedor</Button><Modal open={open} onClose={() => setOpen(false)} title="Desactivar proveedor"><form action={action} className="space-y-4"><input type="hidden" name="tenantSlug" value={tenantSlug} /><input type="hidden" name="supplierId" value={supplierId} /><input type="hidden" name="nextActive" value="false" /><p className="text-sm text-muted">El proveedor dejará de estar disponible para nuevas presentaciones y actualizaciones, pero su historial se conservará. La operación se bloqueará si existen referencias activas.</p>{state.message && !state.ok ? <p className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.message}</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="danger" isLoading={pending}>Desactivar</Button></div></form></Modal></>;
}
