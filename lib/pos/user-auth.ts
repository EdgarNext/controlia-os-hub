import { createHash } from "node:crypto";

export function hashPosUserPin(pin: string): string {
  const normalized = String(pin ?? "").trim();
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `sha256:${digest}`;
}
