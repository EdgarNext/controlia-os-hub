import type { RetailPosDeviceRole } from "@/shared/types/retail-pos";

export const RETAIL_TECHNICAL_KIOSK_NAME = "RETAIL TECHNICAL - NO USAR";

export const RETAIL_CLAIM_DEVICE_ROLES = [
  "order_station",
  "cashier_station",
  "backoffice_station",
  "counter_station",
  "multi_station",
] as const;

export type RetailClaimDeviceRole = (typeof RETAIL_CLAIM_DEVICE_ROLES)[number];

export function isTechnicalRetailKioskName(name: string | null): boolean {
  const normalized = (name ?? "").trim().toUpperCase();
  return normalized === RETAIL_TECHNICAL_KIOSK_NAME || normalized.startsWith("RETAIL STATION ·");
}

export function isRetailClaimDeviceRole(value: unknown): value is RetailClaimDeviceRole {
  return (
    value === "order_station" ||
    value === "cashier_station" ||
    value === "backoffice_station" ||
    value === "counter_station" ||
    value === "multi_station"
  );
}

export function isSupportedRetailDeviceRole(value: unknown): value is RetailPosDeviceRole {
  return isRetailClaimDeviceRole(value);
}
