"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";

export function ModalDemo() {
  const [openInfo, setOpenInfo] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLoading(false);
    toast.success("Changes saved successfully");
    setOpenInfo(false);
  }

  function handleConfirm() {
    toast.warning("Confirmation accepted");
    setOpenConfirm(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpenInfo(true)}>Abrir modal</Button>
        <Button variant="warning" onClick={() => setOpenConfirm(true)}>
          Abrir confirmación
        </Button>
      </div>

      <Modal open={openInfo} onClose={() => setOpenInfo(false)} title="Editor rápido">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Este modal demuestra entrada/salida animada, overlay y bloqueo de scroll del body.
          </p>

          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm">
            Puedes cerrar con tecla ESC, clic en overlay o botón de cierre.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setOpenInfo(false)}>
              Cancelar
            </Button>
            <Button isLoading={loading} onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={openConfirm} onClose={() => setOpenConfirm(false)} title="Confirmar acción">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            ¿Deseas continuar con esta acción? Esta variante simula un flujo de confirmación.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setOpenConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
