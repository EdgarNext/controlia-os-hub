export function normalizeMatcherValue(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withoutAccents = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return withoutAccents.replace(/\s+/g, " ");
}

export function isAllowedSimulationMode(mode: string): mode is "disabled" | "simulation" {
  return mode === "disabled" || mode === "simulation";
}

