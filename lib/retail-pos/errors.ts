export class RetailPosRuntimeError extends Error {
  status: number;
  code: string | null;
  details: Record<string, unknown> | null;

  constructor(
    status: number,
    message: string,
    code?: string | null,
    details?: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "RetailPosRuntimeError";
    this.status = status;
    this.code = typeof code === "string" && code.trim() ? code.trim() : null;
    this.details = details ?? null;
  }
}
