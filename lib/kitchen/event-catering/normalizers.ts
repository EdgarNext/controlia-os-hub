export function toCateringNumber(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) throw new Error(`${label} inválido.`);
  return parsed;
}

export function toPositiveCateringNumber(value: string, label: string): number {
  const parsed = toCateringNumber(value, label);
  if (parsed <= 0) throw new Error(`${label} debe ser mayor a 0.`);
  return parsed;
}
