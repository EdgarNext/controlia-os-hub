export function normalizeKitchenName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeKitchenCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}
