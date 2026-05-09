import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { listKitchenRecipeIngredientItems } from "@/lib/kitchen/recipes/queries";
import { listRecipeImportBatches } from "@/lib/kitchen/recipes/import-queries";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import { CreateRecipeImportBatchForm } from "../_components/import-forms";

type KitchenRecipeImportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenRecipeImportsPage({ params }: KitchenRecipeImportsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "imports");

  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a importaciones de recetario." />;
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes");
  const canManage = hasModulePageAccess(accessMap.imports ?? "none", "manage") || hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const batchesPromise = listRecipeImportBatches(result.tenant.tenantId);
  const itemsPromise = listKitchenRecipeIngredientItems(result.tenant.tenantId);

  return (
    <div className="space-y-4">
      <Suspense fallback={<KitchenActionRowSkeleton actions={1} />}>
        <RecipeImportsHeaderSection itemsPromise={itemsPromise} />
      </Suspense>

      {canManage ? <CreateRecipeImportBatchForm tenantSlug={result.tenant.tenantSlug} /> : null}

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={9} />}>
        <RecipeBatchesSection tenantSlug={tenantSlug} batchesPromise={batchesPromise} />
      </Suspense>
    </div>
  );
}

async function RecipeImportsHeaderSection({
  itemsPromise,
}: {
  itemsPromise: ReturnType<typeof listKitchenRecipeIngredientItems>;
}) {
  const items = await itemsPromise;
  return (
    <KitchenPageHeader
      eyebrow="Recetas"
      title="Importaciones de Recetario"
      description="Flujo controlado con staging + validación + alias mapping antes de aplicar."
      metadata={`Insumos inventario activos detectados: ${items.length}`}
    />
  );
}

async function RecipeBatchesSection({
  tenantSlug,
  batchesPromise,
}: {
  tenantSlug: string;
  batchesPromise: ReturnType<typeof listRecipeImportBatches>;
}) {
  const batches = await batchesPromise;
  if (batches.length === 0) {
    return <StatePanel kind="empty" title="Sin batches" message="Crea el primer batch de RECETARIO.xlsx para iniciar mapeo de alias." />;
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Archivo</th>
              <th className="py-2">Estado</th>
              <th className="py-2 text-right">Rows</th>
              <th className="py-2 text-right">Recetas</th>
              <th className="py-2 text-right">Líneas</th>
              <th className="py-2 text-right">Warning</th>
              <th className="py-2 text-right">Error</th>
              <th className="py-2 text-right">Applied líneas</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-border">
                <td className="py-2 text-muted">{new Date(batch.created_at).toLocaleString("es-MX")}</td>
                <td className="py-2">
                  <Link href={`/${tenantSlug}/kitchen/recipes/imports/${batch.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                    {batch.original_filename}
                  </Link>
                </td>
                <td className="py-2">{batch.status}</td>
                <td className="py-2 text-right">{batch.total_rows}</td>
                <td className="py-2 text-right">{batch.parsed_recipes}</td>
                <td className="py-2 text-right">{batch.parsed_lines}</td>
                <td className="py-2 text-right">{batch.warning_rows}</td>
                <td className="py-2 text-right">{batch.error_rows}</td>
                <td className="py-2 text-right">{batch.applied_lines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
