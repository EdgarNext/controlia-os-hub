import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { ActionFeedbackForm } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/action-feedback-form";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { getCateringCostingSettings } from "@/lib/kitchen/event-catering/pricing-queries";
import { updateCateringCostingSettingsWithFeedbackAction } from "@/lib/kitchen/event-catering/pricing-actions";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { resolveKitchenPage } from "../../_lib/page-access";
import { CostingSettingsSkeleton } from "./_components/costing-settings-skeleton";

export default async function CateringCostingSettingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const access = await resolveKitchenPage(tenantSlug, "event_catering", "plans");
  if (!access.ok) return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a la configuración de costeo." />;
  const accessMap = await getCurrentTenantModulePageAccessMap(access.tenant.tenantId, "event_catering");
  const canManage = hasModulePageAccess(accessMap.plans ?? "none", "manage");
  const settingsPromise = getCateringCostingSettings(tenantSlug);

  return <div className="space-y-4"><KitchenPageHeader eyebrow="Cocina · Eventos y costeo" title="Configuración de costeo" description="Define los valores predeterminados utilizados al iniciar el costeo de nuevos servicios de catering." /><Suspense fallback={<CostingSettingsSkeleton />}><SettingsContent tenantSlug={tenantSlug} canManage={canManage} settingsPromise={settingsPromise} /></Suspense></div>;
}

async function SettingsContent({ tenantSlug, canManage, settingsPromise }: { tenantSlug: string; canManage: boolean; settingsPromise: ReturnType<typeof getCateringCostingSettings> }) {
  const loaded = await loadSettings(settingsPromise);
  if (!loaded.settings) return <StatePanel kind="error" title="No se pudo cargar la configuración" message={loaded.error} />;
  const settings = loaded.settings;
  return <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4"><div className="max-w-2xl"><p className="text-sm text-muted">Estos valores se utilizan como predeterminados para nuevos servicios. Cambiarlos no modifica los valores ya guardados en planes existentes ni snapshots históricos.</p>{canManage ? <ActionFeedbackForm action={updateCateringCostingSettingsWithFeedbackAction} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="tenantSlug" value={tenantSlug} /><div><label htmlFor="defaultTargetMarginPct" className="text-sm font-medium text-foreground">Margen objetivo predeterminado</label><div className="mt-1 flex items-center gap-2"><input id="defaultTargetMarginPct" name="defaultTargetMarginPct" type="number" min="0" max="99.99" step="0.01" defaultValue={String(settings.default_target_margin_pct)} required className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" /><span className="text-sm text-muted">%</span></div></div><div><label htmlFor="defaultExtraStaffUnitCost" className="text-sm font-medium text-foreground">Tarifa predeterminada de personal extra</label><div className="mt-1 flex items-center gap-2"><span className="text-sm text-muted">$</span><input id="defaultExtraStaffUnitCost" name="defaultExtraStaffUnitCost" type="number" min="0" step="0.01" defaultValue={settings.default_extra_staff_unit_cost == null ? "" : String(settings.default_extra_staff_unit_cost)} placeholder="No configurada" className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" /></div><p className="mt-1 text-xs text-muted">{settings.default_extra_staff_unit_cost == null ? "No configurada" : "$" + settings.default_extra_staff_unit_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MXN por persona"}</p></div><div className="sm:col-span-2"><KitchenSubmitButton pendingLabel="Guardando...">Guardar configuración</KitchenSubmitButton></div></ActionFeedbackForm> : <StatePanel kind="permission" title="Solo lectura" message="Solicita permisos manage para modificar estos valores." />}</div></section>;
}

async function loadSettings(settingsPromise: ReturnType<typeof getCateringCostingSettings>) {
  try { return { settings: await settingsPromise, error: "" }; }
  catch (error) { return { settings: null, error: error instanceof Error ? error.message : "Intenta recargar la vista." }; }
}
