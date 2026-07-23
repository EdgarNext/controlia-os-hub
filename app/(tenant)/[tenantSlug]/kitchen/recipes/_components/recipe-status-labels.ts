const recipeStatusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

const versionStatusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

const importStatusLabels: Record<string, string> = {
  draft: "Borrador",
  parsed: "Interpretada",
  validated: "Validada",
  partially_applied: "Aplicada parcialmente",
  applied: "Aplicada",
  failed: "Fallida",
  canceled: "Cancelada",
};

export function getRecipeStatusLabel(status: string | null | undefined) {
  return status ? recipeStatusLabels[status] ?? status : "—";
}

export function getRecipeVersionStatusLabel(status: string | null | undefined) {
  return status ? versionStatusLabels[status] ?? status : "—";
}

export function getRecipeImportStatusLabel(status: string | null | undefined) {
  return status ? importStatusLabels[status] ?? status : "—";
}

export function getRecipeSnapshotTypeLabel(snapshotType: string | null | undefined) {
  return snapshotType === "current" ? "Actual" : snapshotType ?? "—";
}
